(() => {
  const micBtn = document.getElementById('micBtn');
  const textInput = document.getElementById('textInput');
  const sendTextBtn = document.getElementById('sendTextBtn');
  const statusEl = document.getElementById('status');
  const transcriptEl = document.getElementById('transcript');
  const replyEl = document.getElementById('reply');
  const latFirstAudio = document.getElementById('latFirstAudio');
  const latRag = document.getElementById('latRag');
  const latLlm = document.getElementById('latLlm');

  const MIC_SAMPLE_RATE = 16000;
  const PLAYBACK_SAMPLE_RATE = 24000;

  let ws = null;
  let micStream = null;
  let audioCtx = null;
  let sourceNode = null;
  let processorNode = null;
  let listening = false;
  let assistantSpeaking = false;

  // --- Gapless playback scheduling ---
  let playbackCtx = null;
  let nextStartTime = 0;

  function ensurePlaybackContext() {
    if (!playbackCtx) {
      playbackCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: PLAYBACK_SAMPLE_RATE });
      nextStartTime = playbackCtx.currentTime;
    }
    return playbackCtx;
  }

  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function base64ToInt16(base64) {
    const bytes = base64ToBytes(base64);
    return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  }

  function scheduleBuffer(buffer) {
    const ctx = ensurePlaybackContext();
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const FADE_S = 0.004;
    const startAt = Math.max(nextStartTime, ctx.currentTime);
    const duration = buffer.duration;
    const fade = Math.min(FADE_S, duration / 2);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0, startAt);
    gainNode.gain.linearRampToValueAtTime(1, startAt + fade);
    gainNode.gain.setValueAtTime(1, startAt + duration - fade);
    gainNode.gain.linearRampToValueAtTime(0, startAt + duration);

    src.connect(gainNode);
    gainNode.connect(ctx.destination);
    src.start(startAt);
    nextStartTime = startAt + duration;
  }

  function playPcmChunk(base64Audio, sampleRate = PLAYBACK_SAMPLE_RATE) {
    const ctx = ensurePlaybackContext();
    const int16 = base64ToInt16(base64Audio);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

    const buffer = ctx.createBuffer(1, float32.length, sampleRate);
    buffer.copyToChannel(float32, 0);
    scheduleBuffer(buffer);
  }

  async function playWavChunk(base64Audio) {
    const ctx = ensurePlaybackContext();
    const bytes = base64ToBytes(base64Audio);
    const buffer = await ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    scheduleBuffer(buffer);
  }

  function isWavContentType(contentType) {
    if (!contentType) return false;
    const ct = contentType.toLowerCase();
    return ct.includes('wav') || ct === 'audio/wave' || ct === 'audio/x-wav';
  }

  function isPcmContentType(contentType) {
    if (!contentType) return true;
    const ct = contentType.toLowerCase();
    return ct.includes('pcm') || ct.includes('linear16') || ct.includes('s16le') || ct === 'audio/raw';
  }

  async function playAudioChunk(base64Audio, contentType) {
    if (isWavContentType(contentType)) {
      await playWavChunk(base64Audio);
    } else if (isPcmContentType(contentType)) {
      playPcmChunk(base64Audio);
    } else {
      // Unknown type — try WAV decode first (Sarvam often labels linear16 as audio/wav),
      // fall back to raw PCM if decode fails.
      try {
        await playWavChunk(base64Audio);
      } catch {
        playPcmChunk(base64Audio);
      }
    }
  }

  function resetPlayback() {
    if (playbackCtx) nextStartTime = playbackCtx.currentTime;
  }

  function arrayBufferToBase64(buf) {
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function floatTo16BitPCM(float32Array) {
    const buf = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buf;
  }

  async function startListening() {
    console.log('[Client] Starting microphone...');
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/voice`);
    ws.onopen = () => {
      console.log('[Client] WebSocket connected');
      setStatus('Connected — listening…');
    };
    ws.onclose = (event) => {
      console.log('[Client] WebSocket disconnected, code:', event.code, 'reason:', event.reason);
      setStatus('Disconnected');
    };
    ws.onerror = (err) => {
      console.error('[Client] WebSocket error:', err);
      setStatus('Connection error');
    };
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      handleServerMessage(msg);
    };

    try {
      console.log('[Client] Requesting microphone access...');
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('[Client] Microphone access granted');
    } catch (err) {
      console.error('[Client] Mic error:', err);
      setStatus('Microphone access denied');
      return;
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: MIC_SAMPLE_RATE });

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
      console.log('[Client] Audio context resumed');
    }

    sourceNode = audioCtx.createMediaStreamSource(micStream);

    processorNode = audioCtx.createScriptProcessor(2048, 1, 1);
    sourceNode.connect(processorNode);
    processorNode.connect(audioCtx.destination);

    processorNode.onaudioprocess = (e) => {
      if (!listening || assistantSpeaking || ws.readyState !== WebSocket.OPEN) return;

      const input = e.inputBuffer.getChannelData(0);
      const pcm16 = floatTo16BitPCM(input);
      const base64Audio = arrayBufferToBase64(pcm16);
      ws.send(JSON.stringify({ type: 'audio_chunk', audio: base64Audio }));
    };

    listening = true;
    micBtn.classList.add('listening');
    micBtn.textContent = 'Stop';
    setStatus('Listening…');
  }

  function stopListening() {
    listening = false;
    micBtn.classList.remove('listening');
    micBtn.textContent = 'Start talking';

    processorNode?.disconnect();
    sourceNode?.disconnect();
    micStream?.getTracks().forEach((t) => t.stop());

    if (ws) {
      ws.close();
    }

    setStatus('Idle');
  }

  function setStatus(text) { statusEl.textContent = text; }

  function handleServerMessage(msg) {
    console.log('[Client] Received:', msg.type, msg);
    switch (msg.type) {
      case 'transcript':
        transcriptEl.textContent = msg.text;
        break;
      case 'vad':
        if (msg.signal === 'START_SPEECH') setStatus('Listening…');
        if (msg.signal === 'END_SPEECH') setStatus('Thinking…');
        break;
      case 'barge_in':
        resetPlayback();
        replyEl.textContent = '';
        setStatus('Listening (interrupted)…');
        break;
      case 'reply_text':
        replyEl.textContent = msg.text + (msg.cached ? '  ⚡ (cached)' : '');
        break;
      case 'audio_chunk':
        assistantSpeaking = true;
        playAudioChunk(msg.audio, msg.content_type).catch((err) => {
          console.error('[Client] Audio playback error:', err);
        });
        setStatus('Speaking…');
        break;
      case 'turn_done':
        assistantSpeaking = false;
        setStatus('Listening…');
        break;
      case 'info':
        console.info('[server]', msg.message);
        break;
      case 'error':
        console.error(`[server:${msg.stage}]`, msg.message);
        setStatus(`Error: ${msg.message}`);
        break;
    }
    if (msg.latency) {
      latFirstAudio.textContent = msg.latency.first_audio_to_client_ms?.toFixed?.(0) ?? '–';
      latRag.textContent = msg.latency.rag_latency_ms?.toFixed?.(0) ?? '–';
      latLlm.textContent = msg.latency.llm_first_token_latency_ms?.toFixed?.(0) ?? '–';
    }
  }

  async function sendText() {
    const text = textInput.value.trim();
    if (!text) return;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/voice`);
    }

    ws.onopen = () => {
      setStatus('Connected — sending text…');
      ws.send(JSON.stringify({ type: 'text_input', text: text }));
      transcriptEl.textContent = text;
      textInput.value = '';
    };
    ws.onclose = () => setStatus('Disconnected');
    ws.onerror = () => setStatus('Connection error');
    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      handleServerMessage(msg);
    };
  }

  micBtn.addEventListener('click', () => {
    if (listening) stopListening();
    else startListening();
  });

  sendTextBtn.addEventListener('click', sendText);
  textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendText();
  });
})();

/**
 * Extract audio bytes and content type from a Sarvam TTS websocket message.
 *
 * The SDK types say msg.data.audio holds the payload, but live responses
 * sometimes base64-encode a JSON wrapper ({"request_id":...}) instead of
 * raw audio — a known Sarvam "WAV codec" bug. Unwrap defensively.
 */
function extractTtsAudio(msg) {
  const data = msg?.data ?? msg;
  let audio = data?.audio;
  let contentType = data?.content_type ?? 'audio/pcm';

  if (typeof audio !== 'string' || !audio) {
    return { audio: null, contentType };
  }

  // Detect nested JSON accidentally base64-encoded as the audio field.
  try {
    const decoded = Buffer.from(audio, 'base64').toString('utf8');
    if (decoded.trimStart().startsWith('{')) {
      const nested = JSON.parse(decoded);
      const nestedData = nested?.data ?? nested;
      audio = nestedData?.audio ?? nested?.audio ?? audio;
      contentType = nestedData?.content_type ?? nested?.content_type ?? contentType;
    }
  } catch {
    // Not JSON — treat as raw audio bytes.
  }

  return { audio, contentType };
}

/**
 * Forward a Sarvam TTS chunk to the browser client.
 * @param {import('ws').WebSocket} clientWs
 * @param {object} sarvamMsg - Raw message from Sarvam TTS websocket
 */
function forwardTtsChunk(clientWs, sarvamMsg) {
  const { audio, contentType } = extractTtsAudio(sarvamMsg);
  if (!audio) return;

  clientWs.send(JSON.stringify({
    type: 'audio_chunk',
    audio,
    content_type: contentType,
  }));
}

module.exports = { extractTtsAudio, forwardTtsChunk };

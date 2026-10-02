// Music Player with a four-bar audio visualizer
document.addEventListener('DOMContentLoaded', function() {
  const musicToggle = document.getElementById('musicToggle');
  const audioPlayer = document.getElementById('audioPlayer');
  const canvas = document.getElementById('visualizerCanvas');
  const ctx = canvas.getContext('2d');
  
  let isPlaying = false;
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let animationId = null;


  // Black in light mode, white in dark mode
  function barColor() {
    return document.body.classList.contains('dark-mode') ? '#ffffff' : '#000000';
  }

  // Check if audio is supported
  if (!audioPlayer.canPlayType('audio/mp4')) {
    console.warn('AAC/m4a format may not be supported in this browser');
  }
  
  // Initialize Audio Context and Visualizer
  function initAudioVisualizer() {
    if (audioContext) return;
    
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaElementSource(audioPlayer);
      
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3; // low smoothing so the bars flicker quickly with the audio
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      
      console.log('Audio visualizer initialized successfully');
    } catch (error) {
      console.error('Audio visualizer initialization failed:', error);
    }
  }
  
  // Four vertical bars: tiny dot-like lines at rest that stretch with the music.
  // Each bar grows up and down from the center line.
  const BAR_COUNT = 4;
  const BAR_WIDTH = 6;
  const BAR_GAP = 7;
  const MIN_HEIGHT = 13;                  // a little taller than wide: tiny rounded lines that read as dots
  const IDLE_HEIGHTS = [MIN_HEIGHT, MIN_HEIGHT, MIN_HEIGHT, MIN_HEIGHT];
  const MAX_HEIGHTS = [36, 52, 52, 36];   // inner bars can stretch further than the outer ones
  const FOLLOW_SPEED = 0.65;              // 0..1, how quickly bars chase the audio (higher = faster flicker)
  let barHeights = IDLE_HEIGHTS.slice();

  // Bars are filled capsules (two arcs) instead of stroked lines: a zero-length
  // stroked line is not drawn by every browser, a filled capsule always is.
  function drawBars(heights) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = BAR_WIDTH / 2;

    ctx.fillStyle = barColor();

    for (let i = 0; i < BAR_COUNT; i++) {
      const x = centerX + (i - (BAR_COUNT - 1) / 2) * (BAR_WIDTH + BAR_GAP);
      const half = Math.max(heights[i] - BAR_WIDTH, 0) / 2;

      ctx.beginPath();
      ctx.arc(x, centerY - half, radius, Math.PI, 0);
      ctx.arc(x, centerY + half, radius, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Resting state
  function drawStaticIcon() {
    barHeights = IDLE_HEIGHTS.slice();
    drawBars(barHeights);
  }

  // Average of a slice of the frequency data, 0..1
  function bandLevel(from, to) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += dataArray[i];
    return sum / (to - from) / 255;
  }

  // Each bar follows its own slice of the spectrum
  function visualize() {
    if (!isPlaying) return;

    animationId = requestAnimationFrame(visualize);

    if (analyser) {
      analyser.getByteFrequencyData(dataArray);

      // The part of the spectrum where this track has energy
      // (about 0-2kHz at 86Hz per bin), split across the four bars
      const levels = [
        bandLevel(0, 3),
        bandLevel(3, 7),
        bandLevel(7, 13),
        bandLevel(13, 25)
      ];
      const gains = [0.9, 1.0, 1.3, 2.0];

      for (let i = 0; i < BAR_COUNT; i++) {
        const target = MIN_HEIGHT + Math.min(1, levels[i] * gains[i]) * (MAX_HEIGHTS[i] - MIN_HEIGHT);
        barHeights[i] += (target - barHeights[i]) * FOLLOW_SPEED;
      }

      drawBars(barHeights);
    }
  }
  
  // Stop visualization
  function stopVisualization() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    // Draw static icon
    drawStaticIcon();
  }
  
  // Initialize static icon
  drawStaticIcon();

  // Redraw on theme change (the playing loop repaints itself each frame)
  new MutationObserver(function() {
    if (!isPlaying) drawStaticIcon();
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  
  // Toggle music play/pause
  musicToggle.addEventListener('click', function() {
    console.log('Music toggle clicked, isPlaying:', isPlaying);
    
    if (isPlaying) {
      audioPlayer.pause();
      isPlaying = false;
      stopVisualization();
      console.log('Music paused');
    } else {
      // Set volume to a reasonable level (30%)
      audioPlayer.volume = 0.3;
      
      // Initialize audio context on user interaction
      if (!audioContext) {
        initAudioVisualizer();
      }
      
      // Resume audio context if suspended
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
      }
      
      audioPlayer.play().then(() => {
        isPlaying = true;
        console.log('Music playing, starting visualization');
        
        // Start visualization
        if (audioContext) {
          visualize();
        }
      }).catch(error => {
        console.error('Audio playback failed:', error);
        alert('Unable to play audio. Please check if the file exists and try again.');
      });
    }
  });
  
  // Handle audio errors
  audioPlayer.addEventListener('error', function(e) {
    console.error('Audio error:', e);
    console.error('Audio error code:', audioPlayer.error);
    
    if (audioPlayer.error) {
      switch(audioPlayer.error.code) {
        case audioPlayer.error.MEDIA_ERR_ABORTED:
          console.error('Audio playback was aborted');
          break;
        case audioPlayer.error.MEDIA_ERR_NETWORK:
          console.error('Network error occurred while loading audio');
          break;
        case audioPlayer.error.MEDIA_ERR_DECODE:
          console.error('Audio decoding error - format may not be supported');
          alert('Audio format not supported. Please check the file format.');
          break;
        case audioPlayer.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          console.error('Audio source not supported');
          alert('Audio file not found or format not supported. Please check the file path and format.');
          break;
        default:
          console.error('Unknown audio error');
      }
    }
  });
  
  // Update canvas when audio ends (though it's set to loop)
  audioPlayer.addEventListener('ended', function() {
    stopVisualization();
    isPlaying = false;
  });
  
  // Optional: Keyboard shortcut (Space to toggle)
  document.addEventListener('keydown', function(e) {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      musicToggle.click();
    }
  });
});
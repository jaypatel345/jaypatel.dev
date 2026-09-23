// Music Player with Circular 3D Audio Visualizer
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


  // Muted ring color (gray), glyph stays full theme color
  function ringColor() {
    return document.body.classList.contains('dark-mode')
      ? 'rgba(229, 229, 229, 0.4)'
      : 'rgba(0, 0, 0, 0.3)';
  }

  function themeColor() {
    return document.body.classList.contains('dark-mode') ? '#e5e5e5' : '#000000';
  }

  // Center play / pause glyph
  function drawGlyph(cx, cy, color) {
    ctx.fillStyle = color;
    if (isPlaying) {
      ctx.fillRect(cx - 6, cy - 7, 4, 14);
      ctx.fillRect(cx + 2, cy - 7, 4, 14);
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - 4.5, cy - 8);
      ctx.lineTo(cx + 8, cy);
      ctx.lineTo(cx - 4.5, cy + 8);
      ctx.closePath();
      ctx.fill();
    }
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
      
      analyser.fftSize = 128;
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      
      console.log('Audio visualizer initialized successfully');
    } catch (error) {
      console.error('Audio visualizer initialization failed:', error);
    }
  }
  
  // Draw static icon: plain circle + play/pause glyph
  function drawStaticIcon() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const strokeColor = themeColor();

    const radius = 26;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = ringColor();
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawGlyph(centerX, centerY, strokeColor);
  }

  // Circular visualization (black only, no movement)
  function visualize() {
    if (!isPlaying) return;
    
    animationId = requestAnimationFrame(visualize);
    
    if (analyser) {
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = 21;
      const barCount = 32;
      
      // Get theme color for better visibility
      const strokeColor = ringColor();
      
      // Use frequency data for circular visualization
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2;
        
        // Get frequency value for this bar
        const dataIndex = Math.floor((i / barCount) * dataArray.length);
        const frequencyValue = dataArray[dataIndex];
        
        // Calculate bar length based on frequency
        const barLength = 4 + (frequencyValue / 255) * 22;
        
        // Fixed radius (no 3D movement)
        const radius = baseRadius;
        
        const x1 = centerX + Math.cos(angle) * radius;
        const y1 = centerY + Math.sin(angle) * radius;
        const x2 = centerX + Math.cos(angle) * (radius + barLength);
        const y2 = centerY + Math.sin(angle) * (radius + barLength);
        
        // Theme color (black or white based on mode)
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Pause glyph, no glow / no backing circle
      drawGlyph(centerX, centerY, themeColor());
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
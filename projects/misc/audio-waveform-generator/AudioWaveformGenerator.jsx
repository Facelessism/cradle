// projects/misc/audio-waveform-generator/AudioWaveformGenerator.jsx

const drawWaveform = useCallback(() => {
  if (!canvasRef.current || !analyserRef.current) return;
  
  // Check user preference for reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    // Render a static placeholder state instead of a continuous loop
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const canvas = canvasRef.current;
  const ctx = canvas.getContext('2d');
  const analyser = analyserRef.current;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const render = () => {
    animationIdRef.current = requestAnimationFrame(render);
    analyser.getByteFrequencyData(dataArray);
    // ... standard rendering logic ...
  };

  render();
}, []);

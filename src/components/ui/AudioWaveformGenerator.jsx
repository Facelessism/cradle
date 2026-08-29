import React, { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, RotateCcw, Upload, Volume2 } from "lucide-react";

export default function AudioWaveformGenerator() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioSource, setAudioSource] = useState(null);
  const [fileName, setFileName] = useState("No audio selected");
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const audioElementRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const animationIdRef = useRef(null);

  // Safe and idempotent resource cleanup
  const cleanupAudioResources = useCallback(() => {
    if (animationIdRef.current) {
      try {
        cancelAnimationFrame(animationIdRef.current);
      } catch (err) {
        console.error("Error cancelling animation frame:", err);
      }
      animationIdRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (err) {
        // Safe disconnection fallback
      }
      sourceNodeRef.current = null;
    }

    if (audioCtxRef.current) {
      try {
        if (
          audioCtxRef.current.state !== "closed" &&
          typeof audioCtxRef.current.close === "function"
        ) {
          audioCtxRef.current.close().catch(err => {
            console.error("Failed to close AudioContext during cleanup:", err);
          });
        }
      } catch (err) {
        console.error("Error closing AudioContext:", err);
      }
      audioCtxRef.current = null;
    }

    analyserRef.current = null;
  }, []);

  // Initialize Web Audio API safely
  const initAudioContext = () => {
    try {
      if (error) return false;
      if (!audioCtxRef.current) {
        const AudioContextClass =
          typeof window !== "undefined" &&
          (window.AudioContext || window.webkitAudioContext);
        if (!AudioContextClass) {
          throw new Error("Web Audio API is not supported in this browser.");
        }
        audioCtxRef.current = new AudioContextClass();
        analyserRef.current = audioCtxRef.current.createAnalyser();
        if (analyserRef.current) {
          analyserRef.current.fftSize = 256;
        }
      }
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().catch(err => {
          console.error("Failed to resume AudioContext:", err);
          setError("Failed to initialize the audio environment.");
        });
      }
      return true;
    } catch (err) {
      console.error("Failed to initialize AudioContext:", err);
      setError("Audio environment failed to initialize or is unsupported.");
      cleanupAudioResources();
      return false;
    }
  };

  // Handle File Upload
  const handleFileUpload = e => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    const url = URL.createObjectURL(file);
    setAudioSource(url);
    setIsPlaying(false);

    if (audioElementRef.current) {
      try {
        audioElementRef.current.pause();
        audioElementRef.current.src = url;
      } catch (err) {
        console.error("Failed to set source on audio element:", err);
      }
    }
  };

  // Draw Waveform Visualizer on Canvas
  const drawWaveform = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const analyser = analyserRef.current;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      if (!analyserRef.current) return;
      animationIdRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      // Handle high-DPI crisp rendering
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (
        canvas.width !== rect.width * dpr ||
        canvas.height !== rect.height * dpr
      ) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
      }

      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // Draw background container
      ctx.fillStyle =
        getComputedStyle(canvas).getPropertyValue("--bg-surface") || "#18181b";
      ctx.fillRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height;

        // Cradle brand accent gradient
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, "rgba(147, 51, 234, 0.4)");
        gradient.addColorStop(1, "rgba(168, 85, 247, 0.9)");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    render();
  }, []);

  // Play / Pause Controls
  const togglePlay = async () => {
    const success = initAudioContext();
    if (!success || error) return;
    if (!audioSource && !audioElementRef.current?.src) return;

    if (!sourceNodeRef.current && audioElementRef.current) {
      try {
        sourceNodeRef.current = audioCtxRef.current.createMediaElementSource(
          audioElementRef.current
        );
        sourceNodeRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
      } catch (err) {
        console.error("Failed to create media element source:", err);
      }
    }

    if (isPlaying) {
      try {
        audioElementRef.current?.pause();
      } catch (err) {
        console.error("Failed to pause audio element:", err);
      }
      setIsPlaying(false);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    } else {
      try {
        await audioElementRef.current?.play();
        setIsPlaying(true);
        drawWaveform();
      } catch (err) {
        console.error("Failed to play audio element:", err);
        setError("Audio playback failed.");
      }
    }
  };

  // Volume Control
  const handleVolumeChange = e => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioElementRef.current) {
      audioElementRef.current.volume = val;
    }
  };

  // Proactive browser support detection on mount and safe unmount cleanup
  useEffect(() => {
    const AudioContextClass =
      typeof window !== "undefined" &&
      (window.AudioContext || window.webkitAudioContext);
    if (!AudioContextClass) {
      setError("Web Audio API is not supported in this browser.");
    }
    return () => {
      cleanupAudioResources();
    };
  }, [cleanupAudioResources]);

  const handleRetry = () => {
    setError(null);
    cleanupAudioResources();
  };

  if (error) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl text-zinc-100">
        <div className="flex flex-col items-center justify-center text-center p-8 bg-zinc-950 rounded-lg border border-zinc-800">
          <div className="p-3 bg-red-900/20 text-red-400 rounded-full mb-4">
            <Volume2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold mb-2">
            Audio Waveform Generator Error
          </h3>
          <p className="text-zinc-400 text-sm max-w-md mb-6">{error}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer min-h-[40px] flex items-center justify-center"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl text-zinc-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            Audio Waveform Generator
          </h2>
          <p className="text-sm text-zinc-400 truncate max-w-xs sm:max-w-md">
            {fileName}
          </p>
        </div>

        {/* Upload Button */}
        <label className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-sm font-medium rounded-lg cursor-pointer transition-colors shadow-sm min-h-[44px]">
          <Upload className="w-4 h-4" />
          <span>Upload Audio</span>
          <input
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioElementRef}
        onEnded={() => {
          setIsPlaying(false);
          if (animationIdRef.current)
            cancelAnimationFrame(animationIdRef.current);
        }}
      />

      {/* Waveform Canvas Container */}
      <div className="relative w-full h-48 sm:h-64 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 mb-6 shadow-inner">
        <canvas ref={canvasRef} className="w-full h-full block" />
        {!audioSource && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">
            Upload an audio file or record to visualize waveform
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-950/50 p-4 rounded-lg border border-zinc-800/80">
        <div className="flex items-center gap-3 w-full sm:w-auto justify-center">
          <button
            onClick={togglePlay}
            disabled={!audioSource}
            className="p-3 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-full transition-all shadow-md min-w-[48px] min-h-[48px] flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          <button
            onClick={() => {
              if (audioElementRef.current) {
                try {
                  audioElementRef.current.currentTime = 0;
                  if (!isPlaying) togglePlay();
                } catch (err) {
                  console.error("Failed to restart audio element:", err);
                }
              }
            }}
            disabled={!audioSource}
            className="p-3 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-700 text-zinc-200 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
            aria-label="Restart"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Volume Slider */}
        <div className="flex items-center gap-3 w-full sm:w-48 justify-end">
          <Volume2 className="w-4 h-4 text-zinc-400" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full accent-purple-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
            aria-label="Volume controller"
          />
        </div>
      </div>
    </div>
  );
}

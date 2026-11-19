import { AudioProcessor } from "./audio-processor.js";
import { SpectrogramVisualizer } from "./visualizer.js";

/**
 * Application Controller
 * Wires UI events to AudioProcessor, Visualizer, and MediaRecorder.
 */
document.addEventListener("DOMContentLoaded", () => {
  const audioProcessor = new AudioProcessor();
  const visualizer = new SpectrogramVisualizer("spectrogram-canvas");

  const btnMic = document.getElementById("btn-mic");
  const btnFile = document.getElementById("btn-file");
  const fileInput = document.getElementById("file-input");
  const btnRecord = document.getElementById("btn-record");
  const btnStopRecord = document.getElementById("btn-stop-record");
  const fftSelect = document.getElementById("fft-size");
  const scaleSelect = document.getElementById("scale-select");

  // Tuner & Harmonic HUD elements
  const tunerNote = document.getElementById("tuner-note");
  const tunerFreq = document.getElementById("tuner-freq");
  const tunerCentsText = document.getElementById("tuner-cents-text");
  const tunerNeedle = document.getElementById("tuner-needle");
  const tunerTrack = document.getElementById("tuner-meter-track");
  const harmonicsChips = document.getElementById("harmonics-chips");

  // Hover Tooltip elements
  const tooltip = document.getElementById("spectrogram-tooltip");
  const tooltipFreq = document.getElementById("tooltip-freq");
  const tooltipDb = document.getElementById("tooltip-db");
  const tooltipPitch = document.getElementById("tooltip-pitch");

  // Wire real-time pitch detection & tuning meter callback
  visualizer.onPitchUpdate = pitchResult => {
    if (pitchResult && pitchResult.freq > 0 && pitchResult.noteInfo) {
      const { note, exactFreq, cents, inTune } = pitchResult.noteInfo;
      if (tunerNote) {
        tunerNote.textContent = note;
        tunerNote.classList.toggle("in-tune", inTune);
      }
      if (tunerFreq) {
        tunerFreq.textContent = `F₀: ${pitchResult.freq} Hz (exact ${exactFreq} Hz)`;
      }

      const clampedCents = Math.max(-50, Math.min(50, cents));
      const percent = 50 + (clampedCents / 50) * 50;

      if (tunerNeedle) {
        tunerNeedle.style.left = `${percent}%`;
        tunerNeedle.classList.toggle("in-tune", inTune);
      }
      if (tunerTrack) {
        tunerTrack.setAttribute("aria-valuenow", String(clampedCents));
      }

      if (tunerCentsText) {
        const sign = cents > 0 ? "+" : "";
        tunerCentsText.textContent = inTune
          ? `${sign}${cents}¢ · In Tune!`
          : cents < 0
            ? `${cents}¢ · Flat`
            : `+${cents}¢ · Sharp`;
        tunerCentsText.classList.toggle("in-tune", inTune);
      }

      // Update harmonic peaks chips
      if (harmonicsChips) {
        const harmonics = audioProcessor.getHarmonicPeaks(
          pitchResult.freq,
          4
        );
        if (harmonics.length > 0) {
          harmonicsChips.innerHTML = harmonics
            .map(
              h => `
            <span class="harmonics-chip" title="Harmonic ${h.harmonic}: ${h.freq} Hz (${h.dB} dBFS)">
              <strong>${h.harmonic === 1 ? "F₀" : `${h.harmonic}×`}</strong>
              <span>${Math.round(h.freq)} Hz</span>
              <span style="opacity:0.75">(${Math.round(h.dB)} dB)</span>
            </span>
          `
            )
            .join("");
        }
      }
    } else {
      if (tunerNote) {
        tunerNote.textContent = "--";
        tunerNote.classList.remove("in-tune");
      }
      if (tunerFreq) {
        tunerFreq.textContent = "F₀: -- Hz";
      }
      if (tunerNeedle) {
        tunerNeedle.style.left = "50%";
        tunerNeedle.classList.remove("in-tune");
      }
      if (tunerTrack) {
        tunerTrack.setAttribute("aria-valuenow", "0");
      }
      if (tunerCentsText) {
        tunerCentsText.textContent = visualizer.isRunning
          ? "Listening for pitch..."
          : "Awaiting Audio Input...";
        tunerCentsText.classList.remove("in-tune");
      }
      if (harmonicsChips) {
        harmonicsChips.innerHTML =
          '<span class="chip-idle">No harmonic peaks tracked</span>';
      }
    }
  };

  // Wire interactive spectrogram hover cursor tooltip
  visualizer.onHoverUpdate = hover => {
    if (!tooltip) return;

    if (hover && hover.active) {
      tooltip.hidden = false;
      if (tooltipFreq) tooltipFreq.textContent = `${hover.freq} Hz`;
      if (tooltipDb) tooltipDb.textContent = `${hover.dB} dBFS`;
      if (tooltipPitch) {
        if (hover.noteInfo) {
          const sign = hover.noteInfo.cents > 0 ? "+" : "";
          tooltipPitch.textContent = `${hover.noteInfo.note} (${sign}${hover.noteInfo.cents}¢)`;
        } else {
          tooltipPitch.textContent = "--";
        }
      }
    } else {
      tooltip.hidden = true;
    }
  };

  let mediaRecorder = null;
  let recordedChunks = [];

  btnMic.addEventListener("click", async () => {
    const success = await audioProcessor.startMicrophone();
    if (success) {
      btnRecord.disabled = false;
      visualizer.start(audioProcessor);
    }
  });

  btnFile.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (file) {
      const success = await audioProcessor.loadAudioFile(file);
      if (success) {
        btnRecord.disabled = false;
        visualizer.start(audioProcessor);
      }
    }
  });

  fftSelect.addEventListener("change", e => {
    audioProcessor.setFFTSize(e.target.value);
  });

  if (scaleSelect) {
    scaleSelect.addEventListener("change", e => {
      visualizer.setScale(e.target.value);
    });
  }

  btnRecord.addEventListener("click", () => {
    const stream = audioProcessor.getRecordingStream();
    if (!stream) return;

    recordedChunks = [];
    // Prefer webm, fallback to mp4 or default
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "audio/mp4";
    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `spectrogram-recording-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    };

    mediaRecorder.start();
    btnRecord.disabled = true;
    btnStopRecord.disabled = false;
  });

  btnStopRecord.addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      btnRecord.disabled = false;
      btnStopRecord.disabled = true;
    }
  });

  // Handle page unload to stop audio contexts cleanly
  window.addEventListener("beforeunload", () => {
    audioProcessor.destroy();
    visualizer.destroy();
  });
  window.addEventListener("unload", () => {
    audioProcessor.destroy();
    visualizer.destroy();
  });
});

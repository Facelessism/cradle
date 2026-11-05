/**
 * Audio Processor
 * Manages Web Audio API context, AnalyserNode, and media stream routing.
 */
export class AudioProcessor {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.mediaStream = null;
    this.audioElement = null;
    this.destination = null; // For recording
    this.objectUrl = null;
    this.cachedFrequencyData = null;
  }

  async init() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error("Web Audio API not supported");
    this.audioContext = new AudioContext();
    this.destination = this.audioContext.createMediaStreamDestination();
  }

  async resumeContext() {
    if (!this.audioContext) await this.init();
    if (this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
        const banner = document.getElementById("error-banner");
        if (banner && banner.dataset.audioBlocked) {
          banner.hidden = true;
          delete banner.dataset.audioBlocked;
        }
        return true;
      } catch (err) {
        console.warn("AudioContext resume failed:", err);
        const banner = document.getElementById("error-banner");
        if (banner) {
          banner.dataset.audioBlocked = "true";
          banner.textContent =
            "Audio playback is blocked by your browser. Click here to enable audio.";
          banner.hidden = false;
          banner.style.cursor = "pointer";
          banner.onclick = async () => {
            try {
              await this.audioContext.resume();
              banner.hidden = true;
              delete banner.dataset.audioBlocked;
            } catch (e) {
              console.error("Resume retry failed:", e);
            }
          };
        }
        return false;
      }
    }
    return true;
  }

  async startMicrophone() {
    if (!this.audioContext) await this.init();
    await this.resumeContext();

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      this.stop();
      this.mediaStream = stream;
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.setupAnalyser();
      return true;
    } catch (err) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      console.error("Microphone access denied:", err);
      const banner = document.getElementById("error-banner");
      if (banner) {
        banner.hidden = false;
      }
      return false;
    }
  }

  async validateAudioFile(file) {
    if (!file) {
      return { valid: false, error: "No audio file provided." };
    }

    if (
      typeof globalThis !== "undefined" &&
      globalThis.CradleMediaValidator &&
      typeof globalThis.CradleMediaValidator.validateAudioBlob === "function"
    ) {
      return await globalThis.CradleMediaValidator.validateAudioBlob(file);
    }

    const type = (file.type || "").trim().toLowerCase();
    if (
      type &&
      !type.startsWith("audio/") &&
      type !== "video/webm" &&
      type !== "video/mp4"
    ) {
      return {
        valid: false,
        error: `Unsupported MIME type: "${type}". Please select a valid audio file.`,
      };
    }

    if (typeof file.slice === "function") {
      try {
        const slice = file.slice(0, 32);
        const buffer = await slice.arrayBuffer();
        const b = new Uint8Array(buffer);
        if (b.length < 2) {
          return { valid: false, error: "Audio file is empty or corrupted." };
        }

        const isWav =
          b.length >= 12 &&
          b[0] === 0x52 &&
          b[1] === 0x49 &&
          b[2] === 0x46 &&
          b[3] === 0x46 &&
          b[8] === 0x57 &&
          b[9] === 0x41 &&
          b[10] === 0x56 &&
          b[11] === 0x45;

        const isMp3Id3 =
          b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33;

        const isMp3Sync =
          b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0;

        const isOgg =
          b.length >= 4 &&
          b[0] === 0x4f &&
          b[1] === 0x67 &&
          b[2] === 0x67 &&
          b[3] === 0x53;

        const isFlac =
          b.length >= 4 &&
          b[0] === 0x66 &&
          b[1] === 0x4c &&
          b[2] === 0x61 &&
          b[3] === 0x43;

        const isWebM =
          b.length >= 4 &&
          b[0] === 0x1a &&
          b[1] === 0x45 &&
          b[2] === 0xdf &&
          b[3] === 0xa3;

        const isMp4 =
          b.length >= 8 &&
          b[4] === 0x66 &&
          b[5] === 0x74 &&
          b[6] === 0x79 &&
          b[7] === 0x70;

        if (
          !isWav &&
          !isMp3Id3 &&
          !isMp3Sync &&
          !isOgg &&
          !isFlac &&
          !isWebM &&
          !isMp4
        ) {
          return {
            valid: false,
            error:
              "File signature does not match any supported audio format (WAV, MP3, OGG, FLAC, WebM).",
          };
        }
      } catch (err) {
        return { valid: false, error: "Failed to read audio file header." };
      }
    }

    return { valid: true };
  }

  async loadAudioFile(file) {
    if (!file) return false;

    const validation = await this.validateAudioFile(file);
    if (!validation.valid) {
      console.error("Audio validation failed:", validation.error);
      const banner = document.getElementById("error-banner");
      if (banner) {
        banner.textContent =
          validation.error ||
          "Invalid audio file. Please select a valid audio file (WAV, MP3, OGG, FLAC).";
        banner.hidden = false;
      }
      return false;
    }

    if (!this.audioContext) await this.init();
    await this.resumeContext();

    this.stop(); // Clean up previous
    this.objectUrl = URL.createObjectURL(file);
    this.audioElement = new Audio();
    this.audioElement.src = this.objectUrl;
    this.audioElement.loop = true;

    this.source = this.audioContext.createMediaElementSource(this.audioElement);
    this.setupAnalyser();
    this.audioElement.play();
    return true;
  }

  setupAnalyser() {
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.cachedFrequencyData = null;

    // Connect source to analyser, and analyser to both destination (recording) and speakers
    this.source.connect(this.analyser);
    this.analyser.connect(this.destination);
    this.analyser.connect(this.audioContext.destination);
  }

  setFFTSize(size) {
    if (this.analyser) {
      this.analyser.fftSize = parseInt(size, 10);
      this.cachedFrequencyData = null;
    }
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(0);
    const binCount = this.analyser.frequencyBinCount;
    if (
      !this.cachedFrequencyData ||
      this.cachedFrequencyData.length !== binCount
    ) {
      this.cachedFrequencyData = new Uint8Array(binCount);
    }
    this.analyser.getByteFrequencyData(this.cachedFrequencyData);
    return this.cachedFrequencyData;
  }

  getRecordingStream() {
    return this.destination ? this.destination.stream : null;
  }

  getSampleRate() {
    return this.audioContext ? this.audioContext.sampleRate : 44100;
  }

  getMinDecibels() {
    return this.analyser ? this.analyser.minDecibels : -100;
  }

  getMaxDecibels() {
    return this.analyser ? this.analyser.maxDecibels : -30;
  }

  getDecibelRange() {
    return {
      minDecibels: this.getMinDecibels(),
      maxDecibels: this.getMaxDecibels(),
    };
  }

  getPeakDecibels() {
    if (!this.cachedFrequencyData || this.cachedFrequencyData.length === 0) {
      return this.getMinDecibels();
    }
    let maxByte = 0;
    for (let i = 0; i < this.cachedFrequencyData.length; i++) {
      if (this.cachedFrequencyData[i] > maxByte) {
        maxByte = this.cachedFrequencyData[i];
      }
    }
    const minDb = this.getMinDecibels();
    const maxDb = this.getMaxDecibels();
    return minDb + (maxByte / 255) * (maxDb - minDb);
  }

  stop() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = "";
      this.audioElement = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {
        // Ignore if already disconnected
      }
      this.source = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (e) {
        // Ignore if already disconnected
      }
      this.analyser = null;
    }
    this.cachedFrequencyData = null;
  }

  async destroy() {
    this.stop();
    if (this.audioContext) {
      const ctx = this.audioContext;
      this.audioContext = null;
      try {
        if (ctx.state !== "closed" && typeof ctx.close === "function") {
          await ctx.close();
        }
      } catch (err) {
        console.warn("Error closing AudioContext:", err);
      }
    }
    this.destination = null;
    this.cachedFrequencyData = null;
  }
}

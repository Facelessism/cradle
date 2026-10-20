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
    this.frequencyData = null;
  }

  async init() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error("Web Audio API not supported");
    this.audioContext = new AudioContext();
    this.destination = this.audioContext.createMediaStreamDestination();
  }

  async startMicrophone() {
    if (!this.audioContext) await this.init();
    if (this.audioContext.state === "suspended")
      await this.audioContext.resume();

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    } catch (err) {
      console.error("Microphone access denied:", err);
      document.getElementById("error-banner").hidden = false;
      return false;
    }

    // Release the previous source only after the new capture is approved.
    this.stop();
    this.mediaStream = stream;

    try {
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.setupAnalyser();
      return true;
    } catch (err) {
      console.error("Could not start microphone processing:", err);
      this.stop();
      document.getElementById("error-banner").hidden = false;
      return false;
    }
  }

  async loadAudioFile(file) {
    if (!this.audioContext) await this.init();
    if (this.audioContext.state === "suspended")
      await this.audioContext.resume();

    this.stop(); // Clean up previous
    this.audioElement = new Audio();
    this.objectUrl = URL.createObjectURL(file);
    this.audioElement.src = this.objectUrl;
    this.audioElement.loop = true;

    this.source = this.audioContext.createMediaElementSource(this.audioElement);
    this.setupAnalyser();

    try {
      await this.audioElement.play();
    } catch (err) {
      console.error("Could not play audio file:", err);
      this.stop();
      return false;
    }
    return true;
  }

  setupAnalyser() {
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.frequencyData = null;

    // Connect source to analyser, and analyser to both destination (recording) and speakers
    this.source.connect(this.analyser);
    this.analyser.connect(this.destination);
    this.analyser.connect(this.audioContext.destination);
  }

  setFFTSize(size) {
    if (this.analyser) {
      this.analyser.fftSize = parseInt(size, 10);
      this.frequencyData = null;
    }
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(0);

    if (
      !this.frequencyData ||
      this.frequencyData.length !== this.analyser.frequencyBinCount
    ) {
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  getRecordingStream() {
    return this.destination ? this.destination.stream : null;
  }

  stop() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.removeAttribute("src");
      this.audioElement.load();
      this.audioElement = null;
    }

    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    this.frequencyData = null;
  }

  async destroy() {
    this.stop();

    if (this.audioContext) {
      const context = this.audioContext;
      this.audioContext = null;
      this.destination = null;

      try {
        await context.close();
      } catch (err) {
        console.warn("Could not close audio context:", err);
      }
    }
  }
}

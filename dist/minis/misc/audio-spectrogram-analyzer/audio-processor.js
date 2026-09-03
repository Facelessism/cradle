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
    }

    async init() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) throw new Error('Web Audio API not supported');
        this.audioContext = new AudioContext();
        this.destination = this.audioContext.createMediaStreamDestination();
    }

    async startMicrophone() {
        if (!this.audioContext) await this.init();
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.setupAnalyser();
            return true;
        } catch (err) {
            console.error('Microphone access denied:', err);
            document.getElementById('error-banner').hidden = false;
            return false;
        }
    }

    async loadAudioFile(file) {
        if (!this.audioContext) await this.init();
        if (this.audioContext.state === 'suspended') await this.audioContext.resume();

        this.stop(); // Clean up previous
        this.audioElement = new Audio();
        this.audioElement.src = URL.createObjectURL(file);
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

        // Connect source to analyser, and analyser to both destination (recording) and speakers
        this.source.connect(this.analyser);
        this.analyser.connect(this.destination);
        this.analyser.connect(this.audioContext.destination);
    }

    setFFTSize(size) {
        if (this.analyser) {
            this.analyser.fftSize = parseInt(size, 10);
        }
    }

    getFrequencyData() {
        if (!this.analyser) return new Uint8Array(0);
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
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
            this.audioElement = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
    }
}

import { AudioProcessor } from './audio-processor.js';
import { SpectrogramVisualizer } from './visualizer.js';

/**
 * Application Controller
 * Wires UI events to AudioProcessor, Visualizer, and MediaRecorder.
 */
document.addEventListener('DOMContentLoaded', () => {
    const audioProcessor = new AudioProcessor();
    const visualizer = new SpectrogramVisualizer('spectrogram-canvas');

    const btnMic = document.getElementById('btn-mic');
    const btnFile = document.getElementById('btn-file');
    const fileInput = document.getElementById('file-input');
    const btnRecord = document.getElementById('btn-record');
    const btnStopRecord = document.getElementById('btn-stop-record');
    const fftSelect = document.getElementById('fft-size');

    let mediaRecorder = null;
    let recordedChunks = [];

    btnMic.addEventListener('click', async () => {
        const success = await audioProcessor.startMicrophone();
        if (success) {
            btnRecord.disabled = false;
            visualizer.start(audioProcessor);
        }
    });

    btnFile.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const success = await audioProcessor.loadAudioFile(file);
            if (success) {
                btnRecord.disabled = false;
                visualizer.start(audioProcessor);
            }
        }
    });

    fftSelect.addEventListener('change', (e) => {
        audioProcessor.setFFTSize(e.target.value);
    });

    btnRecord.addEventListener('click', () => {
        const stream = audioProcessor.getRecordingStream();
        if (!stream) return;

        recordedChunks = [];
        // Prefer webm, fallback to mp4 or default
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        mediaRecorder = new MediaRecorder(stream, { mimeType });

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
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

    btnStopRecord.addEventListener('click', () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            btnRecord.disabled = false;
            btnStopRecord.disabled = true;
        }
    });

    // Handle page unload to stop audio contexts cleanly
    window.addEventListener('beforeunload', () => {
        audioProcessor.stop();
        visualizer.stop();
    });
});

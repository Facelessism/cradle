import { DrawingEngine } from './drawing-engine.js';
import { StateSync } from './state-sync.js';

/**
 * WebRTC Manager
 * Handles PeerConnection, DataChannel, and manual SDP exchange.
 */
class WebRTCManager {
    constructor() {
        this.pc = null;
        this.dataChannel = null;
        this.initPeerConnection();
    }

    initPeerConnection() {
        const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        this.pc = new RTCPeerConnection(config);

        this.pc.onicecandidate = (event) => {
            if (event.candidate === null) {
                // ICE gathering complete, SDP is ready
                document.getElementById('local-sdp').value = JSON.stringify(this.pc.localDescription);
            }
        };

        this.pc.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel();
        };

        this.pc.onconnectionstatechange = () => {
            const statusEl = document.getElementById('connection-status');
            statusEl.textContent = `Status: ${this.pc.connectionState}`;
            if (this.pc.connectionState === 'connected') {
                statusEl.classList.add('connected');
            } else {
                statusEl.classList.remove('connected');
            }
        };
    }

    setupDataChannel() {
        this.dataChannel.onopen = () => console.log('Data channel opened');
        this.dataChannel.onmessage = (event) => {
            const command = JSON.parse(event.data);
            window.stateSync.handleIncomingCommand(command);
        };
    }

    createOffer() {
        this.dataChannel = this.pc.createDataChannel('whiteboard');
        this.setupDataChannel();
        this.pc.createOffer().then(offer => this.pc.setLocalDescription(offer));
    }

    async acceptConnection() {
        const remoteSdpStr = document.getElementById('remote-sdp').value;
        if (!remoteSdpStr) return alert('Please paste remote SDP first');

        const remoteDesc = JSON.parse(remoteSdpStr);
        await this.pc.setRemoteDescription(remoteDesc);

        if (remoteDesc.type === 'offer') {
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            // Wait for ICE to finish, then local-sdp will update automatically via onicecandidate
        }
    }

    sendData(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(data));
        }
    }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    const engine = new DrawingEngine('whiteboard-canvas');
    const webrtc = new WebRTCManager();
    window.stateSync = new StateSync(engine, webrtc); // Expose for engine hooks

    // UI Bindings
    const colorPicker = document.getElementById('color-picker');
    const brushSize = document.getElementById('brush-size');
    const brushDisplay = document.getElementById('brush-size-display');

    // Hook into drawing engine to broadcast
    const originalDraw = engine.draw.bind(engine);
    engine.draw = function (e) {
        const coords = this.getCoordinates(e);
        // We need previous coords, which are lastX, lastY
        originalDraw(e);
        window.stateSync.broadcastDraw(this.lastX, this.lastY, coords.x, coords.y, this.color, this.lineWidth);
        // Note: In a real app, we'd batch these or use a more robust interpolation. 
        // For this prototype, we send each segment.
    };

    // Override clear to broadcast
    const originalClear = engine.clear.bind(engine);
    engine.clear = function () {
        originalClear();
        window.stateSync.broadcastClear();
    };

    colorPicker.addEventListener('input', (e) => engine.setBrush(e.target.value, brushSize.value));
    brushSize.addEventListener('input', (e) => {
        engine.setBrush(colorPicker.value, e.target.value);
        brushDisplay.textContent = `${e.target.value}px`;
    });

    document.getElementById('btn-undo').addEventListener('click', () => {
        if (engine.undo()) window.stateSync.broadcastUndo();
    });

    document.getElementById('btn-redo').addEventListener('click', () => engine.redo());
    document.getElementById('btn-clear').addEventListener('click', () => engine.clear());

    document.getElementById('btn-create-offer').addEventListener('click', () => webrtc.createOffer());
    document.getElementById('btn-accept').addEventListener('click', () => webrtc.acceptConnection());

    document.getElementById('btn-copy-local').addEventListener('click', () => {
        const sdp = document.getElementById('local-sdp');
        sdp.select();
        document.execCommand('copy');
    });
});

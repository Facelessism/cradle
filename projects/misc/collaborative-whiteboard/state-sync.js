/**
 * State Synchronization Manager
 * Serializes drawing actions and manages the command queue for WebRTC transmission.
 */
export class StateSync {
    constructor(drawingEngine, webrtcManager) {
        this.engine = drawingEngine;
        this.webrtc = webrtcManager;
        this.isRemoteAction = false;

        // Intercept local actions to broadcast
        this.setupInterceptors();
    }

    setupInterceptors() {
        // We hook into the engine's drawing by wrapping methods or listening to custom events.
        // For simplicity, we'll add a broadcast method that the engine calls, or we monitor canvas changes.
        // Better approach: The engine calls `sync.broadcastDraw(...)`
    }

    broadcastDraw(x1, y1, x2, y2, color, width) {
        if (this.isRemoteAction) return; // Prevent echo

        const command = {
            type: 'DRAW',
            payload: { x1, y1, x2, y2, color, width },
            timestamp: Date.now()
        };
        this.webrtc.sendData(command);
    }

    broadcastClear() {
        if (this.isRemoteAction) return;
        this.webrtc.sendData({ type: 'CLEAR', timestamp: Date.now() });
    }

    broadcastUndo() {
        if (this.isRemoteAction) return;
        // Undo is tricky in P2P without CRDTs. We'll broadcast a full state sync or just clear and redraw.
        // For this prototype, we broadcast the current canvas state as a 'SYNC' command.
        const dataUrl = this.engine.history[this.engine.historyStep];
        this.webrtc.sendData({ type: 'SYNC', payload: dataUrl, timestamp: Date.now() });
    }

    handleIncomingCommand(command) {
        this.isRemoteAction = true;

        switch (command.type) {
            case 'DRAW':
                const { x1, y1, x2, y2, color, width } = command.payload;
                this.engine.drawRemote(x1, y1, x2, y2, color, width);
                break;
            case 'CLEAR':
                this.engine.clearRemote();
                break;
            case 'SYNC':
                const img = new Image();
                img.src = command.payload;
                img.onload = () => {
                    this.engine.ctx.clearRect(0, 0, this.engine.canvas.width, this.engine.canvas.height);
                    this.engine.ctx.drawImage(img, 0, 0);
                    this.engine.saveState();
                };
                break;
        }

        this.isRemoteAction = false;
    }
}

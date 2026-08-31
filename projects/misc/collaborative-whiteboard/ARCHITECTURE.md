# P2P Collaborative Whiteboard

## Overview
A serverless, real-time collaborative drawing board utilizing WebRTC Data Channels for peer-to-peer state synchronization.

## Purpose & Goals
- Demonstrate serverless real-time communication using manual SDP exchange.
- Provide a smooth drawing experience with undo/redo capabilities.
- Maintain a clean separation between rendering logic and network synchronization.

## Folder Structure
```text
collaborative-whiteboard/
├── index.html          # UI layout with canvas, toolbar, and manual signaling inputs
├── style.css           # Responsive styling with light/dark mode
├── drawing-engine.js   # Canvas 2D rendering, brush logic, and local history stack
├── state-sync.js       # Command serialization and incoming message handling
├── webrtc-manager.js   # RTCPeerConnection setup, DataChannel management, and app initialization
└── ARCHITECTURE.md     # This documentation file
```

## Component Breakdown
| File | Responsibility |
|------|----------------|
| `drawing-engine.js` | Manages the HTML5 Canvas context, handles mouse/touch events, and maintains an array of `toDataURL` states for undo/redo. |
| `state-sync.js` | Acts as a middleware. Intercepts local drawing actions to broadcast them, and applies incoming remote commands to the engine. |
| `webrtc-manager.js` | Configures the `RTCPeerConnection` with a public STUN server, handles the `onicecandidate` event to finalize SDP, and manages the `RTCDataChannel`. |

## Data Flow
1. **Local Draw**: User moves mouse → `drawing-engine.js` renders line → `state-sync.js` intercepts and packages `{type: 'DRAW', payload: {x1, y1, x2, y2, color, width}}` → `webrtc-manager.js` sends via `dataChannel.send()`.
2. **Remote Draw**: `dataChannel.onmessage` receives JSON → `state-sync.js` parses and calls `engine.drawRemote()` → Canvas updates without adding to local undo history (preventing echo loops).
3. **Signaling**: Host clicks "Create Offer" → `webrtc-manager` generates SDP → User copies SDP and sends it via external means (e.g., chat) → Guest pastes SDP and clicks "Accept" → Guest generates Answer → Host pastes Answer (simplified here to auto-update if on same machine for testing, or manual copy back).

## Technologies Used
- HTML5 Canvas 2D API
- WebRTC (`RTCPeerConnection`, `RTCDataChannel`)
- Vanilla ES6+ JavaScript

## Known Limitations
- **Signaling**: Requires manual copy-pasting of SDP strings. A production app would use a WebSocket signaling server.
- **Undo/Redo Sync**: Undo broadcasts a full canvas state (`SYNC`) rather than a reverse command, which is bandwidth-heavy but ensures consistency without CRDTs.

## Licensing
MIT License.


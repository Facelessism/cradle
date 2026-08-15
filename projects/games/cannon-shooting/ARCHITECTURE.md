# Project Architecture

## Overview

Cannon Shooting is a real-time reaction game for one player. A computer-controlled cannon fires a projectile across a divided battlefield at a random angle and position. The player must drag their own cannon into the correct horizontal position and adjust its barrel angle to intercept the incoming shot before impact. A countdown timer shows how long is left before each round fires.

The physics kinematics engine (`cannonEngine.js`) and score/streak persistence system (`cannonStorage.js`) are separated into standalone ES/CommonJS modules.

---

## Purpose & Goals

- Provide a fast-paced reaction game where the player must intercept an incoming shot
- Keep the physics and persistence logic in testable standalone modules separate from the UI
- Demonstrate trigonometry-based trajectory calculation without a game framework

---

## System / Project Architecture Overview

The project splits concerns across three modules. `cannonEngine.js` is a pure kinematics engine that computes trajectory mileage and validates hits using trigonometry. `cannonStorage.js` handles all score, streak, and accuracy persistence through `localStorage`. `script.js` is the controller — it binds drag interactions, drives two `setInterval` loops (countdown and round firing), and updates the HUD. The page loads jQuery from a CDN plus the three local scripts.

---

## Folder Structure

```
cannon-shooting/
├── index.html       # HTML structure for HUD, both cannons, road scale, and countdown
├── cannonEngine.js  # Trigonometric trajectory calculations, hit validation, score multiplier logic
├── cannonStorage.js # High score, defense streak, and total hits persistence via localStorage
├── script.js        # Controller and interactive drag event handlers
└── style.css        # Visual styling for cannons, HUD banner, road, countdown timer
```

---

## Data Flow / Execution Flow

```
User opens index.html
        ↓
cannonEngine.js, cannonStorage.js, script.js loadload
        ↓
Load stats from localStorage & update HUD banner
        ↓
Two setInterval loops start:
  • Countdown loop (every 1 s) — counts down and updates the display
  • Round loop (every 13 s)   — fires a new round
        ↓
Round loop: computer picks random angle (0–44°) and position (2–9 cm)
        ↓
CannonEngine.calculateBallMileage() calculates trajectory mileage
        ↓
Player adjusts cannon via interactive drag handles
        ↓
After fireTime − 2 s, shot fires:
  • CannonEngine.validateHit() checks hit condition
  • CannonEngine.calculateScore() evaluates score multiplier and streak
  • CannonStorage.recordShot() updates and persists high scores & streaks
  • HUD banner updates dynamically
```

---

## Component Breakdown

### `cannonEngine.js`

Kinematics physics engine:

- `degToRad(deg)`: Converts degrees to radians.
- `calculateBallMileage(cmCanX, cmCanAngle)`: Computes trajectory mileage `(cmCanX + 4.23) / cos(angle)`.
- `validateHit(userCanX, userCanY, comCanX, cmCanAngle, xTol, angleTol)`: Evaluates position and angle alignment against tolerance window.
- `calculateScore(isHit, currentStreak)`: Computes score awards and streak multipliers.

### `cannonStorage.js`

Persistence system:

- `loadStats()`: Loads stats from `localStorage`.
- `recordShot(stats, isHit, scoreAwarded, newStreak)`: Updates high score, current streak, best streak, accuracy, and saves back to `localStorage`.
- `resetStats()`: Resets score data.

### `script.js`

UI event bindings, HUD update controller, vanilla-JS animation loops.

---

## Key Features

- Real-time one-player reaction gameplay with a countdown timer
- Randomised computer shot angle and position each round
- Score multipliers, defense streaks, and accuracy tracking
- Persistent high score and streak history via localStorage
- Drag-based cannon positioning and barrel angle adjustment

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure for HUD, cannons, and controls |
| CSS3 | Visual styling of cannons, HUD banner, road, and countdown |
| Vanilla JavaScript | Game controller logic and event handlers |
| jQuery 3.4.1 (CDN) | Animation loops and DOM interactions |

---

## File Responsibilities

### `cannonEngine.js`

- `degToRad(deg)` — converts degrees to radians
- `calculateBallMileage(cmCanX, cmCanAngle)` — computes trajectory mileage
- `validateHit(...)` — checks position and angle alignment against a tolerance window
- `calculateScore(isHit, currentStreak)` — computes score awards and streak multipliers

### `cannonStorage.js`

- `loadStats()` — loads stats from localStorage
- `recordShot(stats, isHit, scoreAwarded, newStreak)` — updates and persists stats
- `resetStats()` — resets score data

### `script.js`

- Binds interactive drag handlers and updates the HUD

---

## Design Decisions

- **Standalone engine modules** — physics and persistence live in separate files with unit-testable functions, so the game logic is independent of the UI layer.
- **Timed rounds** — two `setInterval` loops (a 1-second countdown and a 13-second round) drive the game loop without requestAnimationFrame.

---

## Dependencies

| Dependency | Version | How loaded | Purpose |
|---|---|---|---|
| jQuery | 3.4.1 | CDN (`<script>` tag) | DOM events and animation |

---

## Future Improvements

- Add sound effects for firing and hits
- Add a difficulty ramp where the computer aims faster or fires sooner
- Visual explosion/impact animation when a shot lands

---

## Known Limitations

- Keyboard-only timing means gameplay requires desktop-size screens; touch controls are not supported
- The player cannot move after the shot fires

---

## Development Notes

Automated unit test suite is located in `tests/cannon-shooting.test.js` and can be executed via:

```bash
node --test tests/cannon-shooting.test.js
```

---

## License & Attribution

- **Project License:** MIT (repository LICENSE)
- No third-party assets are used beyond jQuery, which is loaded from a CDN.

---

## References

- [jQuery](https://jquery.com/) — DOM interaction library

# Project Architecture

## Overview

RPS Arena is a Rock Paper Scissors game with a cyberpunk visual theme. The player competes against a computer opponent that picks its choice at random. Three game modes are available: Single Round, Best of 3, and Best of 5. A countdown animation ("Rock... Paper... Scissors... Shoot!") plays before each result is revealed. The game tracks per-session scores, a running win streak, and per-mode tally dots. Winning triggers a confetti animation.

---

## Purpose & Goals

- Deliver a polished, themed Rock-Paper-Scissors experience with clear visual feedback.
- Support both Classic and Rock-Paper-Scissors-Lizard-Spock rule sets from a single rules matrix.
- Provide Single Round, Best of 3, and Best of 5 tournament modes with per-round tally dots.
- Demonstrate reusable UMD modules (`game-engine.js`, `rpsAiEngine.js`, `rpsStorage.js`) that are also unit tested with Node.js.

---

## Folder Structure

```text
stone-paper-scissors-game/
├── index.html       # Full page: navbar, game box, how-to section, footer, modal
├── game-engine.js   # Rules matrix for classic and Lizard-Spock modes
├── rpsAiEngine.js   # Adaptive Markov chain opponent AI model
├── rpsStorage.js    # Local storage persistence for match stats and win streaks
├── script.js        # All game logic, animations, and event handling
└── style.css       # Cyberpunk visual theme, animations, responsive layout
```

---

## System / Project Architecture Overview

The game is split into a presentation layer and several pure logic modules. `script.js` owns the DOM: mode selection, the four-step countdown animation, score/tally rendering, and the victory modal. `game-engine.js` holds the rules matrix and `determineWinner()`, `rpsAiEngine.js` implements a Markov-chain pattern predictor, and `rpsStorage.js` wraps the repo `CradleStorage` utility for persistent match stats. All three logic modules use UMD-style exports so they work in the browser and under the Node test runner. `style.css` provides the cyberpunk theme, and `index.html` loads the repo's `Navbar.js`, `BackToHome.js`, `storage.js`, and `tokens.css` alongside the game scripts. There is no build step.

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | Full page: navbar mount, game box, how-to section, footer, confetti container, victory modal |
| `game-engine.js` | Rules matrix and win/tie/loss evaluation with result verbs |
| `rpsAiEngine.js` | Markov-chain opponent model (`createAiModel`) |
| `rpsStorage.js` | Persistent win/loss/streak stats via the repo `CradleStorage` utility |
| `script.js` | All game logic, countdown animation, scoring, and event handling |
| `style.css` | Cyberpunk theme, animations, responsive layout |

---

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
Page renders with default mode: Single Round
        ↓
User selects a game mode (Single Round / Best of 3 / Best of 5)
        ↓
resetTournament() clears scores and tally dots
        ↓
User clicks a choice button (Rock, Paper, or Scissors)
        ↓
startCountdown(playerChoice) disables buttons and runs the countdown
        ↓
Four-step interval: "ROCK...", "PAPER...", "SCISSORS...", "SHOOT!"
Each step shakes both fighter displays
        ↓
Countdown finishes → computer picks a random choice
        ↓
playGame(playerChoice, computerChoice)
  ├─ Displays both choices with a pop animation
  ├─ Determines win / loss / tie
  ├─ Updates scores, streak, and tally dots
  └─ Applies win-glow or lose-glow to the battle arena
        ↓
Win: confetti launches; Lose: page shake animation plays
        ↓
In Best of 3 / Best of 5: check if targetWins reached
  └─ If yes → showVictoryModal(winner)
        ↓
Buttons re-enabled for the next round
```

---

## Key Features

- Classic Rock-Paper-Scissors and Rock-Paper-Scissors-Lizard-Spock modes toggled from a rules selector.
- Single Round, Best of 3, and Best of 5 tournament modes with tally dots for each side.
- Four-step "ROCK... PAPER... SCISSORS... SHOOT!" countdown that shakes both fighter displays.
- Emoji-based fighter displays with a pop animation on reveal.
- Result messages that include the specific verb (e.g. "Paper covers Rock!").
- Per-session scores, a win-streak counter, and per-mode tournament wins.
- Gesture statistics showing the player's pick percentages.
- Confetti on wins and a page-shake animation on losses.
- Victory modal at the end of a tournament, with a Play Again button.
- Reset Score button that clears all counters and stats.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure, buttons, modal, confetti container |
| CSS3 (Grid, Flexbox, keyframes, backdrop-filter) | Theme, animations, responsive layout |
| Vanilla JavaScript (ES6+) | Game logic, countdown, DOM manipulation |
| localStorage API (via repo `CradleStorage`) | Persisting match stats and streaks in `rpsStorage.js` |
| Google Fonts (Orbitron, Rajdhani) | Headings/scores and body text |
| Node.js test runner | Unit tests for the UMD modules |

---

## File Responsibilities

### `index.html`

- Navbar mount point (`#navbar-mount`) filled by the repo `CradleNavbar`.
- `#game` — rules mode and AI difficulty selectors, mode buttons, score board with streak and tally dots, gesture stats panel, `#battleArena` with `#playerPick` / `#computerPick`, result text, five choice buttons, and Reset Score.
- `#how` — five rule cards (lizard/spock cards hidden in Classic mode).
- `#victoryModal` — tournament result and Play Again button.
- `#confettiContainer` — where confetti pieces are injected.

### `game-engine.js`

- `RULES` — mapping of each gesture to what it beats and the verb describing the result.
- `determineWinner(player, computer)` — returns `{ outcome, message }` with the appropriate verb.

### `rpsAiEngine.js`

- `createTransitionMatrix(choices)` — builds a Markov transition matrix with Laplace smoothing.
- `createAiModel(choices)` — returns `recordMove`, `predictNextPlayerMove`, `getOptimalCounter`, and `reset`.
- `getOptimalCounter(rules)` — finds a gesture that beats the predicted move.

### `rpsStorage.js`

- `getStats()` — reads persisted wins/losses/ties, best streak, and move counts from `CradleStorage`.
- `recordOutcome(outcome, playerChoice)` — updates and persists stats.
- `resetStats()` — resets the stored stats.

### `script.js`

- `updateModeUI()` — toggles the lizard/spock buttons and stat rows between rule modes.
- `startCountdown(playerChoice)` — disables buttons and runs the four-step `setInterval` countdown with `triggerShake()`.
- `getComputerChoice()` — picks the computer's move at random from the active choice list.
- `playGame(player, computer)` — reveals choices, evaluates the outcome via `determineWinner`, updates scores/streak/tournament wins, and triggers win/lose effects.
- `renderTally()` / `resetTournament()` — rebuilds the tally dots and resets tournament state.
- `showVictoryModal(winner)` / `launchConfetti()` / `triggerShake()` / `toggleButtons()` — UI effects.
- State variables: `playerScore`, `computerScore`, `streak`, `gameMode`, `targetWins`, `playerTournamentWins`, `computerTournamentWins`.

### `style.css`

- Glow orbs, `.game-box` border glow, and `.win-glow` / `.lose-glow` arena states.
- `.shake` (0.4 s translateX keyframes) and `.pop` (scale) animations.
- `.confetti-piece` falling animation with per-piece random duration.
- Victory modal fade-in via `backdrop-filter` and opacity/visibility transitions.

---

## Design Decisions

- **Rules as data** — the win matrix and verbs live in `game-engine.js`, so adding a gesture is data, not new branching code.
- **UMD modules** — `game-engine.js`, `rpsAiEngine.js`, and `rpsStorage.js` export for both `window` and `module.exports` so the same code runs in the browser and in Node tests.
- **Countdown via `setInterval`** — the fixed 400 ms countdown drives the shake animation and defers the reveal until the final step.
- **Random active opponent** — `script.js` currently picks the computer move at random; the Markov bot in `rpsAiEngine.js` is exercised by the test suite and ready to swap in via the AI difficulty selector.
- **CSS-driven effects** — confetti, shakes, glows, and the modal transition are pure CSS, keeping the JavaScript to state and timing.

---

## Dependencies

| Library         | Source           | Purpose      |
| --------------- | ---------------- | ------------ |
| Orbitron (font) | Google Fonts CDN | Display font |
| Rajdhani (font) | Google Fonts CDN | UI font      |

Repo utilities loaded from the shared `src` folder: `Navbar.js`, `BackToHome.js`, `storage.js` (used by `rpsStorage.js`), and `tokens.css`. No third-party JavaScript libraries are used.

---

## Future Improvements

- **Computer strategy** — replace the random computer choice with a simple frequency analysis of the player's past picks to make the opponent more challenging.
- **Sound effects** — play audio cues for win, loss, and tie outcomes.
- **Persistent stats** — save total wins, losses, and longest streak to `localStorage` for a cross-session leaderboard.
- **Keyboard shortcuts** — allow `R`, `P`, `S`, `L`, `K` keys to make choices without using the mouse.

---

## Known Limitations

- The live computer opponent picks at random; the Markov model in `rpsAiEngine.js` is not yet connected to `getComputerChoice()`.
- No sound effects for wins, losses, or ties.
- Session scores, streak, and gesture stats reset on page reload; `rpsStorage.js` persistence is not yet wired into `script.js`.
- No keyboard shortcuts.
- The extended Lizard-Spock mode is selected only through the rules dropdown; there is no URL state.

---

## Development Notes

- No build step is required. Open `index.html` in a browser or serve the folder statically.
- The logic modules are UMD, so they run under Node for testing:
  `node --test tests/stone-paper-scissors.test.js`
  `node --test tests/stone-paper-scissors-ai.test.js`
- `rpsStorage.js` reads and writes through the repo `CradleStorage` utility under the `cradle_rps_` namespace.
- To make the bot adaptive in live play, replace the body of `getComputerChoice()` in `script.js` with a call to `window.RpsAiEngine.createAiModel()`.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:**
  - Orbitron font by Google Fonts (OFL license), loaded from the Google Fonts CDN.
  - Rajdhani font by Google Fonts (OFL license), loaded from the Google Fonts CDN.

---

## References

- [Rock–paper–scissors — Wikipedia](https://en.wikipedia.org/wiki/Rock_paper_scissors)
- [Rock–paper–scissors–lizard–spock — Wikipedia](https://en.wikipedia.org/wiki/Rock_paper_scissors_lizard_spock)
- [Markov chain — Wikipedia](https://en.wikipedia.org/wiki/Markov_chain)
- [MDN Web Docs — setInterval](https://developer.mozilla.org/en-US/docs/Web/API/setInterval)

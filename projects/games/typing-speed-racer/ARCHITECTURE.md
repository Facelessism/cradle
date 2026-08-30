# Project Architecture

## Overview

Typing Speed Racer is a single-player typing speed test with a racing twist. Players type words to move their car along a race track while competing against an AI opponent. The game tracks WPM, accuracy, streaks, and provides visual feedback through an animated race track.

The project is self-contained with no external dependencies — just HTML, CSS, and vanilla JavaScript.

---

## Purpose & Goals

- Test typing speed in an engaging, gamified format
- Provide visual feedback through a race track with animated cars
- Track WPM, accuracy, streaks, and best scores
- Offer three difficulty levels (easy, medium, hard) with different word banks
- Work offline with localStorage persistence for best scores

---

## Folder Structure

```text
typing-speed-racer/
├── index.html          # Page shell, race track, stats, results overlay
├── script.js           # Game logic, word bank, timer, input handling
├── style.css           # Layout, race track, animations, responsive design
├── ARCHITECTURE.md     # This file
└── thumbnail.svg       # Preview thumbnail
```

---

## Key Features

| Feature | Description |
|---|---|
| **Race Track** | Visual lanes with player and AI cars that move based on typing progress |
| **3 Difficulty Levels** | Easy (3-letter words), Medium (5-letter words), Hard (8+ letter words) |
| **Time Modes** | 30s, 60s, or 120s race durations |
| **Streak System** | Consecutive correct words build streaks with visual feedback |
| **Boost Mechanic** | Every 5-streak correct words gives the player a speed boost |
| **AI Opponent** | Moves at difficulty-based speed, creating competitive pressure |
| **Live Stats** | WPM, accuracy, streak, correct/wrong counts, and time remaining |
| **Results Screen** | Final stats with rank classification (Sunday Driver → Formula 1 Legend) |
| **Best Score** | Persisted in localStorage across sessions |

---

## Word Banks

| Difficulty | Word Length | Count | Examples |
|---|---|---|---|
| Easy | 3 letters | 80 | the, and, for, cat, dog |
| Medium | 5-6 letters | 80 | about, after, green, world |
| Hard | 8-9 letters | 60 | absolute, beautiful, computer |

---

## Scoring & Ranking

| WPM Range | Rank |
|---|---|
| 100+ | 🏆 Formula 1 Legend |
| 80-99 | 🥇 NASCAR Champion |
| 60-79 | 🥈 Pro Racer |
| 40-59 | 🥉 Road Racer |
| 20-39 | 🚗 Sunday Driver |
| 0-19 | 🐌 Learning to Drive |

---

## Technical Decisions

- **No frameworks**: Pure vanilla JS for fast loading and zero dependencies
- **Word batching**: Generates 60 words initially, adds 30 more when running low
- **Live feedback**: Input border turns green/red for correct/misspelled partial matches
- **Car animation**: CSS transitions for smooth car movement (0.3s ease-out)
- **localStorage**: Best WPM persisted under `cradle:typing-racer-best-wpm`

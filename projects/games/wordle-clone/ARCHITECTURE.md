# Wordle Clone Architecture

## Overview

The Wordle Clone is a browser-based word guessing game inspired by the popular Wordle gameplay. The goal is to provide an interactive and responsive game where users guess a hidden five-letter word within a limited number of attempts.

## System / Project Architecture Overview

The application is built using HTML, CSS, and JavaScript.

- HTML handles the game structure and UI.
- CSS handles styling, layout, colors, animations, and responsive design.
- JavaScript handles game logic, keyboard input, word validation, attempts, and game state.

## Component Breakdown

- Game Board
- Keyboard
- Header
- Guess Input
- Game Status
- Restart/New Game Controls

## Data Flow / Execution Flow

1. A target word is selected.
2. The player enters a five-letter guess.
3. JavaScript validates the guess.
4. Each letter is evaluated.
5. Tiles are updated based on the result.
6. The game checks whether the player has won or lost.
7. The game displays the appropriate result.

## Key Features

- Five-letter word guessing
- Limited number of attempts
- Correct-position letter feedback
- Incorrect-position letter feedback
- Incorrect-letter feedback
- On-screen keyboard
- Physical keyboard support
- Restart/new game functionality
- Responsive UI

## Technologies Used

- HTML5
- CSS3
- JavaScript

## File Responsibilities

- `index.html` — Provides the structure of the game.
- `style.css` — Handles the visual design and responsive layout.
- `script.js` — Contains game logic, word validation, keyboard handling, and game state management.

## Design Decisions

The project uses vanilla HTML, CSS, and JavaScript to keep the implementation lightweight and easy to understand without requiring external frameworks.

## Dependencies

The game does not require any external JavaScript framework or runtime dependency.

## Future Improvements

- Add difficulty levels.
- Add statistics tracking.
- Add daily challenges.
- Add animations and sound effects.
- Add additional word lists.

## Known Limitations

The game currently relies on the available word list and does not provide user accounts or cloud-based statistics.

## Development Notes

The game can be run by opening `index.html` in a browser or through a local development server.

## License & Attribution

This project is developed as part of the repository's collection of projects. Any third-party assets or resources should retain their respective licenses and attribution.

## References

- Wordle gameplay concepts
- MDN Web Docs for HTML, CSS, and JavaScript
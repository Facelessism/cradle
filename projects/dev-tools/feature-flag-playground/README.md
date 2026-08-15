# Feature Flag Playground

A local playground for creating and toggling application feature flags
across Development, Staging, and Production environments.

## Features

- Create flags with a name and description
- Toggle each flag on/off independently per environment
- Set a percentage rollout (0–100%) per environment
- Search/filter flags by name, key, or description
- Simulate flag evaluation for a specific (or random) user ID
- Export/import your flags as JSON
- Reset to demo data at any time

## How to run locally

Open `index.html` in a browser, or serve the repository root with any
static file server — no build step is required.

## Notes

All data is stored in your browser's `localStorage` under the key
`cradle-feature-flags`. Clearing your browser storage will reset the
playground back to the seeded demo flags on next load.

## License

MIT — consistent with the rest of the Cradle repository. No
third-party assets are used; the "Space Grotesk" font is loaded from
Google Fonts, matching the convention used across other Cradle mini
projects.
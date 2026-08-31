# Security Policy

Cradle is a public portfolio of small prototypes and learning projects. It ships
plain static files with no build step, no user accounts, and no secrets, which
keeps the attack surface small. This document records the project's security
practices so contributors can keep it that way.

## Reporting a Vulnerability

This repository does not host production data or infrastructure, so there is no
dedicated security contact. If you find a real security problem (for example a
way to run unexpected code in a visitor's browser):

1. **Do not** create a public issue describing an exploitable bug in detail.
2. Open an issue titled `Security report: <short summary>` and briefly describe
   the impact and how to reproduce it.
3. Maintainers can audit site files directly in the repo, so a full
   reproduction outside the repository is not necessary.

Security-impacting fixes are applied through normal pull requests; PRs that
reduce risk are always welcome.

## Worker Integrity Policy

**Workers are only allowed from same-origin scripts committed to this
repository.**

- `Worker` / `SharedWorker` / `importScripts` URLs must be **string literals**
  pointing at files inside this repository. Dynamic worker URLs
  (`new Worker(someVariable)` or `new Worker(new URL(...))`) and remote URLs
  (`https://...`, `data:`, `blob:`, protocol-relative `//...`) are prohibited.
- Every worker script is registered in `data/worker-integrity.json` with a
  `sha256` of its content. The committed hash is checked against the working
  tree on every CI run by `npm run validate:worker-integrity`
  (`scripts/validate-worker-integrity.js`), so a modified or swapped worker
  script fails the build.
- Why this matters: a worker script is executed with full privileges of its
  origin. Integrity-checking the script itself removes the "trusted but
  replaced" risk class and keeps dependencies auditable in a single file.

### Adding a new worker

1. Create the worker script as a file in the repository (for example next to
   the page that uses it).
2. Construct it with a literal URL: `new Worker("./my-worker.js")` or
   `importScripts("helper.js")`.
3. Register it and compute the hash:

   ```sh
   npm run validate:worker-integrity -- --update
   ```

4. Commit the worker file, the updated `data/worker-integrity.json`, and any
   tests together.

### Removing or editing a worker

Edit the script and run `npm run validate:worker-integrity -- --update` to
refresh the committed hash. When a worker is removed from the code, also remove
its entry from `data/worker-integrity.json` (the validator reports stale
entries otherwise).

## postMessage Trust Model

Cradle uses dedicated, same-origin workers. Dedicated-worker message events
always report an empty `event.origin` and the worker URL is hardcoded, so the
browser already guarantees origin trust; the runtime hardening is validating
the **shape** of every message before acting on it. All inbound payloads on
both ends of the worker channel are validated (see the `src/utils`
`messageValidation` module and `tests/message-validation.test.js`). Do not add
cross-window (`window.addEventListener("message", ...)`) channels without a
matching `event.origin` check.

## External Dependencies

Where external resources are loaded over a CDN, pin the resource and use
Subresource Integrity (`integrity="sha384-..."`) attributes so a compromised
CDN cannot execute code in a visitor's browser.

## User-Gesture-Driven Audio Activation Policy

**Web Audio contexts and media playback must only be instantiated or resumed after an explicit user interaction (click, keypress, tap).**

To adhere to browser autoplay policies, respect user preferences, and avoid unexpected background noise or console warnings:

1. **Explicit Trigger Requirement:** Audio contexts (`new AudioContext()`) and audio graph resumption (`audioContext.resume()`) must be triggered by an explicit user gesture (e.g. clicking a "Play", "Record", piano key, or toggle button).
2. **No Eager or Auto-playing Audio:** Mini-projects and UI components must never initialize running audio graphs or call `.play()` during initial page load, `DOMContentLoaded`, or unprompted lifecycle events.
3. **Graceful State Handling:** Applications using Web Audio should check `audioContext.state === "suspended"` upon user gesture and call `audioContext.resume()`, with error handling in case the promise is rejected.
4. **Validation Guardrails:** Shipped code is guarded by repository tests ensuring audio initialization helpers conform to user-driven event handler pathways.
## Frame Embedding & Clickjacking Policy

**Cradle mini-pages and interactive demos are designed for direct standalone navigation and must not be embedded in untrusted external frames.**

To protect users against clickjacking (UI redressing) attacks, the following policy applies:

1. **Standalone Execution Model:** All mini-projects (`projects/*/*/index.html`), UI components, and the main landing page (`index.html`) run directly in top-level browser contexts. No project in this repository requires or expects embedding inside third-party frames or iframes.
2. **Clickjacking Defense via HTTP Headers:** Production hosting environments (such as GitHub Pages, Cloudflare, Netlify, or custom reverse proxies) should send HTTP response headers that restrict frame ancestry:
   - `Content-Security-Policy: frame-ancestors 'self';` (or `frame-ancestors 'none';` where framing by the same origin is also unneeded)
   - `X-Frame-Options: SAMEORIGIN` (or `DENY` for legacy browser fallback)
3. **Repository Guardrails:** Repository validation tooling (`scripts/validate-no-dynamic-eval.js` and `scripts/validate-demo-html.js`) ensures that:
   - Shipped pages do not dynamically construct unvalidated `<iframe>` elements or embed arbitrary external targets without security review.
   - If an `<iframe>` is ever introduced for an isolated sandbox or interactive preview, it must use explicit `sandbox` attributes (e.g. `sandbox="allow-scripts"`) and never embed `javascript:` or untrusted `data:` URIs.

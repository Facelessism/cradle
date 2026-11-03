# Model and Third-Party Script Loading Policy

Cradle mini-projects frequently experiment with AI/ML models (e.g., ONNX, TensorFlow.js) and third-party utility scripts. To maintain security, privacy, and repository stability across dozens of isolated experiments, this policy defines the strict requirements for importing and executing any remote or external assets.

All contributors must adhere to these rules when adding or modifying mini-projects.

---

## 1. Trusted Origins

Any third-party script or model must be loaded from a reputable, widely recognized Content Delivery Network (CDN) or hosting provider.

**Allowed CDNs:**

- `unpkg.com`
- `jsdelivr.net`
- `cdnjs.cloudflare.com`
- `huggingface.co` (for ML models)

If a library is only available on an obscure or unverified server, it must be downloaded and bundled locally within the project's `assets/` directory rather than hotlinked.

## 2. Integrity Verification (SRI)

Security is paramount. Every remote `<script>` tag loading an external library **MUST** include a Subresource Integrity (SRI) hash.

### What is SRI?

SRI ensures that the script loaded from a CDN has not been maliciously modified or compromised.

### Rule

You must include `integrity` and `crossorigin="anonymous"` attributes on all remote scripts.

**Allowed (Correct):**

```html
<script
  src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"
  integrity="sha512-..."
  crossorigin="anonymous"
></script>
```

**Forbidden (Incorrect):**

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
```

_(You can generate SRI hashes using tools like [SRI Hash Generator](https://www.srihash.org/))._

## 3. Large Model Hosting & Loading

Machine learning models (e.g., `.bin`, `.onnx`, `.json` weights) can be extremely large.

- **Hosting**: Do not commit large model weights directly to the repository (no files > 50MB). Models should ideally be loaded dynamically from the Hugging Face Hub or a reliable CDN.
- **Lazy Loading**: Do not load massive models immediately on page load. Model fetching must be deferred until the user explicitly initiates an action (e.g., clicking "Start AI Model").

## 4. Fallback Behavior and Degradation

Many users run strict privacy blockers (e.g., uBlock Origin, Brave Shields) that may arbitrarily block CDNs.

### Rule

Your project must gracefully degrade if a script or model fails to load.

- Wrap model loading in `try/catch` blocks.
- If a model or script fetch fails, display a clear, non-intrusive on-screen error message (e.g., _"Failed to load AI model. Check your network or adblocker."_).
- Never allow the UI to "freeze" silently or crash the tab if a remote asset is blocked.

## 5. Isolation Boundaries & Dynamic Script Execution

Third-party model scripts and external code must **never** be dynamically executed without strict trust boundaries.

### Restricting Dynamic Script & Model Execution

When dynamically injecting remote scripts (e.g. via `loadScriptAsync` or custom loaders), projects must adhere to four mandatory guardrails:

1. **Explicit Origin Allowlist:**
   - Dynamic script injection must validate the URL host strictly against `ALLOWED_MODEL_HOSTS` (`cdn.jsdelivr.net`, `unpkg.com`, `cdnjs.cloudflare.com`, `huggingface.co`).
   - Plain HTTP, `javascript:`, `data:`, and untrusted origins are strictly forbidden and must fail closed before any element is injected into the DOM.

2. **Mandatory Subresource Integrity (SRI) & CORS:**
   - Dynamically injected remote scripts must specify a verified cryptographic hash (`sha256`, `sha384`, or `sha512`) via the `integrity` attribute and set `crossorigin="anonymous"`.
   - Projects should use pre-verified entries in `KNOWN_MODEL_INTEGRITY` (e.g., pinned TensorFlow.js, MobileNet, KNN Classifier) or supply verified SRI hashes.

3. **Controlled Loading & Lifecycle Management:**
   - **Request Deduplication:** Use in-flight promise caching and DOM inspection to prevent duplicate concurrent network fetches and script tag duplication.
   - **Bounded Timeouts & Cleanup:** All dynamic loads must enforce a strict timeout (e.g., `DEFAULT_SCRIPT_TIMEOUT_MS = 15000`). If a fetch stalls or errors, the injected `<script>` tag must be removed immediately from the DOM to prevent partial or corrupted execution contexts.
   - **Sequential Dependency Chains:** Multi-part model suites must load dependencies sequentially using `loadScriptsSequentially` to avoid race conditions.

4. **Isolation Strategy for External Code:**
   - **Sandboxed Execution Context:** Where untrusted or unverified code must execute, isolate it inside a sandboxed `<iframe>` with `sandbox="allow-scripts"` (specifically **omitting** `allow-same-origin`). This assigns the frame an opaque, unique origin (`null`), blocking access to the parent window's `localStorage`, cookies, session tokens, and DOM tree.
   - **Structured Messaging:** Communicate with isolated sandboxes exclusively via validated `postMessage` interfaces.
   - **Global Pollution Monitoring:** When external scripts must run in the main thread, use `snapshotGlobalKeys` and `detectGlobalPollution` to detect and audit any unexpected properties injected into `window`.
   - **Web Worker Compute:** Offload heavy model computation (e.g., ONNX, TFLite) to dedicated workers to prevent main-thread freezing and limit direct DOM access.

## 6. Dependency Ownership & Licensing

- **Responsibility**: The author of the mini-project is responsible for ensuring the external dependencies are actively maintained and safe.
- **Attribution**: The `ARCHITECTURE.md` of your project must include a "Dependencies" section explicitly stating the name, source, and open-source license of every third-party model, library, and asset you load.
- **Commercial Restrictions**: Do not include models or scripts with licenses that strictly forbid commercial use or contain highly restrictive non-open-source clauses. Stick to MIT, Apache 2.0, BSD, or broadly permissive open weights.

## 5. Content Security Policy (CSP) Extension for Minis

The site's landing page (`index.html`) enforces a minimal Content Security Policy:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';"
/>
```

Minis load as standalone documents (`projects/<category>/<slug>/index.html`) and do not automatically inherit the landing page's meta tag. When a mini requires external libraries (such as Tone.js or marked) or remote data/models (such as Hugging Face weights), it **SHOULD** include its own `<meta http-equiv="Content-Security-Policy">` in `<head>` tailored to its specific needs:

1. **Permit only approved origins:** Include only the specific CDNs (`unpkg.com`, `cdn.jsdelivr.net`, `cdnjs.cloudflare.com`, `huggingface.co`) or API domains accessed by the mini.
2. **Never use wildcards (`*`) or insecure `http:` schemes.**
3. **Always preserve defense-in-depth directives:** Keep `object-src 'none'`, `base-uri 'self'`, and `default-src 'self'`.

**Example: Mini loading Tone.js from cdnjs:**

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self';"
/>
```

**Example: Mini loading Hugging Face models:**

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://huggingface.co; object-src 'none'; base-uri 'self';"
/>
```

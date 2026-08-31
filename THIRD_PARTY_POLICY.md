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
<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js" 
        integrity="sha512-..." 
        crossorigin="anonymous"></script>
```

**Forbidden (Incorrect):**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
```

*(You can generate SRI hashes using tools like [SRI Hash Generator](https://www.srihash.org/)).*

## 3. Large Model Hosting & Loading

Machine learning models (e.g., `.bin`, `.onnx`, `.json` weights) can be extremely large. 

- **Hosting**: Do not commit large model weights directly to the repository (no files > 50MB). Models should ideally be loaded dynamically from the Hugging Face Hub or a reliable CDN.
- **Lazy Loading**: Do not load massive models immediately on page load. Model fetching must be deferred until the user explicitly initiates an action (e.g., clicking "Start AI Model").

## 4. Fallback Behavior and Degradation

Many users run strict privacy blockers (e.g., uBlock Origin, Brave Shields) that may arbitrarily block CDNs.

### Rule
Your project must gracefully degrade if a script or model fails to load.
- Wrap model loading in `try/catch` blocks.
- If a model or script fetch fails, display a clear, non-intrusive on-screen error message (e.g., *"Failed to load AI model. Check your network or adblocker."*).
- Never allow the UI to "freeze" silently or crash the tab if a remote asset is blocked.

## 5. Isolation Boundaries

- **No Global Pollution**: Third-party scripts should not wildly pollute the `window` namespace. Stick to established libraries.
- **Sandboxing**: Where highly untrusted or experimental code is running, consider isolating it via a Web Worker or an `<iframe>`.

## 6. Dependency Ownership & Licensing

- **Responsibility**: The author of the mini-project is responsible for ensuring the external dependencies are actively maintained and safe.
- **Attribution**: The `ARCHITECTURE.md` of your project must include a "Dependencies" section explicitly stating the name, source, and open-source license of every third-party model, library, and asset you load.
- **Commercial Restrictions**: Do not include models or scripts with licenses that strictly forbid commercial use or contain highly restrictive non-open-source clauses. Stick to MIT, Apache 2.0, BSD, or broadly permissive open weights.

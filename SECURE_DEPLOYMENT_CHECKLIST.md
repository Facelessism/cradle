# Secure Deployment Checklist

This document defines the baseline security controls, configuration standards, and pre-flight verification requirements for deploying Cradle and its interactive web applications to production environments (e.g., GitHub Pages, Cloudflare Pages/Workers, Netlify, Vercel, Caddy, Nginx, or enterprise reverse proxies).

Every production release must be evaluated against this checklist to ensure confidentiality, integrity, availability, and resilience against common web attack vectors (including MITM, XSS, prototype pollution, clickjacking, and supply chain tampering).

---

## Table of Contents

1. [Transport Security & HTTPS](#1-transport-security--https)
2. [HTTP Strict Transport Security (HSTS)](#2-http-strict-transport-security-hsts)
3. [Content Security Policy (CSP)](#3-content-security-policy-csp)
4. [Subresource Integrity (SRI)](#4-subresource-integrity-sri)
5. [Core HTTP Security Headers](#5-core-http-security-headers)
6. [Dependency Hygiene & Supply Chain Security](#6-dependency-hygiene--supply-chain-security)
7. [Worker & Runtime Message Integrity](#7-worker--runtime-message-integrity)
8. [Caching, Fingerprinting & Asset Integrity](#8-caching-fingerprinting--asset-integrity)
9. [Credentials, Secrets & Information Disclosure](#9-credentials-secrets--information-disclosure)
10. [Pre-Flight Verification & Sign-Off Matrix](#10-pre-flight-verification--sign-off-matrix)

---

## 1. Transport Security & HTTPS

Production deployments must serve all traffic exclusively over encrypted TLS connections. Unencrypted plain HTTP introduces immediate vulnerability to packet interception, session hijacking, credential harvesting, and content injection.

### Requirements & Controls

- [ ] **Enforce HTTPS Everywhere:** Unconditionally redirect all incoming HTTP (port 80) requests to HTTPS (port 443) using HTTP `301 Moved Permanently` or `308 Permanent Redirect`.
- [ ] **Modern TLS Protocol Versions:** Enable only **TLS 1.2** and **TLS 1.3**. Explicitly disable deprecated and insecure protocol versions: SSLv2, SSLv3, TLS 1.0, and TLS 1.1.
- [ ] **Secure Cipher Suites:** Use modern cipher suites with Ephemeral Diffie-Hellman for Forward Secrecy (PFS), such as:
  - TLS 1.3: `TLS_AES_128_GCM_SHA256`, `TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256`
  - TLS 1.2: `ECDHE-ECDSA-AES128-GCM-SHA256`, `ECDHE-RSA-AES128-GCM-SHA256`, `ECDHE-ECDSA-AES256-GCM-SHA384`, `ECDHE-RSA-AES256-GCM-SHA384`
- [ ] **Certificate Trust & Expiration:** Deploy certificates issued by an established, publicly trusted Certificate Authority (e.g. Let's Encrypt, Cloudflare, DigiCert). Ensure automated renewal is configured with alerts triggered if expiration is within 30 days.
- [ ] **Zero Mixed Content:** Ensure that no HTML documents, scripts, styles, fonts, or images reference `http://` URLs. All assets must use relative paths or secure `https://` origins.
- [ ] **OCSP Stapling:** Enable OCSP (Online Certificate Status Protocol) stapling on standalone servers (Nginx/Caddy/Apache) to accelerate TLS handshakes and prevent privacy leakage.

### Verification Commands

```bash
# Verify HTTP to HTTPS 301/308 redirect
curl -s -I http://example.com | grep -iE "(HTTP/|location)"

# Verify TLS version and cipher negotiation
openssl s_client -connect example.com:443 -tls1_3 -servername example.com
openssl s_client -connect example.com:443 -tls1_2 -servername example.com

# Verify legacy TLS 1.0 is rejected
openssl s_client -connect example.com:443 -tls1 -servername example.com
```

---

## 2. HTTP Strict Transport Security (HSTS)

HSTS prevents SSL-stripping man-in-the-middle attacks by commanding compliant user agents to automatically transform all insecure `http://` references to `https://` prior to dispatching any network packets.

### Requirements & Controls

- [ ] **Header Presence:** Serve the `Strict-Transport-Security` header on all HTTPS responses. Never emit this header over plain HTTP connections.
- [ ] **Safe Staged Rollout:** Follow a phased rollout before committing to maximum duration:
  1. _Stage 1 (Testing):_ `max-age=300` (5 minutes) — verify no broken assets or certificate mismatches.
  2. _Stage 2 (Staging):_ `max-age=86400` (1 day) — test subdomains and redirects.
  3. _Stage 3 (Production):_ `max-age=2592000` (30 days) with `includeSubDomains`.
  4. _Stage 4 (Preload Ready):_ `max-age=63072000; includeSubDomains; preload` (2 years).
- [ ] **Subdomain Audit:** Ensure all existing and future subdomains (`*.example.com`) properly support HTTPS before specifying the `includeSubDomains` directive.
- [ ] **HSTS Preload Submission:** Once Stage 4 is stable, submit the domain to the Chromium HSTS Preload List at [hstspreload.org](https://hstspreload.org/) to bake strict HTTPS directly into major browsers (Chrome, Firefox, Safari, Edge).

### Target Production Header

```http
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

---

## 3. Content Security Policy (CSP)

A robust Content Security Policy restricts the origins from which scripts, styles, images, workers, and network connections can be established, neutralizing Cross-Site Scripting (XSS) and data exfiltration.

### Policy Directives for Cradle

Cradle operates as a client-side collection of mini-applications. In accordance with [SECURITY.md](SECURITY.md) and [THIRD_PARTY_POLICY.md](THIRD_PARTY_POLICY.md), the baseline CSP must enforce:

- [ ] `default-src 'self'`: Disallow loading from any external origin by default.
- [ ] `script-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://huggingface.co`: Authorize only first-party scripts and approved, audited CDN endpoints.
- [ ] `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`: Permit local styles, inline style attributes required by interactive canvas/animation tools, and Google Fonts CSS.
- [ ] `font-src 'self' https://fonts.gstatic.com data:`: Allow trusted font origins.
- [ ] `img-src 'self' data: blob: https:`: Allow self-hosted images, data URIs, and object URLs created via `URL.createObjectURL` for user media / file tools.
- [ ] `connect-src 'self' https:`: Allow approved API endpoints, models, and workers to establish network requests.
- [ ] `worker-src 'self' blob:`: Restrict Web Workers to same-origin scripts committed to the repository (matching the Worker Integrity Policy).
- [ ] `object-src 'none'`: Completely block Flash, Java, and legacy browser plugins.
- [ ] `base-uri 'self'`: Restrict `<base>` tags to prevent document root hijacking.
- [ ] `form-action 'self'`: Prevent form submissions to malicious third-party collectors.
- [ ] `frame-ancestors 'self'`: Prevent embedding by third-party origins (clickjacking defense).

### Recommended Production Header

```http
Content-Security-Policy: default-src 'self'; script-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://huggingface.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';
```

> **Tip:** During initial deployment or major architectural updates, deploy with `Content-Security-Policy-Report-Only` and configure a reporting endpoint to identify unintended policy violations before enforcement.

---

## 4. Subresource Integrity (SRI)

Subresource Integrity guarantees that files fetched from external Content Delivery Networks (CDNs) have not been modified, compromised, or injected with malicious code.

### Requirements & Controls

- [ ] **Cryptographic Hash Attributes:** Every `<script>` and `<link rel="stylesheet">` tag loading third-party assets must include an `integrity` attribute with a cryptographic hash (`sha384` or `sha512`).
- [ ] **Cross-Origin Attribute:** All elements bearing an `integrity` attribute must also specify `crossorigin="anonymous"` to satisfy CORS validation requirements.
- [ ] **Approved CDN Gate:** Remote assets may only be loaded from the approved origins defined in [THIRD_PARTY_POLICY.md](THIRD_PARTY_POLICY.md):
  - `unpkg.com`
  - `cdn.jsdelivr.net`
  - `cdnjs.cloudflare.com`
  - `huggingface.co`
- [ ] **Dynamic Script & Model Loading Boundaries:** Any runtime or async loading of external scripts (e.g. AI models via `loadScriptAsync`) must enforce the explicit origin allowlist (`ALLOWED_MODEL_HOSTS`), verify SRI digests, enforce execution timeouts with DOM cleanup, and isolate untrusted code in sandboxed contexts per [THIRD_PARTY_POLICY.md](THIRD_PARTY_POLICY.md).
- [ ] **Automated CI Contract Enforcement:** Verify that all remote scripts comply with SRI requirements by running the contract validator:

```bash
npm run validate:mini-contract
```

Any script tag missing an `integrity` attribute will fail the build with an `external-script-no-sri` violation.


---

## 5. Core HTTP Security Headers

In addition to HSTS and CSP, production web servers must emit defense-in-depth security headers on all responses:

### 1. `X-Frame-Options`

- **Value:** `SAMEORIGIN` (or `DENY` if embedding even within the same origin is unnecessary).
- **Purpose:** Protects legacy user agents that do not fully support CSP `frame-ancestors` against clickjacking / UI redressing attacks.

### 2. `X-Content-Type-Options`

- **Value:** `nosniff`
- **Purpose:** Prohibits browsers from MIME-sniffing a response away from the declared `Content-Type`. Prevents script execution disguised as images or text.

### 3. `Referrer-Policy`

- **Value:** `strict-origin-when-cross-origin` (or `no-referrer`)
- **Purpose:** Protects user privacy by ensuring origin, path, and query strings are never leaked to external sites over plain HTTP or cross-origin requests.

### 4. `Permissions-Policy`

- **Value:** Restrict powerful hardware and browser APIs that Cradle does not require:
  ```http
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()
  ```
  _(Note: For specific mini-projects utilizing the webcam or microphone, such as ASCII Camera or Audio Visualizers, grant permissions selectively to `'self'` for those specific pages)._

### 5. `Cross-Origin-Opener-Policy` (COOP) & `Cross-Origin-Embedder-Policy` (COEP)

- **Values:**
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`)
- **Purpose:** Isolates the browsing context and enables secure memory allocation (`SharedArrayBuffer`) if required by advanced WebAssembly or multithreaded AI modules.

---

## 6. Dependency Hygiene & Supply Chain Security

Static applications rely critically on their toolchain, build scripts, and vendored packages. Supply chain hygiene ensures that malicious or vulnerable code cannot compromise the deployed artifacts.

### Requirements & Controls

- [ ] **Zero High or Critical Production Vulnerabilities:** Run centralized vulnerability auditing:
  ```bash
  npm run audit:deps
  ```
  Per [SECURITY.md](SECURITY.md#production-dependency-vulnerability-policy), any finding of severity **High** (CVSS 7.0–8.9) or **Critical** (CVSS 9.0–10.0) is a hard deployment blocker.
- [ ] **Committed and Verified Lockfile:** Production builds must install dependencies strictly using `npm ci --omit=dev` to ensure reproducible, tamper-free node module trees matching `package-lock.json`.
- [ ] **No Dynamic Evaluation (`eval`):** Ensure that code does not use `eval()`, `new Function()`, or dynamic script insertion without security review:
  ```bash
  npm run validate:no-dynamic-eval
  ```
- [ ] **Automated Dependency Scans in CI:** Ensure GitHub Actions workflows (`.github/workflows/dependency-scan.yml` and `.github/workflows/test.yml`) are green on the deployment target commit.
- [ ] **Audit Vendor Licenses & Attribution:** Verify that third-party code and model weights comply with permissible open-source licenses (MIT, Apache 2.0, BSD) and are documented in the respective project `ARCHITECTURE.md`.

---

## 7. Worker & Runtime Message Integrity

Cradle applications make extensive use of Web Workers for CPU-intensive background tasks (chess engine, search indexing, neural network simulations).

### Requirements & Controls

- [ ] **Literal Same-Origin Worker URLs:** `new Worker(...)` and `importScripts(...)` must only reference local string literal paths inside the repository. Remote URLs (`https://...`), `blob:`, or dynamic variables are prohibited.
- [ ] **Cryptographic Hash Verification:** Every worker script must match its registered SHA-256 digest in `data/worker-integrity.json`:
  ```bash
  npm run validate:worker-integrity
  ```
- [ ] **postMessage Input Validation:**
  - All inter-thread `postMessage` handlers must validate message shapes using [messageValidation.js](src/utils/messageValidation.js).
  - Prototype-pollution defense: Payloads must be inspected for dangerous keys (`__proto__`, `constructor`, `prototype`) using `hasDangerousKeys()`.
  - Recursion depth and workload limits: Recursive payload traversals must enforce bounded depth (`DEFAULT_MAX_RECURSION_DEPTH = 64`) and cycle detection to prevent call stack exhaustion attacks.
  - Fail closed: Reject unauthorized or malformed message structures immediately.

---

## 8. Caching, Fingerprinting & Asset Integrity

Proper caching policies ensure users immediately receive security updates while minimizing server overhead and bandwidth.

### Requirements & Controls

- [ ] **HTML Entrypoints (`*.html`):**
  - Header: `Cache-Control: public, max-age=0, must-revalidate` (or `no-cache`).
  - Ensures browsers always check the server for fresh versions of `index.html` and project pages.
- [ ] **Content-Hashed Static Assets (`assets/*`, hashed `.js`, `.css`):**
  - Header: `Cache-Control: public, max-age=31536000, immutable`.
  - Safe for long-term caching because content changes result in new file names (asset fingerprinting).
- [ ] **Un-hashed Script / Style Assets:**
  - Header: `Cache-Control: public, max-age=3600, must-revalidate`.
- [ ] **ETag Support:** Ensure `ETag` or `Last-Modified` validation headers are enabled on the host to enable efficient HTTP 304 Not Modified revalidation.
- [ ] **Release Asset Checksums & Integrity:**
  - Every downloadable release artifact (`.tar.gz`, `.zip`, bundles) must be published with accompanying `SHA256SUMS`, `SHA512SUMS`, and `release-integrity.json` manifests generated via `npm run release:checksums`.
  - Consumers must be provided verification instructions (`npm run verify:release-integrity`, `sha256sum -c SHA256SUMS`, or PowerShell `Get-FileHash`) per [RELEASE_INTEGRITY.md](RELEASE_INTEGRITY.md).


---

## 9. Credentials, Secrets & Information Disclosure

Static client-side repositories must never expose internal infrastructure, private tokens, or unnecessary server banners.

### Requirements & Controls

- [ ] **Zero Committed Secrets:** Verify no API keys, private certificates, SSH keys, or cloud credentials exist in source code or git history (refer to [CREDENTIALS_AND_SECRETS.md](CREDENTIALS_AND_SECRETS.md)).
- [ ] **No Development / Scratch Files:** Verify that temporary test scripts, `.env` files, `.DS_Store`, or scratch files are excluded via `.gitignore`.
- [ ] **Server Software Banner Suppression:** Disable or strip revealing server identification headers:
  - Remove `Server` (or genericize to `Server: webserver`)
  - Remove `X-Powered-By`
  - Remove `X-AspNet-Version` / `X-Runtime`
- [ ] **Custom 404 & Error Pages:** Provide clean, generic 404 and 500 error pages without debug stack traces, source file paths, or directory indexes.
- [ ] **Directory Listing Disabled:** Ensure the web server disallows directory indexing (`autoindex off`).

---

## 10. Pre-Flight Verification & Sign-Off Matrix

Complete this sign-off matrix prior to executing any production deployment or major release:

| #   | Security Control Domain          | Verification Step / Command                    | Target Result                            | Sign-Off |
| --- | -------------------------------- | ---------------------------------------------- | ---------------------------------------- | :------: |
| 1   | **HTTPS Enforcement**            | `curl -s -I http://<domain>`                   | HTTP 301/308 redirect to HTTPS           |   [ ]    |
| 2   | **TLS Protocols & Ciphers**      | SSL Labs or `openssl s_client`                 | A+ rating; TLS 1.2 & 1.3 only            |   [ ]    |
| 3   | **HSTS Configuration**           | `curl -s -I https://<domain>`                  | `max-age >= 31536000; includeSubDomains` |   [ ]    |
| 4   | **CSP Validation**               | Inspect `Content-Security-Policy` header       | No console CSP violations on main pages  |   [ ]    |
| 5   | **SRI Integrity**                | `npm run validate:mini-contract`               | 0 errors; all remote scripts carry SRI   |   [ ]    |
| 6   | **Clickjacking Defense**         | Verify `X-Frame-Options` & `frame-ancestors`   | `SAMEORIGIN` / `frame-ancestors 'self'`  |   [ ]    |
| 7   | **MIME-Sniffing Defense**        | Verify `X-Content-Type-Options`                | Header set to `nosniff`                  |   [ ]    |
| 8   | **Referrer Privacy**             | Verify `Referrer-Policy`                       | `strict-origin-when-cross-origin`        |   [ ]    |
| 9   | **Permissions Policy**           | Verify `Permissions-Policy`                    | Restricted hardware features disabled    |   [ ]    |
| 10  | **Dependency Vulnerabilities**   | `npm run audit:deps`                           | 0 High or Critical vulnerabilities       |   [ ]    |
| 11  | **Dynamic Eval Guard**           | `npm run validate:no-dynamic-eval`             | Clean pass; zero unapproved eval calls   |   [ ]    |
| 12  | **Worker Integrity Registry**    | `npm run validate:worker-integrity`            | All worker SHA-256 digests match disk    |   [ ]    |
| 13  | **postMessage Recursion Guards** | `node --test tests/message-validation.test.js` | Depth limits & cycle detection pass      |   [ ]    |
| 14  | **Secrets & Leaks Check**        | Search repository for `.env`, tokens           | Zero credentials in repo or bundles      |   [ ]    |
| 15  | **Server Banner Stripping**      | Verify `Server` and `X-Powered-By`             | Banners omitted or minimized             |   [ ]    |
| 16  | **Cache Header Partitioning**    | Verify `Cache-Control` on HTML vs assets       | Revalidate HTML; immutable hashed assets |   [ ]    |

---

## Server Configuration Reference Snippets

### Nginx

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com www.example.com;

    # TLS Certificates & Protocols
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Hardened Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://huggingface.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';" always;

    # Information Disclosure Prevention
    server_tokens off;
    autoindex off;

    root /var/www/cradle;
    index index.html;

    # Caching Strategy
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "public, max-age=0, must-revalidate";
    }

    location ~* \.(?:css|js|woff2?|svg|png|jpg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

### Caddy (Caddyfile)

```caddy
example.com {
    root * /var/www/cradle
    file_server

    # Security Headers
    header {
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
        Content-Security-Policy "default-src 'self'; script-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://huggingface.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';"
        -Server
    }

    # Cache Headers
    @html path *.html /
    header @html Cache-Control "public, max-age=0, must-revalidate"

    @static path *.css *.js *.woff2 *.svg *.png *.jpg *.ico
    header @static Cache-Control "public, max-age=31536000, immutable"
}
```

### Vercel (`vercel.json`)

For production and preview hosting on Vercel (`https://cradle-zeta.vercel.app`), security headers are configured at the routing layer in `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "X-Frame-Options",
          "value": "SAMEORIGIN"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), display-capture=()"
        },
        {
          "key": "Content-Security-Policy-Report-Only",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://huggingface.co https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; img-src 'self' data: blob: https:; media-src 'self' data: blob:; connect-src 'self' https: data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';"
        }
      ]
    }
  ]
}
```

#### Header Rationale & Purpose:

- **`X-Content-Type-Options: nosniff`**: Prevents browser MIME-type sniffing of served static files, protecting against script execution attacks disguised as images or text files.
- **`Referrer-Policy: strict-origin-when-cross-origin`**: Restricts referrer URL leakage on cross-origin requests while preserving origin tracking for legitimate analytics and navigation.
- **`X-Frame-Options: SAMEORIGIN`**: Mitigates clickjacking and UI redressing by disallowing external origins from embedding Cradle inside iframes.
- **`Permissions-Policy: camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), display-capture=()`**: Restricts access to sensitive browser device APIs. Allows `camera` and `microphone` for same-origin pages so interactive minis (`projects/misc/ascii-camera`, `projects/misc/audio-spectrogram-analyzer`, `projects/misc/sound-wave-visualizer`) function without disruption, while strictly denying unused hardware features (`geolocation`, `payment`, `usb`, `display-capture`).
- **`Content-Security-Policy-Report-Only`**: Enforces a least-privilege content boundary in Report-Only mode, monitoring script, stylesheet, worker, and frame sources without breaking active minis, workers, or dynamic canvas/script tools.

---

## References & External Standards

- [Mozilla Observatory](https://observatory.mozilla.org/) — Automated scanner for TLS, CSP, and security headers.
- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/) — Authoritative best practices for HTTP headers.
- [HSTS Preload Submission](https://hstspreload.org/) — Global browser HSTS preload list criteria and verification.
- [Qualys SSL Labs](https://www.ssllabs.com/ssltest/) — Comprehensive server SSL/TLS cipher and certificate auditing.
- [Cradle Security Policy](SECURITY.md) — Security practices, worker integrity model, and vulnerability reporting.
- [Cradle Third-Party Policy](THIRD_PARTY_POLICY.md) — Rules for external model and script loading.
- [Cradle Credentials & Secrets Policy](CREDENTIALS_AND_SECRETS.md) — Guidelines for eliminating secrets from code and history.
- [Cradle Storage Policy](STORAGE_POLICY.md) — Client storage persistence, isolation, and conflict resolution.

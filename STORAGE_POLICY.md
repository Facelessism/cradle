# Storage API, Persistence Strategy & Sensitive Data Policy

Because Cradle consists of dozens of independent mini-projects living on the same domain, unmanaged use of browser storage (like `localStorage`, `sessionStorage`, or `IndexedDB`) can lead to key collisions, corrupted state, quota exhaustion, privacy leaks of sensitive user data, and unhandled exceptions in restrictive environments.

This policy defines the repository-wide persistence abstraction, sensitive data minimization requirements, and data retention strategy that all mini-projects must follow.

---

## 1. Mandatory Abstraction

Direct calls to `window.localStorage` are **strictly forbidden** in all new projects.

All projects must use the `cradle-storage` plugin (via `Cradle.extensions`) or the `CradleStorage` UI utility (`src/components/ui/storage.js`) to interact with browser storage. This guarantees uniform key prefixing, JSON serialization, safe error handling, bounded numeric validation, and time-to-live (TTL) expiration support.

### How to access storage securely:

```javascript
// Preferred: Using the Plugin Extension Model
const storage = Cradle.extensions.use("cradle-storage", {
  namespace: "my_project_",
});
storage.set("score", 100);
```

```javascript
// Alternative: Using the UI utility directly (if not using the plugin model)
const store = window.CradleStorage.namespace("my_project_");
store.set("score", 100);
```

---

## 2. Quota Handling & Fallback Behavior

Many users browse in Private/Incognito modes where storage APIs are either physically disabled or artificially quota-limited (e.g., to 0 bytes).

- **Graceful Degradation**: You must not wrap your entire application in a `try/catch` or allow it to crash if storage fails. The `CradleStorage` abstraction automatically detects storage availability and falls back to an **in-memory** map. Your code should seamlessly continue to function (though data will be lost on refresh).
- **Do not assume persistence**: UI flows should ideally warn users if storage is ephemeral (e.g., `"Warning: High scores will not be saved in Private Browsing mode."`).

---

## 3. Data Validation & Corruption Resilience

Data on a user's machine can become corrupted, or a previous version of your mini-project may have saved data in an incompatible format.

- **Mandatory Schema Validation**: When reading complex JSON structures, you must provide a validation function to `get()`. If the validation fails, the storage utility will safely discard the corrupted payload and return your provided fallback value.

```javascript
// Good: Validates the parsed object shape
const defaultSettings = { theme: "dark", soundEnabled: true };
const validateSettings = s =>
  typeof s?.theme === "string" && typeof s?.soundEnabled === "boolean";

const settings = storage.get("settings", defaultSettings, validateSettings);
```

- **Numeric Bounds for Scores and Persisted Counters**: Game scores, streaks, match statistics, and user-supplied numeric values must be bounded and validated before use. Discard or clamp negative values, `NaN`, `Infinity`, or values exceeding safe numeric limits (`Number.MAX_SAFE_INTEGER` or domain-specific maximums) using `CradleStorage.getNumber()` or `CradleStorage.clampNumber()` to prevent overflow, distortion, and inconsistent state.

```javascript
// Good: Validates safe numeric bounds for persisted high score
const highScore = storage.getNumber("high_score", 0, {
  min: 0,
  max: Number.MAX_SAFE_INTEGER,
  integer: true,
});
```

---

## 4. When to use IndexedDB

`localStorage` is synchronous and blockingly slow for large payloads. It is capped at around ~5MB total for the entire domain.

You must step up to IndexedDB if your project:
- Stores binary data, Blobs, or File objects.
- Routinely saves payloads larger than 500KB.
- Requires complex indexing or relational queries.

*Note: Projects using `window.indexedDB` (such as `knowledge-graph`) must explicitly handle `onupgradeneeded`, `onerror`, and quota limitations.*

---

## 5. Cross-Tab Synchronization (Conflict Resolution)

If a user has the same mini-project open in two different tabs, race conditions can destroy data (e.g., Tab A saves level 5, Tab B overwrites it with level 2).

- **Storage Events**: If your project maintains long-lived state, you must listen to the `storage` event (or use a `BroadcastChannel`) to synchronize state across tabs.
- **Conflict Strategy**: The standard conflict resolution strategy for Cradle is **Last Write Wins (LWW)** unless a more complex CRDT or timestamp-based merge is implemented by the project.

```javascript
// Example: Syncing state across tabs
window.addEventListener("storage", event => {
  // Ignore events not related to our namespace
  if (!event.key || !event.key.startsWith("my_project_")) return;

  // Reload the updated data into memory and refresh the UI
  refreshGameStateFromStorage();
});
```

---

## 6. Sensitive Client-Side Data & Minimization Strategy

Because browser storage (`localStorage`, `IndexedDB`) stores data unencrypted in the user's browser profile, any client-side persistence presents exposure risks on shared computers, public kiosks, and multi-user environments.

### 6.1 Data Sensitivity Classification Matrix

| Tier | Sensitivity Level | Examples | Persistence Rules |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **Public / Non-Sensitive** | UI Theme (`"light"`/`"dark"`), layout toggles, sound preferences, volume levels. | Safe for standard `localStorage` with long-term retention. |
| **Tier 2** | **Pseudonymous / Telemetry** | High scores, gameplay statistics, win streaks, anonymous session counts. | Safe for `localStorage` with bounded numeric validation. |
| **Tier 3** | **Personal User Content (PII)** | Resumes (`markdown-resume-generator`), Invoices (`invoice-generator`), personal notes (`markdown-editor`, `brain-dump-collector`), student/employee attendance lists (`attendance-tracker`), daily schedules (`time-blocking-planner`). | **High Sensitivity**. Must minimize stored fields, offer an explicit "Clear / Reset Data" action, and support session-only persistence or TTL expiration. |
| **Tier 4** | **Restricted / Critical Secrets** | API keys, passwords, bearer tokens, OAuth secrets, session cookies, payment card / banking credentials. | **STRICTLY PROHIBITED**. Must NEVER be persisted to browser storage. |

### 6.2 The Zero-Storage Rule for Secrets (Tier 4)

- **Never Persist Credentials**: Client-side storage must never hold authentication tokens, private API keys (e.g. OpenAI, Anthropic, AWS, GitHub tokens), passwords, or financial account credentials.
- **Transient Memory Only**: If a mini allows a user to supply an ephemeral key for direct client-to-API requests, that key must remain strictly in JavaScript memory for the current page session. It must never be written to `localStorage`, `sessionStorage`, or `IndexedDB`.

### 6.3 Data Minimization Principles

1. **Store Only What Is Needed**: Do not serialize full application state trees or DOM nodes. Store raw configuration data or compact state vectors.
2. **Pseudonymize Where Feasible**: Avoid using actual user names or emails as keys or record identifiers. Use local random IDs (e.g. `crypto.randomUUID()`).
3. **Strip Sensitive Inputs**: In tools accepting mixed input (e.g., resumes, forms), do not log or mirror inputs to auxiliary storage keys.

---

## 7. Data Retention & Expiration Lifecycle

By browser specification, `localStorage` has **no native expiration mechanism**. Data remains permanently on disk until explicitly cleared by the user or website. This poses significant privacy risks for Tier 3 personal content.

### 7.1 Time-To-Live (TTL) Support in `CradleStorage`

`CradleStorage` provides built-in TTL and auto-expiration APIs:

```javascript
const store = CradleStorage.namespace("cradle_invoice_");

// Save an invoice draft with a 14-day retention TTL (in milliseconds)
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
store.setWithExpiry("draft", invoiceData, FOURTEEN_DAYS_MS);

// Read draft: automatically returns fallback and purges storage if expired
const draft = store.getWithExpiry("draft", null);

// Prune all expired keys in this namespace on startup
store.pruneExpired();
```

### 7.2 Session Storage for Ephemeral / Sensitive Data

For highly sensitive drafts or temporary calculations that should never survive a browser restart or tab closure, use the `session` adapter:

```javascript
// Operates on window.sessionStorage with safe in-memory fallback
const sessionStore = CradleStorage.session.namespace("cradle_scratchpad_");
sessionStore.set("draft_content", sensitiveNotes);
```

### 7.3 Recommended Retention Schedules

| Data Category | Target Store | Recommended Retention | Cleanup Trigger |
| :--- | :--- | :--- | :--- |
| **UI Preferences** | `localStorage` | Indefinite | User clears browser data or changes setting. |
| **Game High Scores** | `localStorage` | Indefinite | User resets high score or clears data. |
| **Activity History / Logs** | `localStorage` | Rolling window (e.g. max 50 entries) | Pruned FIFO when inserting new entries. |
| **Draft Personal Documents** | `localStorage` / `sessionStorage` | 14 to 30 days maximum (via `setWithExpiry`) or session-only | Auto-pruned on expiration or via explicit "Clear" button. |
| **Temporary Scratchpads** | `sessionStorage` | Tab session | Auto-purged when the browser tab closes. |

---

## 8. User Privacy & Data Management Controls

Every mini-project that persists Tier 3 user-created content (resumes, invoices, notes, attendance logs, calendars) **MUST** provide:

1. **Clear / Reset Data Action**: An easily discoverable button or control (e.g., `"Clear Saved Data"` or `"Reset Form"`) that invokes `store.clear()` or deletes the project's keys.
2. **Confirmation Dialog**: Prompting the user before irreversible local data deletion.
3. **Export / Portability**: When practical, allow users to download their data as a standard JSON or text file (e.g. export markdown resume, export invoice JSON) so they do not rely on browser storage for permanent backup.

---

## 9. Comprehensive Client-Side Data Audit & Inventory

The table below catalogs every known client-side storage key across the Cradle repository:

| Project | Storage Mechanism | Key / Prefix | Data Stored | Sensitivity Tier | Retention Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Landing Shell** | `localStorage` | `theme` | UI theme (`"dark"`/`"light"`) | Tier 1 (Public) | Indefinite |
| **Landing Shell** | `localStorage` | `cradle_recent_projects_collapsed` | Boolean accordion collapse state | Tier 1 (Public) | Indefinite |
| **Landing Shell** | `localStorage` | `cradle_recent_projects` | Array of recently opened project paths | Tier 1 (Public) | Rolling window (max 6 items) |
| **ThemeToggle** | `localStorage` | `theme` | Global theme preference | Tier 1 (Public) | Indefinite |
| **2048 Game** | `localStorage` | `cradle_2048_best_*` | High score per grid size (3x3, 4x4, etc.) | Tier 2 (Pseudonymous) | Indefinite |
| **Cannon Shooting** | `localStorage` | `cradle_cannon_high_score` | Best score, sound toggle | Tier 2 (Pseudonymous) | Indefinite |
| **Snake Game** | `localStorage` | `cradle_snake_high_score` | High score number | Tier 2 (Pseudonymous) | Indefinite |
| **Ludo Game** | `localStorage` | `cradle_ludo_save` | Board piece positions, active turn | Tier 2 (Pseudonymous) | Overwritten per turn; clearable |
| **Dot Game** | `localStorage` | `cradle_dot_game_history` | Array of past match results | Tier 2 (Pseudonymous) | Bounded history |
| **Typing Speed Racer** | `localStorage` | `cradle:typing-racer-best-wpm`| Best words-per-minute number | Tier 2 (Pseudonymous) | Indefinite |
| **Wordle Clone** | `localStorage` | `cradle-wordle-theme` | Color scheme preference | Tier 1 (Public) | Indefinite |
| **Pomodoro Timer** | `localStorage` | `pomodoro-*` | Focus minutes, streaks, session log | Tier 2 (Pseudonymous) | Indefinite; user reset available |
| **Unit Converter** | `localStorage` | `uc_history` | Recent unit conversion pairs | Tier 1 (Public) | Rolling window (max 20 entries) |
| **Markdown Resume Generator** | `localStorage` | `cradle:markdown-resume`, `cradle:resume-*` | Resume markdown (Name, contact info, job history) | **Tier 3 (PII / High)** | User-controlled draft; export available |
| **Invoice Generator** | `localStorage` | `invoice_data` / `cradle_invoice_data` | Client names, line items, amounts, addresses | **Tier 3 (Financial / PII)** | User-controlled draft; clear button present |
| **Markdown Editor** | `localStorage` | `md_editor_content` | Unsaved note content | **Tier 3 (Personal)** | User-controlled draft; clearable |
| **Brain Dump Collector** | `localStorage` | `brain_dump_notes` | Freeform notes and ideas | **Tier 3 (Personal)** | User-managed note list; delete available |
| **Attendance Tracker** | `localStorage` | `att_v5` | Group/class attendance records and names | **Tier 3 (PII)** | Local records; export available |
| **Time Blocking Planner** | `localStorage` | `cradle_time_blocks_*` | Daily schedule entries and task blocks | **Tier 3 (Personal)** | Daily blocks; reset action available |
| **Reading Progress Tracker** | `localStorage` | `reading_tracker_data` | Book titles, progress percentages, notes | **Tier 3 (Personal)** | User-managed list |
| **Flashcard Study** | `localStorage` | `flashcard_decks` | Custom flashcard decks and review scores | Tier 2 / 3 (Personal) | User-managed decks |
| **Knowledge Graph** | `IndexedDB` | `cradle-knowledge-graph` | Custom nodes, edges, labels | **Tier 3 (Personal)** | Database storage; export available |
| **Storage Inspector** | `sessionStorage` / `localStorage` | `cradle_user_id`, `tab_id` | Mock inspector data | Tier 1 (Mock dev data) | Clearable via inspector UI |

---

## 10. Compliance Checklist for Mini Authors

Before submitting a PR for any project that persists state:

- [ ] All storage calls go through `CradleStorage` (or `cradle-storage` plugin); zero direct `window.localStorage` calls.
- [ ] Keys are namespaced using `CradleStorage.namespace("my_project_")`.
- [ ] No secrets, tokens, API keys, or passwords are ever stored (Tier 4).
- [ ] Numeric scores and counters use `getNumber()` or `clampNumber()` with explicit bounds.
- [ ] Schema validation is provided to `get(key, fallback, validator)`.
- [ ] If storing personal user content (Tier 3), an explicit "Clear / Reset Data" control is provided in the UI.
- [ ] For temporary or sensitive drafts, `setWithExpiry()` or `CradleStorage.session` is evaluated.

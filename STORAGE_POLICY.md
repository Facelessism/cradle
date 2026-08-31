# Storage API & Conflict-Resolution Strategy

Because Cradle consists of dozens of independent mini-projects living on the same domain, unmanaged use of browser storage (like `localStorage` or `IndexedDB`) can lead to key collisions, corrupted state, quota exhaustion, and unhandled exceptions in restrictive environments.

This policy defines the repository-wide persistence abstraction that all mini-projects must follow.

---

## 1. Mandatory Abstraction

Direct calls to `window.localStorage` are **strictly forbidden** in all new projects.

All projects must use the `cradle-storage` plugin (via `Cradle.extensions`) or the `CradleStorage` UI utility to interact with local storage. This guarantees uniform key prefixing, JSON serialization, and error handling.

### How to access storage securely:

```javascript
// Preferred: Using the Plugin Extension Model
const storage = Cradle.extensions.use('cradle-storage', { namespace: 'my_project_' });
storage.set('score', 100);
```

```javascript
// Alternative: Using the UI utility directly (if not using the plugin model)
const store = window.CradleStorage.namespace('my_project_');
store.set('score', 100);
```

## 2. Quota Handling & Fallback Behavior

Many users browse in Private/Incognito modes where storage APIs are either physically disabled or artificially quota-limited (e.g., to 0 bytes).

- **Graceful Degradation**: You must not wrap your entire application in a `try/catch` or allow it to crash if storage fails. The `CradleStorage` abstraction automatically detects storage availability and falls back to an **in-memory** map. Your code should seamlessly continue to function (though data will be lost on refresh).
- **Do not assume persistence**: UI flows should ideally warn users if storage is ephemeral (e.g., `"Warning: High scores will not be saved in Private Browsing mode."`).

## 3. Data Validation & Corruption Resilience

Data on a user's machine can become corrupted, or a previous version of your mini-project may have saved data in an incompatible format.

- **Mandatory Schema Validation**: When reading complex JSON structures, you must provide a validation function to `get()`. If the validation fails, the storage utility will safely discard the corrupted payload and return your provided fallback value.

```javascript
// Good: Validates the parsed object shape
const defaultSettings = { theme: 'dark', soundEnabled: true };
const validateSettings = (s) => typeof s?.theme === 'string' && typeof s?.soundEnabled === 'boolean';

const settings = storage.get('settings', defaultSettings, validateSettings);
```

## 4. When to use IndexedDB

`localStorage` is synchronous and blockingly slow for large payloads. It is capped at around ~5MB total for the entire domain.

You must step up to IndexedDB if your project:
- Stores binary data, Blobs, or File objects.
- Routinely saves payloads larger than 500KB.
- Requires complex indexing or relational queries.

*Note: Cradle does not currently provide a unified IndexedDB wrapper, but projects using `window.indexedDB` must explicitly handle `onupgradeneeded`, `onerror`, and quota limitations.*

## 5. Cross-Tab Synchronization (Conflict Resolution)

If a user has the same mini-project open in two different tabs, race conditions can destroy data (e.g., Tab A saves level 5, Tab B overwrites it with level 2).

- **Storage Events**: If your project maintains long-lived state, you must listen to the `storage` event (or use a `BroadcastChannel`) to synchronize state across tabs.
- **Conflict Strategy**: The standard conflict resolution strategy for Cradle is **Last Write Wins (LWW)** unless a more complex CRDT or timestamp-based merge is implemented by the project.

```javascript
// Example: Syncing state across tabs
window.addEventListener('storage', (event) => {
  // Ignore events not related to our namespace
  if (!event.key || !event.key.startsWith('my_project_')) return;
  
  // Reload the updated data into memory and refresh the UI
  refreshGameStateFromStorage();
});
```

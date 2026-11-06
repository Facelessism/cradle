/**
 * Cradle UI — CradleDB (IndexedDB Projects Registry Cache Layer & Cross-Tab Sync)
 * ──────────────────────────────────────────────────────────────────────────────
 * Provides client-side caching for `data/projects.json` using IndexedDB, paired
 * with real-time multi-tab state synchronization via the native BroadcastChannel API.
 * Reduces redundant network requests on subsequent page loads while ensuring
 * graceful fallbacks for cache misses, corrupted stores, private browsing SecurityErrors,
 * schema version upgrades, and environments without BroadcastChannel support.
 */

export const DB_NAME = "CradleDB";
export const DB_VERSION = 1;
export const STORE_NAME = "projectsStore";
export const PROJECTS_KEY = "projects";

/**
 * Default name for the BroadcastChannel used for cross-tab synchronization.
 */
export const SYNC_CHANNEL_NAME = "cradle-db-sync";

/**
 * Standard message types dispatched across the sync channel.
 */
export const SYNC_MESSAGE_TYPES = Object.freeze({
  INVALIDATE: "invalidate",
  UPDATE: "update",
  DELETE: "delete",
  CLEAR: "clear",
});

/**
 * Generates a unique client/tab identifier to prevent self-echo loops during broadcasting.
 *
 * @returns {string} Unique identifier
 */
export function generateTabId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `tab_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`;
}

/**
 * Resolves the available IndexedDB factory.
 * Accepts a custom instance (e.g. fake-indexeddb in tests) or falls back
 * to window.indexedDB or global indexedDB.
 *
 * @param {IDBFactory|null} [customInstance=null]
 * @returns {IDBFactory|null}
 */
export function getIndexedDBFactory(customInstance = null) {
  if (customInstance) return customInstance;
  if (typeof indexedDB !== "undefined") return indexedDB;
  if (typeof window !== "undefined" && window.indexedDB)
    return window.indexedDB;
  return null;
}

/**
 * Resolves the available BroadcastChannel constructor.
 * Accepts a custom class (e.g. mock class in tests) or falls back
 * to global BroadcastChannel or window.BroadcastChannel.
 *
 * @param {Function|null} [customInstance=null]
 * @returns {Function|null} BroadcastChannel constructor or null if unsupported
 */
export function getBroadcastChannelFactory(customInstance = null) {
  if (customInstance) return customInstance;
  if (typeof BroadcastChannel !== "undefined") return BroadcastChannel;
  if (typeof window !== "undefined" && window.BroadcastChannel) {
    return window.BroadcastChannel;
  }
  return null;
}

/**
 * Synchronization channel controller wrapping the native BroadcastChannel API.
 * Manages listeners, attaches unique tab IDs, and provides self-echo suppression.
 */
export class CradleSyncChannel {
  /**
   * @param {Object} [options={}]
   * @param {string} [options.channelName=SYNC_CHANNEL_NAME]
   * @param {Function|null} [options.broadcastChannelClass=null]
   * @param {string|null} [options.tabId=null]
   */
  constructor({
    channelName = SYNC_CHANNEL_NAME,
    broadcastChannelClass = null,
    tabId = null,
  } = {}) {
    this.channelName = channelName;
    this.tabId = tabId || generateTabId();
    this.listeners = new Set();
    this.channel = null;

    const ChannelClass = getBroadcastChannelFactory(broadcastChannelClass);
    if (ChannelClass) {
      try {
        this.channel = new ChannelClass(channelName);
        this.channel.onmessage = event => this._handleMessage(event);
      } catch (err) {
        console.warn("Failed to initialize BroadcastChannel in CradleDB:", err);
        this.channel = null;
      }
    }
  }

  /**
   * Internal message handler. Filters out messages sent by this tab to avoid self-echoes.
   *
   * @private
   * @param {MessageEvent} event
   */
  _handleMessage(event) {
    const payload = event && event.data;
    if (!payload || typeof payload !== "object") return;

    // Discard messages broadcasted by this instance/tab to prevent self-echo loops
    if (payload.senderId && payload.senderId === this.tabId) return;

    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch (listenerErr) {
        console.error("Error in CradleDB sync listener callback:", listenerErr);
      }
    }
  }

  /**
   * Broadcasts a state change or cache invalidation message to other tabs.
   *
   * @param {Object} [messageOptions={}]
   * @param {string} [messageOptions.type=SYNC_MESSAGE_TYPES.INVALIDATE]
   * @param {string} [messageOptions.storeName=STORE_NAME]
   * @param {string} [messageOptions.key=PROJECTS_KEY]
   * @param {*} [messageOptions.data=null]
   * @param {number} [messageOptions.timestamp=Date.now()]
   * @param {Object|null} [messageOptions.metadata=null]
   * @returns {boolean} True if postMessage succeeded, false otherwise
   */
  broadcast({
    type = SYNC_MESSAGE_TYPES.INVALIDATE,
    storeName = STORE_NAME,
    key = PROJECTS_KEY,
    data = null,
    timestamp = Date.now(),
    metadata = null,
  } = {}) {
    const message = {
      type,
      storeName,
      key,
      data,
      timestamp: timestamp || Date.now(),
      senderId: this.tabId,
      metadata,
    };

    if (this.channel && typeof this.channel.postMessage === "function") {
      try {
        this.channel.postMessage(message);
        return true;
      } catch (err) {
        console.warn("Failed to post message to BroadcastChannel:", err);
        return false;
      }
    }
    return false;
  }

  /**
   * Subscribes a listener to cross-tab synchronization events.
   *
   * @param {Function} callback Callback receiving message payload
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    if (typeof callback !== "function") return () => {};
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Closes the underlying BroadcastChannel and clears all subscribers.
   */
  close() {
    this.listeners.clear();
    if (this.channel && typeof this.channel.close === "function") {
      try {
        this.channel.close();
      } catch {
        // no-op on close error
      }
      this.channel = null;
    }
  }
}

let defaultSyncChannel = null;

/**
 * Gets or lazily initializes the default CradleSyncChannel singleton.
 *
 * @param {Object} [options={}]
 * @param {boolean} [options.forceNew=false]
 * @returns {CradleSyncChannel}
 */
export function getSyncChannel({ forceNew = false, ...options } = {}) {
  if (!defaultSyncChannel || forceNew) {
    if (defaultSyncChannel && forceNew) {
      defaultSyncChannel.close();
    }
    defaultSyncChannel = new CradleSyncChannel(options);
  }
  return defaultSyncChannel;
}

/**
 * Sets a custom default sync channel instance (useful for testing or custom configuration).
 *
 * @param {CradleSyncChannel|null} channelInstance
 */
export function setSyncChannel(channelInstance) {
  defaultSyncChannel = channelInstance;
}

/**
 * Closes and resets the default sync channel.
 */
export function closeSyncChannel() {
  if (defaultSyncChannel) {
    defaultSyncChannel.close();
    defaultSyncChannel = null;
  }
}

/**
 * Broadcasts a state change or cache invalidation to other tabs using the default or provided sync channel.
 *
 * @param {Object} messageOptions
 * @param {CradleSyncChannel} [syncChannel=null]
 * @returns {boolean} True if broadcast succeeded
 */
export function broadcastSync(messageOptions, syncChannel = null) {
  const channel = syncChannel || getSyncChannel();
  return channel.broadcast(messageOptions);
}

/**
 * Subscribes a listener callback to cross-tab synchronization events.
 *
 * @param {Function} callback
 * @param {CradleSyncChannel} [syncChannel=null]
 * @returns {Function} Unsubscribe function
 */
export function subscribeToSync(callback, syncChannel = null) {
  const channel = syncChannel || getSyncChannel();
  return channel.subscribe(callback);
}

/**
 * Opens the CradleDB IndexedDB database.
 * Handles store creation and automatic cache invalidation on version upgrade.
 *
 * @param {Object} [options={}]
 * @param {string} [options.dbName=DB_NAME] - Database name
 * @param {number} [options.version=DB_VERSION] - Database schema version
 * @param {IDBFactory} [options.indexedDBInstance=null] - Optional injected IndexedDB factory
 * @returns {Promise<IDBDatabase>}
 */
export function openDB({
  dbName = DB_NAME,
  version = DB_VERSION,
  indexedDBInstance = null,
} = {}) {
  return new Promise((resolve, reject) => {
    let idb;
    try {
      idb = getIndexedDBFactory(indexedDBInstance);
    } catch (accessErr) {
      return reject(accessErr);
    }

    if (!idb) {
      const err = new Error(
        "IndexedDB is not supported or accessible in this environment."
      );
      err.name = "SecurityError";
      return reject(err);
    }

    let request;
    try {
      request = idb.open(dbName, version);
    } catch (openErr) {
      return reject(openErr);
    }

    request.onerror = () => {
      reject(
        request.error ||
          new Error("Failed to open CradleDB IndexedDB database.")
      );
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = event => {
      try {
        const db = event.target.result;
        const transaction = event.target.transaction;
        const oldVersion = event.oldVersion;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, {
            keyPath: "id",
          });
        } else if (oldVersion > 0 && oldVersion < event.newVersion) {
          // Version upgrade: purge stale cache so it can be cleanly repopulated
          const store = transaction.objectStore(STORE_NAME);
          store.clear();
        }
      } catch (upgradeErr) {
        // Upgrade transaction error
      }
    };
  });
}

/**
 * Retrieves cached project data from the IndexedDB store.
 * Validates integrity and falls back gracefully to `null` if the store is empty,
 * missing, or contains corrupted data (e.g. malformed JSON or non-array).
 *
 * @param {IDBDatabase} db - Opened IndexedDB instance
 * @param {string} [storeName=STORE_NAME] - Object store name
 * @param {string} [key=PROJECTS_KEY] - Primary key for cached record
 * @returns {Promise<Array|null>} Resolves to array of projects, or null on cache miss/corruption.
 */
export function getCachedProjects(
  db,
  storeName = STORE_NAME,
  key = PROJECTS_KEY
) {
  return new Promise(resolve => {
    if (!db || typeof db.transaction !== "function") {
      return resolve(null);
    }

    try {
      if (!db.objectStoreNames.contains(storeName)) {
        return resolve(null);
      }

      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => {
        resolve(null);
      };

      request.onsuccess = () => {
        try {
          const record = request.result;
          if (!record || record.data === undefined || record.data === null) {
            return resolve(null);
          }

          let data = record.data;

          // If serialized as string, parse it safely
          if (typeof data === "string") {
            try {
              data = JSON.parse(data);
            } catch {
              // Corrupted JSON string in store
              return resolve(null);
            }
          }

          // Projects registry MUST be an array
          if (!Array.isArray(data)) {
            return resolve(null);
          }

          resolve(data);
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Stores projects array directly in the IndexedDB store and optionally broadcasts an update message.
 *
 * @param {IDBDatabase} db - Opened IndexedDB instance
 * @param {Array} projects - Projects list to store
 * @param {Object} [options={}]
 * @param {string} [options.storeName=STORE_NAME]
 * @param {string} [options.key=PROJECTS_KEY]
 * @param {boolean} [options.broadcast=true]
 * @param {CradleSyncChannel} [options.syncChannel=null]
 * @returns {Promise<boolean>} Resolves to true when stored successfully
 */
export function setCachedProjects(
  db,
  projects,
  {
    storeName = STORE_NAME,
    key = PROJECTS_KEY,
    broadcast = true,
    syncChannel = null,
  } = {}
) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(projects)) {
      return reject(new TypeError("Projects data must be an array."));
    }
    if (!db || typeof db.transaction !== "function") {
      return resolve(false);
    }

    try {
      if (!db.objectStoreNames.contains(storeName)) {
        return resolve(false);
      }

      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const record = {
        id: key,
        data: projects,
        cachedAt: Date.now(),
      };
      const request = store.put(record);

      request.onerror = () => {
        reject(
          request.error ||
            new Error("Failed to write projects to IndexedDB store.")
        );
      };

      transaction.oncomplete = () => {
        if (broadcast) {
          broadcastSync(
            {
              type: SYNC_MESSAGE_TYPES.UPDATE,
              storeName,
              key,
              data: projects,
            },
            syncChannel
          );
        }
        resolve(true);
      };

      transaction.onerror = () => {
        reject(
          transaction.error ||
            new Error("Transaction error while saving projects.")
        );
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Invalidates and deletes a cached key in IndexedDB and broadcasts an invalidation notice.
 *
 * @param {IDBDatabase|null} db - Opened IndexedDB instance
 * @param {Object} [options={}]
 * @param {string} [options.storeName=STORE_NAME]
 * @param {string} [options.key=PROJECTS_KEY]
 * @param {boolean} [options.broadcast=true]
 * @param {CradleSyncChannel} [options.syncChannel=null]
 * @returns {Promise<boolean>}
 */
export function invalidateCache(
  db,
  {
    storeName = STORE_NAME,
    key = PROJECTS_KEY,
    broadcast = true,
    syncChannel = null,
  } = {}
) {
  return new Promise((resolve, reject) => {
    if (!db || typeof db.transaction !== "function") {
      if (broadcast) {
        broadcastSync(
          {
            type: SYNC_MESSAGE_TYPES.INVALIDATE,
            storeName,
            key,
          },
          syncChannel
        );
      }
      return resolve(true);
    }

    try {
      if (!db.objectStoreNames.contains(storeName)) {
        if (broadcast) {
          broadcastSync(
            {
              type: SYNC_MESSAGE_TYPES.INVALIDATE,
              storeName,
              key,
            },
            syncChannel
          );
        }
        return resolve(true);
      }

      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => {
        reject(
          request.error ||
            new Error("Failed to delete key from IndexedDB store.")
        );
      };

      transaction.oncomplete = () => {
        if (broadcast) {
          broadcastSync(
            {
              type: SYNC_MESSAGE_TYPES.INVALIDATE,
              storeName,
              key,
            },
            syncChannel
          );
        }
        resolve(true);
      };

      transaction.onerror = () => {
        reject(
          transaction.error ||
            new Error("Transaction error while invalidating cache.")
        );
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Clears an entire IndexedDB store and broadcasts a clear notice across tabs.
 *
 * @param {IDBDatabase|null} db
 * @param {Object} [options={}]
 * @param {string} [options.storeName=STORE_NAME]
 * @param {boolean} [options.broadcast=true]
 * @param {CradleSyncChannel} [options.syncChannel=null]
 * @returns {Promise<boolean>}
 */
export function clearStore(
  db,
  { storeName = STORE_NAME, broadcast = true, syncChannel = null } = {}
) {
  return new Promise((resolve, reject) => {
    if (!db || typeof db.transaction !== "function") {
      if (broadcast) {
        broadcastSync(
          {
            type: SYNC_MESSAGE_TYPES.CLEAR,
            storeName,
          },
          syncChannel
        );
      }
      return resolve(true);
    }

    try {
      if (!db.objectStoreNames.contains(storeName)) {
        if (broadcast) {
          broadcastSync(
            {
              type: SYNC_MESSAGE_TYPES.CLEAR,
              storeName,
            },
            syncChannel
          );
        }
        return resolve(true);
      }

      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = () => {
        reject(request.error || new Error("Failed to clear store."));
      };

      transaction.oncomplete = () => {
        if (broadcast) {
          broadcastSync(
            {
              type: SYNC_MESSAGE_TYPES.CLEAR,
              storeName,
            },
            syncChannel
          );
        }
        resolve(true);
      };

      transaction.onerror = () => {
        reject(
          transaction.error ||
            new Error("Transaction error while clearing store.")
        );
      };
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Updates a specific project's metadata or attributes in the cached registry and broadcasts the update.
 * Allows mini-projects to update local state (e.g. stars, user notes, completion stats) across tabs.
 *
 * @param {IDBDatabase} db
 * @param {string} projectId
 * @param {Object} [metadata={}]
 * @param {Object} [options={}]
 * @param {string} [options.storeName=STORE_NAME]
 * @param {string} [options.key=PROJECTS_KEY]
 * @param {boolean} [options.broadcast=true]
 * @param {CradleSyncChannel} [options.syncChannel=null]
 * @returns {Promise<Array>} The updated projects list
 */
export async function updateProjectMetadata(
  db,
  projectId,
  metadata = {},
  {
    storeName = STORE_NAME,
    key = PROJECTS_KEY,
    broadcast = true,
    syncChannel = null,
  } = {}
) {
  if (!projectId) {
    throw new Error("projectId is required to update project metadata.");
  }

  const existingProjects = (await getCachedProjects(db, storeName, key)) || [];
  const projectIndex = existingProjects.findIndex(
    p => p && (p.id === projectId || p.path?.includes(projectId))
  );

  let updatedProject;
  let updatedProjects;

  if (projectIndex >= 0) {
    updatedProject = {
      ...existingProjects[projectIndex],
      ...metadata,
    };
    updatedProjects = [
      ...existingProjects.slice(0, projectIndex),
      updatedProject,
      ...existingProjects.slice(projectIndex + 1),
    ];
  } else {
    updatedProject = {
      id: projectId,
      ...metadata,
    };
    updatedProjects = [...existingProjects, updatedProject];
  }

  await setCachedProjects(db, updatedProjects, {
    storeName,
    key,
    broadcast: false,
  });

  if (broadcast) {
    broadcastSync(
      {
        type: SYNC_MESSAGE_TYPES.UPDATE,
        storeName,
        key,
        data: updatedProjects,
        metadata: {
          projectId,
          updatedProject,
          changes: metadata,
        },
      },
      syncChannel
    );
  }

  return updatedProjects;
}

/**
 * Fetches projects from the network and caches them in IndexedDB if available.
 * Optionally broadcasts the fresh cache update to other tabs.
 *
 * @param {IDBDatabase|null} db - Opened IndexedDB instance (optional)
 * @param {Object} [options={}]
 * @param {string} [options.url="./data/projects.json"] - URL to fetch
 * @param {Function} [options.fetchFn=null] - Optional custom fetch function
 * @param {string} [options.storeName=STORE_NAME] - Object store name
 * @param {string} [options.key=PROJECTS_KEY] - Cache key
 * @param {boolean} [options.broadcast=false] - Whether to broadcast the update
 * @param {CradleSyncChannel} [options.syncChannel=null] - Optional sync channel
 * @returns {Promise<Array>} The fetched projects array
 */
export async function fetchAndCacheProjects(
  db,
  {
    url = "./data/projects.json",
    fetchFn = null,
    storeName = STORE_NAME,
    key = PROJECTS_KEY,
    broadcast = false,
    syncChannel = null,
  } = {}
) {
  const fetcher =
    fetchFn ||
    (typeof fetch === "function"
      ? fetch
      : typeof window !== "undefined" && typeof window.fetch === "function"
        ? window.fetch.bind(window)
        : null);

  if (!fetcher) {
    throw new Error("Fetch API is unavailable.");
  }

  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(
      `Failed to load projects: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Invalid projects payload: expected JSON array.");
  }

  if (db && typeof db.transaction === "function") {
    try {
      if (db.objectStoreNames.contains(storeName)) {
        const transaction = db.transaction([storeName], "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({
          id: key,
          data: data,
          cachedAt: Date.now(),
        });
      }
    } catch (cacheErr) {
      console.warn("Failed to cache projects in IndexedDB:", cacheErr);
    }
  }

  if (broadcast) {
    broadcastSync(
      {
        type: SYNC_MESSAGE_TYPES.UPDATE,
        storeName,
        key,
        data,
      },
      syncChannel
    );
  }

  return data;
}

/**
 * High-level project loading orchestrator:
 * 1. Attempts to open IndexedDB (gracefully catching SecurityErrors in private browsing).
 * 2. Attempts to read cached projects.
 * 3. Returns cached projects on hit.
 * 4. Falls back to network fetch on cache miss, corruption, or database error.
 *
 * @param {Object} [options={}]
 * @param {string} [options.dbName=DB_NAME]
 * @param {number} [options.version=DB_VERSION]
 * @param {IDBFactory} [options.indexedDBInstance=null]
 * @param {Function} [options.fetchFn=null]
 * @param {string} [options.url="./data/projects.json"]
 * @returns {Promise<{projects: Array, fromCache: boolean, db: IDBDatabase|null}>}
 */
export async function loadProjects({
  dbName = DB_NAME,
  version = DB_VERSION,
  indexedDBInstance = null,
  fetchFn = null,
  url = "./data/projects.json",
} = {}) {
  let db = null;

  try {
    db = await openDB({ dbName, version, indexedDBInstance });
    const cachedProjects = await getCachedProjects(db);

    if (cachedProjects && cachedProjects.length > 0) {
      return {
        projects: cachedProjects,
        fromCache: true,
        db,
      };
    }
  } catch (dbErr) {
    // Catches SecurityError, private browsing denial, or initialization failures
    console.warn(
      "IndexedDB unavailable or access denied, falling back to direct fetch:",
      dbErr
    );
  }

  // Cache miss, corrupted data, or IndexedDB unavailable -> fetch from network
  const freshProjects = await fetchAndCacheProjects(db, { url, fetchFn });
  return {
    projects: freshProjects,
    fromCache: false,
    db,
  };
}

export const CradleDB = {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  PROJECTS_KEY,
  SYNC_CHANNEL_NAME,
  SYNC_MESSAGE_TYPES,
  generateTabId,
  getIndexedDBFactory,
  getBroadcastChannelFactory,
  CradleSyncChannel,
  getSyncChannel,
  setSyncChannel,
  closeSyncChannel,
  broadcastSync,
  subscribeToSync,
  openDB,
  getCachedProjects,
  setCachedProjects,
  invalidateCache,
  clearStore,
  updateProjectMetadata,
  fetchAndCacheProjects,
  loadProjects,
};

if (typeof window !== "undefined") {
  window.CradleDB = CradleDB;
}

export default CradleDB;

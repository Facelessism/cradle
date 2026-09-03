/**
 * Storage Manager
 * Wraps IndexedDB with an in-memory fallback for local-first note persistence.
 */
export class StorageManager {
    constructor() {
        this.dbName = 'CradleKnowledgeGraphDB';
        this.storeName = 'notes';
        this.db = null;
        this.memoryStore = new Map();
        this.isIndexedDBAvailable = false;
        this.init();
    }

    async init() {
        try {
            if (!window.indexedDB) throw new Error('IndexedDB not supported');
            this.db = await this.openDB();
            this.isIndexedDBAvailable = true;
        } catch (e) {
            console.warn('IndexedDB failed, falling back to in-memory storage:', e);
            this.isIndexedDBAvailable = false;
        }
    }

    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }

    async saveNote(note) {
        if (this.isIndexedDBAvailable) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction([this.storeName], 'readwrite');
                const store = tx.objectStore(this.storeName);
                const request = store.put(note);
                request.onsuccess = () => resolve(note);
                request.onerror = () => reject(request.error);
            });
        } else {
            this.memoryStore.set(note.id, note);
            return note;
        }
    }

    async getAllNotes() {
        if (this.isIndexedDBAvailable) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction([this.storeName], 'readonly');
                const store = tx.objectStore(this.storeName);
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } else {
            return Array.from(this.memoryStore.values());
        }
    }

    async getNote(id) {
        if (this.isIndexedDBAvailable) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction([this.storeName], 'readonly');
                const store = tx.objectStore(this.storeName);
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } else {
            return this.memoryStore.get(id) || null;
        }
    }

    async deleteNote(id) {
        if (this.isIndexedDBAvailable) {
            return new Promise((resolve, reject) => {
                const tx = this.db.transaction([this.storeName], 'readwrite');
                const store = tx.objectStore(this.storeName);
                const request = store.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        } else {
            this.memoryStore.delete(id);
        }
    }
}

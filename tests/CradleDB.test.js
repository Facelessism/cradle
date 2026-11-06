import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { indexedDB } from "fake-indexeddb";
import {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  PROJECTS_KEY,
  SYNC_CHANNEL_NAME,
  SYNC_MESSAGE_TYPES,
  generateTabId,
  getBroadcastChannelFactory,
  CradleSyncChannel,
  getSyncChannel,
  setSyncChannel,
  closeSyncChannel,
  broadcastSync,
  subscribeToSync,
  setCachedProjects,
  invalidateCache,
  clearStore,
  updateProjectMetadata,
  openDB,
  getCachedProjects,
  fetchAndCacheProjects,
  loadProjects,
  CradleDB,
} from "../src/utils/cradleDb.js";

/**
 * Creates a mock fetch function that responds with provided data or status.
 */
function createMockFetch(data = [], { ok = true, status = 200 } = {}) {
  let callCount = 0;
  const calls = [];

  const mock = async (url, options) => {
    callCount++;
    calls.push({ url, options });

    return {
      ok,
      status,
      statusText: ok ? "OK" : "Error",
      json: async () => data,
    };
  };

  mock.getCallCount = () => callCount;
  mock.getCalls = () => calls;
  return mock;
}

/**
 * Helper to generate unique database names per test to guarantee complete isolation.
 */
let dbCounter = 0;
function getUniqueDbName() {
  dbCounter++;
  return `TestCradleDB_${Date.now()}_${dbCounter}`;
}

/**
 * Mock BroadcastChannel implementation for testing cross-tab synchronization.
 */
class MockBroadcastChannel {
  static channels = new Map();

  constructor(name) {
    this.name = name;
    this.closed = false;
    this.onmessage = null;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name).add(this);
  }

  postMessage(data) {
    if (this.closed) throw new Error("Channel closed");
    const peers = MockBroadcastChannel.channels.get(this.name) || new Set();
    for (const peer of peers) {
      if (
        peer !== this &&
        !peer.closed &&
        typeof peer.onmessage === "function"
      ) {
        peer.onmessage({ data });
      }
    }
  }

  close() {
    this.closed = true;
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (peers) {
      peers.delete(this);
    }
  }

  static reset() {
    MockBroadcastChannel.channels.clear();
  }
}

test("CradleDB exports expected constants and methods", () => {
  assert.equal(DB_NAME, "CradleDB");
  assert.equal(DB_VERSION, 1);
  assert.equal(STORE_NAME, "projectsStore");
  assert.equal(PROJECTS_KEY, "projects");
  assert.equal(SYNC_CHANNEL_NAME, "cradle-db-sync");
  assert.deepEqual(SYNC_MESSAGE_TYPES, {
    INVALIDATE: "invalidate",
    UPDATE: "update",
    DELETE: "delete",
    CLEAR: "clear",
  });
  assert.equal(typeof openDB, "function");
  assert.equal(typeof getCachedProjects, "function");
  assert.equal(typeof setCachedProjects, "function");
  assert.equal(typeof invalidateCache, "function");
  assert.equal(typeof clearStore, "function");
  assert.equal(typeof updateProjectMetadata, "function");
  assert.equal(typeof fetchAndCacheProjects, "function");
  assert.equal(typeof loadProjects, "function");
  assert.equal(typeof generateTabId, "function");
  assert.equal(typeof getBroadcastChannelFactory, "function");
  assert.equal(typeof CradleSyncChannel, "function");
  assert.equal(typeof broadcastSync, "function");
  assert.equal(typeof subscribeToSync, "function");
  assert.equal(typeof CradleDB.loadProjects, "function");
  assert.equal(typeof CradleDB.broadcastSync, "function");
});

test("Scenario 1 — First load: fetches from network, populates IndexedDB store", async () => {
  const dbName = getUniqueDbName();
  const mockProjects = [
    { id: "snake-game", title: "Snake Game", category: "games" },
    { id: "chess", title: "Chess", category: "games" },
  ];
  const fetchMock = createMockFetch(mockProjects);

  const result = await loadProjects({
    dbName,
    version: 1,
    indexedDBInstance: indexedDB,
    fetchFn: fetchMock,
    url: "./data/projects.json",
  });

  // 1. Fetched from network
  assert.equal(
    fetchMock.getCallCount(),
    1,
    "fetch should be called exactly once on first load"
  );
  assert.equal(
    result.fromCache,
    false,
    "fromCache should be false on first load"
  );
  assert.deepEqual(
    result.projects,
    mockProjects,
    "returned projects should match fetched data"
  );

  // 2. Verified that store in IndexedDB was populated
  assert.ok(result.db, "db instance should be returned");
  const cached = await getCachedProjects(result.db);
  assert.deepEqual(
    cached,
    mockProjects,
    "IndexedDB store should contain populated projects"
  );

  result.db.close();
});

test("Scenario 2 — Second load: reads from cache without making a network request", async () => {
  const dbName = getUniqueDbName();
  const initialProjects = [
    { id: "2048", title: "2048", category: "games" },
    { id: "weather", title: "Weather", category: "productivity" },
  ];

  // Pre-populate store
  const db = await openDB({ dbName, version: 1, indexedDBInstance: indexedDB });
  await fetchAndCacheProjects(db, {
    fetchFn: createMockFetch(initialProjects),
  });

  // Second load with a fetch function that must NOT be called
  const forbiddenFetch = () => {
    throw new Error("Network fetch should not be called when cache is valid!");
  };

  const result = await loadProjects({
    dbName,
    version: 1,
    indexedDBInstance: indexedDB,
    fetchFn: forbiddenFetch,
  });

  assert.equal(result.fromCache, true, "fromCache should be true on cache hit");
  assert.deepEqual(
    result.projects,
    initialProjects,
    "projects should be read from cache"
  );

  db.close();
  result.db.close();
});

test("Scenario 3 — Cache miss (empty store): falls back to fetch correctly", async () => {
  const dbName = getUniqueDbName();
  const db = await openDB({ dbName, version: 1, indexedDBInstance: indexedDB });

  // Verify store is empty (cache miss)
  const emptyCached = await getCachedProjects(db);
  assert.equal(
    emptyCached,
    null,
    "empty store must return null on getCachedProjects"
  );

  const freshProjects = [
    { id: "dot-game", title: "Dot Game", category: "games" },
  ];
  const fetchMock = createMockFetch(freshProjects);

  const result = await loadProjects({
    dbName,
    version: 1,
    indexedDBInstance: indexedDB,
    fetchFn: fetchMock,
  });

  assert.equal(
    fetchMock.getCallCount(),
    1,
    "fetch must be called on cache miss"
  );
  assert.equal(
    result.fromCache,
    false,
    "fromCache should be false on cache miss"
  );
  assert.deepEqual(result.projects, freshProjects);

  // Store must now be populated
  const nowCached = await getCachedProjects(result.db);
  assert.deepEqual(
    nowCached,
    freshProjects,
    "store must be populated after cache miss fetch"
  );

  db.close();
  result.db.close();
});

test("Scenario 4 — Corrupted store (invalid JSON): falls back gracefully without throwing", async () => {
  const dbName = getUniqueDbName();
  const db = await openDB({ dbName, version: 1, indexedDBInstance: indexedDB });

  // 4a. Corrupted string that is NOT valid JSON
  const corruptTx1 = db.transaction([STORE_NAME], "readwrite");
  corruptTx1.objectStore(STORE_NAME).put({
    id: PROJECTS_KEY,
    data: "{ invalid JSON: [[ broken string",
  });
  await new Promise(r => (corruptTx1.oncomplete = r));

  // getCachedProjects must catch SyntaxError and return null without throwing
  const corruptResult1 = await getCachedProjects(db);
  assert.equal(
    corruptResult1,
    null,
    "corrupted JSON string must return null without throwing"
  );

  // 4b. Corrupted non-array data (e.g. object, number, boolean)
  const corruptTx2 = db.transaction([STORE_NAME], "readwrite");
  corruptTx2.objectStore(STORE_NAME).put({
    id: PROJECTS_KEY,
    data: { not: "an array" },
  });
  await new Promise(r => (corruptTx2.oncomplete = r));

  const corruptResult2 = await getCachedProjects(db);
  assert.equal(
    corruptResult2,
    null,
    "non-array data must return null without throwing"
  );

  // 4c. Missing data property
  const corruptTx3 = db.transaction([STORE_NAME], "readwrite");
  corruptTx3.objectStore(STORE_NAME).put({
    id: PROJECTS_KEY,
  });
  await new Promise(r => (corruptTx3.oncomplete = r));

  const corruptResult3 = await getCachedProjects(db);
  assert.equal(
    corruptResult3,
    null,
    "missing data property must return null without throwing"
  );

  // 4d. loadProjects gracefully recovers from corrupted store by fetching fresh data
  const fallbackProjects = [{ id: "recovered", title: "Recovered Project" }];
  const fetchMock = createMockFetch(fallbackProjects);

  const loadResult = await loadProjects({
    dbName,
    version: 1,
    indexedDBInstance: indexedDB,
    fetchFn: fetchMock,
  });

  assert.equal(
    loadResult.fromCache,
    false,
    "fromCache must be false when store is corrupted"
  );
  assert.deepEqual(
    loadResult.projects,
    fallbackProjects,
    "should return fresh projects from network"
  );
  assert.equal(
    fetchMock.getCallCount(),
    1,
    "network fetch should be used as fallback"
  );

  db.close();
  loadResult.db.close();
});

test("Scenario 5 — Private browsing / IndexedDB blocked: catches SecurityError and falls back to direct fetch", async () => {
  // Construct a simulated blocked IndexedDB factory mimicking private browsing / iframe restriction
  const blockedIndexedDB = {
    open() {
      const err = new Error("The operation is insecure.");
      err.name = "SecurityError";
      err.code = 18;
      throw err;
    },
  };

  // openDB must reject with SecurityError
  await assert.rejects(
    async () => {
      await openDB({ indexedDBInstance: blockedIndexedDB });
    },
    err => {
      assert.equal(err.name, "SecurityError");
      return true;
    }
  );

  // loadProjects must catch the SecurityError, not throw, and fall back to direct network fetch
  const directProjects = [
    { id: "private-project", title: "Private Browsing Project" },
  ];
  const fetchMock = createMockFetch(directProjects);

  const result = await loadProjects({
    indexedDBInstance: blockedIndexedDB,
    fetchFn: fetchMock,
  });

  assert.equal(
    result.fromCache,
    false,
    "fromCache must be false when IndexedDB is blocked"
  );
  assert.deepEqual(
    result.projects,
    directProjects,
    "projects must be fetched via direct fallback"
  );
  assert.equal(result.db, null, "db must be null when IndexedDB is blocked");
  assert.equal(fetchMock.getCallCount(), 1, "fetch must be called directly");
});

test("Scenario 6 — Store version upgrade: old cache is cleared and repopulated", async () => {
  const dbName = getUniqueDbName();

  // Step 1: Open version 1 and populate with legacy projects
  const v1Db = await openDB({
    dbName,
    version: 1,
    indexedDBInstance: indexedDB,
  });
  const legacyProjects = [{ id: "legacy-v1", title: "Legacy V1 Project" }];
  await fetchAndCacheProjects(v1Db, {
    fetchFn: createMockFetch(legacyProjects),
  });

  const v1Cached = await getCachedProjects(v1Db);
  assert.deepEqual(
    v1Cached,
    legacyProjects,
    "v1 database must have legacy projects cached"
  );
  v1Db.close();

  // Step 2: Open version 2 (triggers onupgradeneeded which clears old cache)
  const v2Db = await openDB({
    dbName,
    version: 2,
    indexedDBInstance: indexedDB,
  });
  const clearedCache = await getCachedProjects(v2Db);
  assert.equal(
    clearedCache,
    null,
    "version upgrade must have purged the stale cache"
  );

  // Step 3: Repopulate with updated v2 projects
  const modernProjects = [
    { id: "modern-v2", title: "Modern V2 Project", category: "games" },
  ];
  await fetchAndCacheProjects(v2Db, {
    fetchFn: createMockFetch(modernProjects),
  });

  const repopulated = await getCachedProjects(v2Db);
  assert.deepEqual(
    repopulated,
    modernProjects,
    "store must be repopulated with fresh projects"
  );

  v2Db.close();
});

test("fetchAndCacheProjects throws on non-ok HTTP responses", async () => {
  const dbName = getUniqueDbName();
  const db = await openDB({ dbName, version: 1, indexedDBInstance: indexedDB });

  const failingFetch = createMockFetch(null, { ok: false, status: 500 });

  await assert.rejects(async () => {
    await fetchAndCacheProjects(db, { fetchFn: failingFetch });
  }, /Failed to load projects: 500/);

  db.close();
});

test("fetchAndCacheProjects throws on non-array JSON response", async () => {
  const dbName = getUniqueDbName();
  const db = await openDB({ dbName, version: 1, indexedDBInstance: indexedDB });

  const invalidJsonFetch = createMockFetch({ error: "not an array" });

  await assert.rejects(async () => {
    await fetchAndCacheProjects(db, { fetchFn: invalidJsonFetch });
  }, /Invalid projects payload: expected JSON array/);

  db.close();
});

test("Scenario 7 — generateTabId generates non-empty distinct identifiers", () => {
  const id1 = generateTabId();
  const id2 = generateTabId();
  assert.ok(typeof id1 === "string" && id1.length > 5);
  assert.ok(typeof id2 === "string" && id2.length > 5);
  assert.notEqual(id1, id2);
});

test("Scenario 8 — CradleSyncChannel cross-tab communication & self-echo suppression", () => {
  MockBroadcastChannel.reset();
  const channelName = "test-sync-channel";

  const tabA = new CradleSyncChannel({
    channelName,
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "tab_A",
  });
  const tabB = new CradleSyncChannel({
    channelName,
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "tab_B",
  });

  const tabAMessages = [];
  const tabBMessages = [];

  tabA.subscribe(msg => tabAMessages.push(msg));
  tabB.subscribe(msg => tabBMessages.push(msg));

  // Tab A broadcasts an invalidate notice
  const broadcastSuccess = tabA.broadcast({
    type: SYNC_MESSAGE_TYPES.INVALIDATE,
    key: "custom-key",
  });

  assert.equal(broadcastSuccess, true);
  // Tab B receives message from Tab A
  assert.equal(tabBMessages.length, 1);
  assert.equal(tabBMessages[0].type, "invalidate");
  assert.equal(tabBMessages[0].key, "custom-key");
  assert.equal(tabBMessages[0].senderId, "tab_A");
  assert.ok(typeof tabBMessages[0].timestamp === "number");

  // Tab A must NOT receive its own broadcast (self-echo suppression)
  assert.equal(tabAMessages.length, 0);

  // Tab B broadcasts an update notice
  tabB.broadcast({
    type: SYNC_MESSAGE_TYPES.UPDATE,
    data: [{ id: "new-p" }],
  });

  assert.equal(tabAMessages.length, 1);
  assert.equal(tabAMessages[0].type, "update");
  assert.equal(tabAMessages[0].senderId, "tab_B");
  assert.deepEqual(tabAMessages[0].data, [{ id: "new-p" }]);
  assert.equal(tabBMessages.length, 1); // Tab B did not receive its own message

  tabA.close();
  tabB.close();
});

test("Scenario 9 — CradleSyncChannel unsubscribe and multiple subscribers", () => {
  MockBroadcastChannel.reset();
  const channelName = "test-sync-subscribers";

  const tabA = new CradleSyncChannel({
    channelName,
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "tab_A",
  });
  const tabB = new CradleSyncChannel({
    channelName,
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "tab_B",
  });

  let sub1Calls = 0;
  let sub2Calls = 0;

  const unsub1 = tabB.subscribe(() => sub1Calls++);
  const unsub2 = tabB.subscribe(() => sub2Calls++);

  tabA.broadcast({ type: "invalidate" });
  assert.equal(sub1Calls, 1);
  assert.equal(sub2Calls, 1);

  // Unsubscribe first listener
  unsub1();
  tabA.broadcast({ type: "invalidate" });
  assert.equal(sub1Calls, 1, "sub1 should not be called after unsubscribing");
  assert.equal(sub2Calls, 2, "sub2 should still be called");

  unsub2();
  tabA.close();
  tabB.close();
});

test("Scenario 10 — Graceful degradation when BroadcastChannel is unsupported or throws", () => {
  const throwingFactory = () => {
    throw new Error("BroadcastChannel disabled by policy.");
  };

  const channelThrowing = new CradleSyncChannel({
    broadcastChannelClass: throwingFactory,
  });
  assert.equal(channelThrowing.channel, null);
  assert.equal(channelThrowing.broadcast({ type: "invalidate" }), false);

  const unsub = channelThrowing.subscribe(() => {});
  assert.equal(typeof unsub, "function");
  unsub();
  channelThrowing.close(); // No throwing

  const channelNull = new CradleSyncChannel({
    broadcastChannelClass: () => null,
  });
  assert.equal(channelNull.channel, null);
  assert.equal(channelNull.broadcast({ type: "invalidate" }), false);
  channelNull.close();
});

test("Scenario 11 — setCachedProjects stores data in IndexedDB and broadcasts update", async () => {
  MockBroadcastChannel.reset();
  const dbName = getUniqueDbName();
  const db = await openDB({ dbName, version: 1, indexedDBInstance: indexedDB });

  const syncChannelSender = new CradleSyncChannel({
    channelName: "db-sync-set",
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "writer_tab",
  });
  const syncChannelReceiver = new CradleSyncChannel({
    channelName: "db-sync-set",
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "reader_tab",
  });

  const receivedEvents = [];
  syncChannelReceiver.subscribe(evt => receivedEvents.push(evt));

  const sampleProjects = [{ id: "proj-1", title: "Project One" }];

  const success = await setCachedProjects(db, sampleProjects, {
    syncChannel: syncChannelSender,
    broadcast: true,
  });
  assert.equal(success, true);

  const cached = await getCachedProjects(db);
  assert.deepEqual(cached, sampleProjects);

  assert.equal(receivedEvents.length, 1);
  assert.equal(receivedEvents[0].type, "update");
  assert.deepEqual(receivedEvents[0].data, sampleProjects);

  await assert.rejects(async () => {
    await setCachedProjects(db, "not-an-array");
  }, /Projects data must be an array/);

  db.close();
  syncChannelSender.close();
  syncChannelReceiver.close();
});

test("Scenario 12 — invalidateCache deletes entry in IndexedDB and broadcasts invalidate notice", async () => {
  MockBroadcastChannel.reset();
  const dbName = getUniqueDbName();
  const db = await openDB({ dbName, version: 1, indexedDBInstance: indexedDB });

  const initialProjects = [{ id: "p1", title: "P1" }];
  await setCachedProjects(db, initialProjects, { broadcast: false });

  const syncChannel = new CradleSyncChannel({
    channelName: "db-sync-invalidate",
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "tab_1",
  });
  const receiverChannel = new CradleSyncChannel({
    channelName: "db-sync-invalidate",
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "tab_2",
  });

  const receivedEvents = [];
  receiverChannel.subscribe(evt => receivedEvents.push(evt));

  const result = await invalidateCache(db, {
    syncChannel,
    broadcast: true,
  });
  assert.equal(result, true);

  const cached = await getCachedProjects(db);
  assert.equal(cached, null);

  assert.equal(receivedEvents.length, 1);
  assert.equal(receivedEvents[0].type, "invalidate");

  await invalidateCache(null, { syncChannel, broadcast: true });
  assert.equal(receivedEvents.length, 2);

  db.close();
  syncChannel.close();
  receiverChannel.close();
});

test("Scenario 13 — updateProjectMetadata updates specific project attributes and broadcasts update", async () => {
  MockBroadcastChannel.reset();
  const dbName = getUniqueDbName();
  const db = await openDB({ dbName, version: 1, indexedDBInstance: indexedDB });

  const initialProjects = [
    { id: "calc", title: "Calculator", stars: 2 },
    { id: "clock", title: "Clock", stars: 0 },
  ];
  await setCachedProjects(db, initialProjects, { broadcast: false });

  const syncChannel = new CradleSyncChannel({
    channelName: "db-sync-metadata",
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "updater_tab",
  });
  const receiverChannel = new CradleSyncChannel({
    channelName: "db-sync-metadata",
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "listener_tab",
  });

  const receivedEvents = [];
  receiverChannel.subscribe(evt => receivedEvents.push(evt));

  const updatedList = await updateProjectMetadata(
    db,
    "calc",
    { stars: 5, userNotes: "Updated" },
    { syncChannel, broadcast: true }
  );

  assert.equal(updatedList.length, 2);
  assert.deepEqual(updatedList[0], {
    id: "calc",
    title: "Calculator",
    stars: 5,
    userNotes: "Updated",
  });

  const cached = await getCachedProjects(db);
  assert.deepEqual(cached, updatedList);

  assert.equal(receivedEvents.length, 1);
  assert.equal(receivedEvents[0].type, "update");
  assert.equal(receivedEvents[0].metadata.projectId, "calc");
  assert.equal(receivedEvents[0].metadata.changes.stars, 5);

  const listWithNew = await updateProjectMetadata(
    db,
    "synth",
    { title: "Synthesizer" },
    { syncChannel, broadcast: true }
  );
  assert.equal(listWithNew.length, 3);
  assert.equal(listWithNew[2].id, "synth");

  await assert.rejects(async () => {
    await updateProjectMetadata(db, "");
  }, /projectId is required/);

  db.close();
  syncChannel.close();
  receiverChannel.close();
});

test("Scenario 14 — clearStore clears store and broadcasts clear notice", async () => {
  MockBroadcastChannel.reset();
  const dbName = getUniqueDbName();
  const db = await openDB({ dbName, version: 1, indexedDBInstance: indexedDB });

  await setCachedProjects(db, [{ id: "demo" }], { broadcast: false });

  const syncChannel = new CradleSyncChannel({
    channelName: "db-sync-clear",
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "tab_clear",
  });
  const receiverChannel = new CradleSyncChannel({
    channelName: "db-sync-clear",
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "tab_listener",
  });

  const receivedEvents = [];
  receiverChannel.subscribe(evt => receivedEvents.push(evt));

  const result = await clearStore(db, { syncChannel, broadcast: true });
  assert.equal(result, true);

  const cached = await getCachedProjects(db);
  assert.equal(cached, null);

  assert.equal(receivedEvents.length, 1);
  assert.equal(receivedEvents[0].type, "clear");

  db.close();
  syncChannel.close();
  receiverChannel.close();
});

test("Scenario 15 — fetchAndCacheProjects with broadcast=true sends update message", async () => {
  MockBroadcastChannel.reset();
  const dbName = getUniqueDbName();
  const db = await openDB({ dbName, version: 1, indexedDBInstance: indexedDB });

  const syncChannel = new CradleSyncChannel({
    channelName: "db-sync-fetch",
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "fetch_tab",
  });
  const receiverChannel = new CradleSyncChannel({
    channelName: "db-sync-fetch",
    broadcastChannelClass: MockBroadcastChannel,
    tabId: "listen_tab",
  });

  const receivedEvents = [];
  receiverChannel.subscribe(evt => receivedEvents.push(evt));

  const fetchedProjects = [{ id: "fetch-p", title: "Fetched" }];
  const fetchMock = createMockFetch(fetchedProjects);

  await fetchAndCacheProjects(db, {
    fetchFn: fetchMock,
    broadcast: true,
    syncChannel,
  });

  assert.equal(receivedEvents.length, 1);
  assert.equal(receivedEvents[0].type, "update");
  assert.deepEqual(receivedEvents[0].data, fetchedProjects);

  db.close();
  syncChannel.close();
  receiverChannel.close();
});

import { test, describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DiagramToolkit } from "../src/components/ui/diagram-toolkit.js";

// Mock environment for event listener lifecycle tracking
function createMockEnvironment() {
  const windowListeners = [];
  const documentListeners = [];
  const elementListeners = [];

  const mockWindow = {
    addEventListener(type, handler, options) {
      windowListeners.push({ type, handler, options });
    },
    removeEventListener(type, handler, options) {
      const idx = windowListeners.findIndex(
        l => l.type === type && l.handler === handler
      );
      if (idx !== -1) windowListeners.splice(idx, 1);
    },
    dispatchEvent(event) {
      const type = typeof event === "string" ? event : event.type;
      windowListeners
        .filter(l => l.type === type)
        .forEach(l => l.handler(event));
    },
  };

  const mockDocument = {
    addEventListener(type, handler, options) {
      documentListeners.push({ type, handler, options });
    },
    removeEventListener(type, handler, options) {
      const idx = documentListeners.findIndex(
        l => l.type === type && l.handler === handler
      );
      if (idx !== -1) documentListeners.splice(idx, 1);
    },
    dispatchEvent(event) {
      const type = typeof event === "string" ? event : event.type;
      documentListeners
        .filter(l => l.type === type)
        .forEach(l => l.handler(event));
    },
  };

  const mockElement = {
    addEventListener(type, handler, options) {
      elementListeners.push({ type, handler, options });
    },
    removeEventListener(type, handler, options) {
      const idx = elementListeners.findIndex(
        l => l.type === type && l.handler === handler
      );
      if (idx !== -1) elementListeners.splice(idx, 1);
    },
    dispatchEvent(event) {
      const type = typeof event === "string" ? event : event.type;
      elementListeners
        .filter(l => l.type === type)
        .forEach(l => l.handler(event));
    },
  };

  return {
    mockWindow,
    mockDocument,
    mockElement,
    getWindowListenerCount: (type = null) =>
      type ? windowListeners.filter(l => l.type === type).length : windowListeners.length,
    getDocumentListenerCount: (type = null) =>
      type ? documentListeners.filter(l => l.type === type).length : documentListeners.length,
    getElementListenerCount: (type = null) =>
      type ? elementListeners.filter(l => l.type === type).length : elementListeners.length,
    windowListeners,
    documentListeners,
    elementListeners,
  };
}

describe("DiagramToolkit: Static Syntax Generators", () => {
  it("generateTimeline formats milestones correctly", () => {
    const timeline = DiagramToolkit.generateTimeline("Project Alpha", [
      { period: "Q1", events: ["Kickoff", "Design"] },
      { period: "Q2", events: ["Beta", "Launch"] },
    ]);

    assert.ok(timeline.startsWith("timeline\n    title Project Alpha\n"));
    assert.ok(timeline.includes("Q1 : Kickoff : Design"));
    assert.ok(timeline.includes("Q2 : Beta : Launch"));
  });

  it("generateFlowchart generates valid flowchart steps with labels", () => {
    const steps = [
      { from: "Start", to: "Process", label: "Initial" },
      { from: "Process", to: "End" },
    ];
    const flowchart = DiagramToolkit.generateFlowchart("LR", steps);

    assert.ok(flowchart.startsWith("flowchart LR\n"));
    assert.ok(flowchart.includes('Start -->|"Initial"| Process'));
    assert.ok(flowchart.includes("Process --> End"));
  });

  it("generateArchitecture generates subgraphs and connections", () => {
    const components = [
      { group: "Frontend", nodes: [{ id: "ui", label: "Web UI" }] },
      { group: "Backend", nodes: [{ id: "api", label: "API Gateway" }] },
    ];
    const connections = [{ from: "ui", to: "api", label: "HTTPS" }];
    const arch = DiagramToolkit.generateArchitecture("System Architecture", components, connections);

    assert.ok(arch.startsWith("graph TB\n    subgraph System Architecture\n"));
    assert.ok(arch.includes('ui["Web UI"]'));
    assert.ok(arch.includes('api["API Gateway"]'));
    assert.ok(arch.includes('ui -->|"HTTPS"| api'));
  });

  it("generateMindMap formats root and branches", () => {
    const branches = [
      { branch: "Planning", subtopics: ["Scope", "Budget"] },
    ];
    const mindmap = DiagramToolkit.generateMindMap("Cradle", branches);

    assert.ok(mindmap.startsWith('mindmap\n  root(("Cradle"))\n'));
    assert.ok(mindmap.includes("Planning"));
    assert.ok(mindmap.includes('((("Scope")))'));
  });
});

describe("DiagramToolkit: Lifecycle & Event Listener Cleanup", () => {
  let env;
  let originalWindow;
  let originalDocument;

  beforeEach(() => {
    env = createMockEnvironment();
    originalWindow = globalThis.window;
    originalDocument = globalThis.document;
    globalThis.window = env.mockWindow;
    globalThis.document = env.mockDocument;
  });

  it("attaches listeners on mount and tracks them in registry", () => {
    const toolkit = new DiagramToolkit();
    toolkit.mount(env.mockElement);

    assert.equal(toolkit.isMounted, true);
    assert.ok(toolkit.getActiveListenerCount() > 0);
    assert.ok(env.getWindowListenerCount("resize") >= 1);
    assert.ok(env.getDocumentListenerCount("keydown") >= 1);
    assert.ok(env.getWindowListenerCount("pagehide") >= 1);
    assert.ok(env.getElementListenerCount("pointerdown") >= 1);
  });

  it("explicit teardown removes all global and element event listeners", () => {
    const toolkit = new DiagramToolkit();
    toolkit.mount(env.mockElement);

    assert.ok(toolkit.getActiveListenerCount() > 0);
    assert.ok(env.getWindowListenerCount() > 0);
    assert.ok(env.getDocumentListenerCount() > 0);

    toolkit.teardown();

    assert.equal(toolkit.isMounted, false);
    assert.equal(toolkit.getActiveListenerCount(), 0);
    assert.equal(env.getWindowListenerCount(), 0);
    assert.equal(env.getDocumentListenerCount(), 0);
    assert.equal(env.getElementListenerCount(), 0);
  });

  it("cleanup and destroy aliases perform full teardown", () => {
    const toolkit1 = new DiagramToolkit();
    toolkit1.mount(env.mockElement);
    toolkit1.cleanup();
    assert.equal(toolkit1.getActiveListenerCount(), 0);
    assert.equal(env.getWindowListenerCount(), 0);

    const toolkit2 = new DiagramToolkit();
    toolkit2.mount(env.mockElement);
    toolkit2.destroy();
    assert.equal(toolkit2.getActiveListenerCount(), 0);
    assert.equal(env.getWindowListenerCount(), 0);
  });

  it("re-mounting an active instance cleans up existing listeners first (prevents duplicates)", () => {
    const toolkit = new DiagramToolkit();
    toolkit.mount(env.mockElement);

    const initialWindowCount = env.getWindowListenerCount();
    const initialDocCount = env.getDocumentListenerCount();
    assert.ok(initialWindowCount > 0);

    // Mount second time without manual teardown
    toolkit.mount(env.mockElement);

    // Listener counts must NOT double
    assert.equal(env.getWindowListenerCount(), initialWindowCount);
    assert.equal(env.getDocumentListenerCount(), initialDocCount);
    assert.equal(toolkit.getActiveListenerCount(), initialWindowCount + initialDocCount + env.getElementListenerCount());

    toolkit.teardown();
    assert.equal(env.getWindowListenerCount(), 0);
    assert.equal(env.getDocumentListenerCount(), 0);
  });

  it("navigation events automatically trigger teardown and clean up all listeners", () => {
    const toolkit = new DiagramToolkit({ autoTeardownOnNavigation: true });
    toolkit.mount(env.mockElement);

    assert.equal(toolkit.isMounted, true);
    assert.ok(toolkit.getActiveListenerCount() > 0);

    // Simulate page navigation event
    env.mockWindow.dispatchEvent({ type: "pagehide" });

    // Everything should have torn down cleanly
    assert.equal(toolkit.isMounted, false);
    assert.equal(toolkit.getActiveListenerCount(), 0);
    assert.equal(env.getWindowListenerCount(), 0);
    assert.equal(env.getDocumentListenerCount(), 0);
  });

  it("transient drag/pan gesture listeners are cleanly removed on pointerup and on teardown", () => {
    const toolkit = new DiagramToolkit({ enablePanZoom: true });
    toolkit.mount(env.mockElement);

    const baseWindowListeners = env.getWindowListenerCount();

    // Start drag gesture
    env.mockElement.dispatchEvent({ type: "pointerdown", clientX: 100, clientY: 100 });
    assert.ok(env.getWindowListenerCount("pointermove") >= 1);
    assert.ok(env.getWindowListenerCount("pointerup") >= 1);

    // End drag gesture
    env.mockWindow.dispatchEvent({ type: "pointerup", clientX: 150, clientY: 150 });
    assert.equal(env.getWindowListenerCount("pointermove"), 0);
    assert.equal(env.getWindowListenerCount("pointerup"), 0);
    assert.equal(env.getWindowListenerCount(), baseWindowListeners);

    // Teardown during an active drag cleans up gesture listeners immediately
    env.mockElement.dispatchEvent({ type: "pointerdown", clientX: 100, clientY: 100 });
    assert.ok(env.getWindowListenerCount("pointermove") >= 1);

    toolkit.teardown();
    assert.equal(env.getWindowListenerCount(), 0);
    assert.equal(env.getDocumentListenerCount(), 0);
  });

  it("static DiagramToolkit.mount and teardown manage global listeners without leaks", () => {
    DiagramToolkit.mount(env.mockElement);
    assert.equal(DiagramToolkit.isMounted(), true);
    assert.ok(DiagramToolkit.getActiveListenerCount() > 0);
    assert.ok(env.getWindowListenerCount() > 0);

    DiagramToolkit.teardown();
    assert.equal(DiagramToolkit.isMounted(), false);
    assert.equal(DiagramToolkit.getActiveListenerCount(), 0);
    assert.equal(env.getWindowListenerCount(), 0);
    assert.equal(env.getDocumentListenerCount(), 0);
  });

  it("teardown is idempotent and safe to call multiple times", () => {
    const toolkit = new DiagramToolkit();
    toolkit.mount(env.mockElement);

    assert.doesNotThrow(() => {
      toolkit.teardown();
      toolkit.teardown();
      toolkit.teardown();
    });

    assert.equal(toolkit.getActiveListenerCount(), 0);
  });
});


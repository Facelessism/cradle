/**
 * Diagram & Visual Planning Toolkit (Issue #523)
 * Generates Mermaid.js syntax for timelines, pipelines, flowcharts, wireframes,
 * roadmaps, process flows, architecture diagrams, mind maps, and decision trees.
 * Includes explicit lifecycle cleanup and leak-free event handling during navigation.
 */

export class DiagramToolkit {
  /**
   * Internal listener registry for lifecycle cleanup.
   * Stores records of { target, type, handler, options }
   */
  constructor(options = {}) {
    this.options = {
      enableKeyboardShortcuts: true,
      enablePanZoom: true,
      enableResizeObserver: true,
      autoTeardownOnNavigation: true,
      ...options,
    };

    this.container = null;
    this.isMounted = false;
    this._listeners = [];
    this._resizeObserver = null;
    this._activeTimers = new Set();
    this._panState = {
      isPanning: false,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
      zoom: 1,
    };

    // Bound handlers for consistent identity during registration and removal
    this._onResize = this._handleResize.bind(this);
    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onNavigation = this._handleNavigation.bind(this);
  }

  /**
   * Generates a timeline diagram.
   * @param {string} title
   * @param {Array<{period: string, events: string[]}>} milestones
   */
  static generateTimeline(title, milestones) {
    let output = `timeline\n    title ${title}\n`;
    milestones.forEach(m => {
      output += `    ${m.period} : ${m.events.join(" : ")}\n`;
    });
    return output;
  }

  /**
   * Generates a flowchart or process pipeline.
   * @param {string} direction - e.g., 'TD', 'LR'
   * @param {Array<{from: string, to: string, label?: string}>} steps
   */
  static generateFlowchart(direction = "TD", steps = []) {
    let output = `flowchart ${direction}\n`;
    steps.forEach(step => {
      if (step.label) {
        output += `    ${step.from} -->|"${step.label}"| ${step.to}\n`;
      } else {
        output += `    ${step.from} --> ${step.to}\n`;
      }
    });
    return output;
  }

  /**
   * Generates a system architecture or container diagram.
   * @param {string} title
   * @param {Array<{group: string, nodes: Array<{id: string, label: string}>}>} components
   * @param {Array<{from: string, to: string, label?: string}>} connections
   */
  static generateArchitecture(title, components = [], connections = []) {
    let output = `graph TB\n    subgraph ${title}\n`;

    components.forEach(comp => {
      output += `        subgraph ${comp.group}\n`;
      comp.nodes.forEach(node => {
        output += `            ${node.id}["${node.label}"]\n`;
      });
      output += `        end\n`;
    });

    output += `    end\n`;
    connections.forEach(conn => {
      if (conn.label) {
        output += `    ${conn.from} -->|"${conn.label}"| ${conn.to}\n`;
      } else {
        output += `    ${conn.from} --> ${conn.to}\n`;
      }
    });

    return output;
  }

  /**
   * Generates a mind map structure.
   * @param {string} centralIdea
   * @param {Array<{branch: string, subtopics: string[]}>} branches
   */
  static generateMindMap(centralIdea, branches = []) {
    let output = `mindmap\n  root(("${centralIdea}"))\n`;
    branches.forEach(b => {
      output += `    ${b.branch}\n`;
      b.subtopics.forEach(sub => {
        output += `      ((("${sub}")))\n`;
      });
    });
    return output;
  }

  // ─── Lifecycle & Event Management ──────────────────────────────────────

  /**
   * Safely attach an event listener and record it for guaranteed teardown.
   * @param {EventTarget} target - e.g. window, document, or element
   * @param {string} type - Event type (e.g. 'resize', 'keydown')
   * @param {Function} handler - Callback function
   * @param {Object|boolean} [options=false] - addEventListener options
   */
  addListener(target, type, handler, options = false) {
    if (!target || typeof target.addEventListener !== "function") return;

    target.addEventListener(type, handler, options);
    this._listeners.push({ target, type, handler, options });
  }

  /**
   * Remove a specific listener and unregister it from tracking.
   * @param {EventTarget} target
   * @param {string} type
   * @param {Function} handler
   * @param {Object|boolean} [options=false]
   */
  removeListener(target, type, handler, options = false) {
    if (!target || typeof target.removeEventListener !== "function") return;

    target.removeEventListener(type, handler, options);
    this._listeners = this._listeners.filter(
      l => !(l.target === target && l.type === type && l.handler === handler)
    );
  }

  /**
   * Mounts the diagram toolkit and registers required listeners.
   * If already mounted, safely tears down previous listeners first to prevent duplicates.
   * @param {HTMLElement|null} [container=null]
   * @param {Object} [options={}]
   */
  mount(container = null, options = {}) {
    if (this.isMounted) {
      this.teardown();
    }

    if (options) {
      this.options = { ...this.options, ...options };
    }

    this.container = container;
    this.isMounted = true;

    const win = typeof window !== "undefined" ? window : null;
    const doc = typeof document !== "undefined" ? document : null;

    // 1. Window Resize Listener
    if (win) {
      this.addListener(win, "resize", this._onResize);
      this.addListener(win, "orientationchange", this._onResize);
    }

    // 2. Keyboard Navigation Shortcuts
    if (doc && this.options.enableKeyboardShortcuts) {
      this.addListener(doc, "keydown", this._onKeyDown);
    }

    // 3. Container Pan/Zoom Interaction
    if (this.container && this.options.enablePanZoom) {
      this.addListener(this.container, "pointerdown", this._onPointerDown);
      this.addListener(this.container, "mousedown", this._onPointerDown);
    }

    // 4. Automatic Teardown on Page Navigation / Unload
    if (win && this.options.autoTeardownOnNavigation) {
      this.addListener(win, "pagehide", this._onNavigation);
      this.addListener(win, "beforeunload", this._onNavigation);
      this.addListener(win, "popstate", this._onNavigation);
    }

    // 5. Container ResizeObserver if supported
    if (
      this.container &&
      this.options.enableResizeObserver &&
      typeof ResizeObserver !== "undefined"
    ) {
      try {
        this._resizeObserver = new ResizeObserver(() => this._handleResize());
        this._resizeObserver.observe(this.container);
      } catch {
        this._resizeObserver = null;
      }
    }

    return this;
  }

  /**
   * Explicit lifecycle teardown. Removes all registered event listeners,
   * disconnects observers, and clears references. Idempotent.
   */
  teardown() {
    // Remove all registered event listeners
    while (this._listeners.length > 0) {
      const { target, type, handler, options } = this._listeners.pop();
      try {
        if (target && typeof target.removeEventListener === "function") {
          target.removeEventListener(type, handler, options);
        }
      } catch {
        // Suppress errors during teardown
      }
    }

    // Disconnect ResizeObserver
    if (this._resizeObserver) {
      try {
        this._resizeObserver.disconnect();
      } catch {}
      this._resizeObserver = null;
    }

    // Clear active timers
    for (const timer of this._activeTimers) {
      clearTimeout(timer);
    }
    this._activeTimers.clear();

    // Reset interaction state
    this._panState.isPanning = false;
    this.isMounted = false;
    this.container = null;
  }

  /** Alias for teardown */
  cleanup() {
    this.teardown();
  }

  /** Alias for teardown */
  destroy() {
    this.teardown();
  }

  /** Number of currently active registered listeners */
  getActiveListenerCount(target = null, type = null) {
    if (!target && !type) {
      return this._listeners.length;
    }
    return this._listeners.filter(l => {
      const matchTarget = target ? l.target === target : true;
      const matchType = type ? l.type === type : true;
      return matchTarget && matchType;
    }).length;
  }

  // ─── Internal Event Handlers ───────────────────────────────────────────

  _handleResize() {
    if (!this.isMounted) return;
    if (typeof this.options.onResize === "function") {
      this.options.onResize();
    }
  }

  _handleKeyDown(event) {
    if (!this.isMounted) return;
    const key = event.key;

    if (key === "+" || key === "=") {
      this.zoomIn();
    } else if (key === "-" || key === "_") {
      this.zoomOut();
    } else if (key === "0") {
      this.resetView();
    } else if (key === "Escape") {
      this.cancelGesture();
    }
  }

  _handlePointerDown(event) {
    if (!this.isMounted || !this.options.enablePanZoom) return;
    this._panState.isPanning = true;
    this._panState.startX = event.clientX;
    this._panState.startY = event.clientY;

    const win = typeof window !== "undefined" ? window : null;
    const doc = typeof document !== "undefined" ? document : null;
    const globalTarget = win || doc;

    if (globalTarget) {
      this.addListener(globalTarget, "pointermove", this._onPointerMove);
      this.addListener(globalTarget, "mousemove", this._onPointerMove);
      this.addListener(globalTarget, "pointerup", this._onPointerUp);
      this.addListener(globalTarget, "mouseup", this._onPointerUp);
      this.addListener(globalTarget, "pointercancel", this._onPointerUp);
    }
  }

  _handlePointerMove(event) {
    if (!this._panState.isPanning) return;
    const dx = event.clientX - this._panState.startX;
    const dy = event.clientY - this._panState.startY;
    this._panState.startX = event.clientX;
    this._panState.startY = event.clientY;
    this._panState.x += dx;
    this._panState.y += dy;

    if (typeof this.options.onPan === "function") {
      this.options.onPan(this._panState.x, this._panState.y);
    }
  }

  _handlePointerUp() {
    if (!this._panState.isPanning) return;
    this._panState.isPanning = false;

    const win = typeof window !== "undefined" ? window : null;
    const doc = typeof document !== "undefined" ? document : null;
    const globalTarget = win || doc;

    if (globalTarget) {
      this.removeListener(globalTarget, "pointermove", this._onPointerMove);
      this.removeListener(globalTarget, "mousemove", this._onPointerMove);
      this.removeListener(globalTarget, "pointerup", this._onPointerUp);
      this.removeListener(globalTarget, "mouseup", this._onPointerUp);
      this.removeListener(globalTarget, "pointercancel", this._onPointerUp);
    }
  }

  _handleNavigation() {
    this.teardown();
  }

  cancelGesture() {
    this._handlePointerUp();
  }

  zoomIn(delta = 0.1) {
    this._panState.zoom = Math.min(5, this._panState.zoom + delta);
    if (typeof this.options.onZoom === "function") {
      this.options.onZoom(this._panState.zoom);
    }
  }

  zoomOut(delta = 0.1) {
    this._panState.zoom = Math.max(0.2, this._panState.zoom - delta);
    if (typeof this.options.onZoom === "function") {
      this.options.onZoom(this._panState.zoom);
    }
  }

  resetView() {
    this._panState = {
      isPanning: false,
      startX: 0,
      startY: 0,
      x: 0,
      y: 0,
      zoom: 1,
    };
    if (typeof this.options.onReset === "function") {
      this.options.onReset();
    }
  }

  // ─── Static Global Convenience Interface ───────────────────────────────

  static _defaultInstance = null;

  static mount(container, options = {}) {
    if (!DiagramToolkit._defaultInstance) {
      DiagramToolkit._defaultInstance = new DiagramToolkit(options);
    }
    return DiagramToolkit._defaultInstance.mount(container, options);
  }

  static teardown() {
    if (DiagramToolkit._defaultInstance) {
      DiagramToolkit._defaultInstance.teardown();
      DiagramToolkit._defaultInstance = null;
    }
  }

  static cleanup() {
    DiagramToolkit.teardown();
  }

  static destroy() {
    DiagramToolkit.teardown();
  }

  static getActiveListenerCount(target = null, type = null) {
    if (!DiagramToolkit._defaultInstance) return 0;
    return DiagramToolkit._defaultInstance.getActiveListenerCount(target, type);
  }

  static isMounted() {
    return Boolean(DiagramToolkit._defaultInstance?.isMounted);
  }
}

if (typeof window !== "undefined") {
  window.DiagramToolkit = DiagramToolkit;
}
if (typeof globalThis !== "undefined") {
  globalThis.DiagramToolkit = DiagramToolkit;
}

export default DiagramToolkit;

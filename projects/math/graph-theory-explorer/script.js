/**
 * script.js — Graph Theory Explorer
 * DOM wiring: graph editing (click/drag), algorithm selection, directed toggle,
 * animated playback engine, frontier & state inspection table, and import/export suite.
 */

(function () {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const canvas = document.getElementById("graph-canvas");

  // ----- State -----
  let nodes = []; // { id, x, y }
  let edges = []; // { from, to, weight }
  let directed = false; // Undirected vs Directed graph
  let mode = "add-node"; // "add-node" | "add-edge"
  let algorithm = "bfs"; // "bfs" | "dfs" | "mst" | "kruskal" | "dijkstra" | "topo" | "scc"
  let edgeFirstNode = null;
  let nextNodeCharCode = 65; // 'A'

  // Animation state
  let steps = [];
  let stepIndex = -1;
  let playing = false;
  let playTimer = null;
  let finalResult = null;

  // Import / Export state
  let activeIoFormat = "matrix"; // "matrix" | "edgelist" | "json"

  // ----- DOM refs -----
  const startSelect = document.getElementById("start-node");
  const endSelect = document.getElementById("end-node");
  const startGroup = document.getElementById("start-node-group");
  const endGroup = document.getElementById("end-node-group");
  const nodeSelectionCard = document.getElementById("node-selection-card");
  const toggleDirected = document.getElementById("toggle-directed");

  const explanationText = document.getElementById("explanation-text");
  const resultPanel = document.getElementById("result-panel");
  const canvasHint = document.getElementById("canvas-hint");

  const btnPlay = document.getElementById("btn-play");
  const playIcon = document.getElementById("play-icon");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnResetPlay = document.getElementById("btn-reset-play");
  const speedSlider = document.getElementById("speed-slider");
  const speedDisplay = document.getElementById("speed-display");
  const stepCounter = document.getElementById("step-counter");
  const stepProgressFill = document.getElementById("step-progress-fill");

  // Frontier elements
  const frontierSummaryBadge = document.getElementById("frontier-summary-badge");
  const frontierOpenTokens = document.getElementById("frontier-open-tokens");
  const frontierClosedTokens = document.getElementById("frontier-closed-tokens");
  const frontierTableHead = document.getElementById("frontier-table-head");
  const frontierTableBody = document.getElementById("frontier-table-body");

  // IO Modal elements
  const ioModal = document.getElementById("io-modal");
  const ioModalTitle = document.getElementById("io-modal-title");
  const ioTextarea = document.getElementById("io-textarea");
  const ioFeedback = document.getElementById("io-feedback");
  const btnImportOpen = document.getElementById("btn-import-open");
  const btnExportOpen = document.getElementById("btn-export-open");
  const btnIoClose = document.getElementById("btn-io-close");
  const btnIoCopy = document.getElementById("btn-io-copy");
  const btnIoDownload = document.getElementById("btn-io-download");
  const btnIoApply = document.getElementById("btn-io-apply");
  const formatTabs = document.querySelectorAll(".format-tab");

  // ===================== GRAPH EDITING =====================

  function nextNodeId() {
    const id = String.fromCharCode(nextNodeCharCode);
    nextNodeCharCode++;
    return id;
  }

  function addNode(x, y) {
    const id = nextNodeId();
    nodes.push({ id, x, y });
    refreshNodeSelectors();
    resetPlayback();
    render();
  }

  function addEdge(fromId, toId) {
    if (fromId === toId) return;
    const exists = edges.some(
      e =>
        (e.from === fromId && e.to === toId) ||
        (!directed && e.from === toId && e.to === fromId)
    );
    if (exists) return;

    const weightInput = window.prompt(
      `Weight for edge ${fromId} → ${toId}:`,
      "1"
    );
    if (weightInput === null) return;
    const weight = Number(weightInput);
    edges.push({
      from: fromId,
      to: toId,
      weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
    });
    resetPlayback();
    render();
  }

  function getSvgPoint(evt) {
    const point = canvas.createSVGPoint();
    point.x = evt.clientX;
    point.y = evt.clientY;
    const ctm = canvas.getScreenCTM();
    const transformed = point.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  canvas?.addEventListener("click", evt => {
    if (
      playing ||
      evt.target?.closest(".node-circle") ||
      evt.target?.closest(".node-label")
    )
      return;
    if (mode !== "add-node") return;
    const { x, y } = getSvgPoint(evt);
    addNode(x, y);
  });

  function onNodeClick(nodeId) {
    if (mode !== "add-edge" || playing) return;
    if (!edgeFirstNode) {
      edgeFirstNode = nodeId;
      if (canvasHint)
        canvasHint.textContent = `Now click a second node to connect to ${nodeId}`;
    } else {
      addEdge(edgeFirstNode, nodeId);
      edgeFirstNode = null;
      if (canvasHint)
        canvasHint.textContent = "Click two nodes to connect them";
    }
  }

  // ----- Node dragging -----
  let draggingNode = null;

  function onNodePointerDown(nodeId, evt) {
    if (mode !== "add-node") return;
    draggingNode = nodeId;
    evt.stopPropagation();
  }

  canvas?.addEventListener("mousemove", evt => {
    if (!draggingNode) return;
    const { x, y } = getSvgPoint(evt);
    const node = nodes.find(n => n.id === draggingNode);
    if (node) {
      node.x = Math.max(30, Math.min(870, x));
      node.y = Math.max(30, Math.min(530, y));
      render();
    }
  });

  window.addEventListener("mouseup", () => {
    draggingNode = null;
  });

  // ===================== RENDERING =====================

  function ensureMarkerDefs() {
    let defs = canvas.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(SVG_NS, "defs");
      canvas.appendChild(defs);
    }
    defs.innerHTML = `
      <marker id="arrow-marker" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
      </marker>
      <marker id="arrow-marker-tree" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
      </marker>
      <marker id="arrow-marker-path" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
      </marker>
      <marker id="arrow-marker-frontier" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 1 L 10 5 L 0 9 z" fill="#f59e0b" />
      </marker>
    `;
  }

  function edgeClass(from, to) {
    if (!steps.length || stepIndex < 0) return "";
    const seen = steps.slice(0, stepIndex + 1);

    for (const step of seen) {
      if (!step.edge) continue;
      const matches = directed
        ? step.edge.from === from && step.edge.to === to
        : (step.edge.from === from && step.edge.to === to) ||
          (step.edge.from === to && step.edge.to === from);
      if (!matches) continue;
      if (step.type === "tree-edge") return "tree-edge";
      if (step.type === "frontier-edge") return "frontier-edge";
      if (step.type === "reject-edge") return "reject-edge";
    }

    if (finalResult && finalResult.path && finalResult.path.length) {
      for (let i = 0; i < finalResult.path.length - 1; i++) {
        const a = finalResult.path[i];
        const b = finalResult.path[i + 1];
        const matches = directed
          ? a === from && b === to
          : (a === from && b === to) || (a === to && b === from);
        if (matches) return "path-edge";
      }
    }
    return "";
  }

  function nodeClass(nodeId) {
    if (!steps.length || stepIndex < 0) return "";
    const seen = steps.slice(0, stepIndex + 1);
    const isVisited = seen.some(
      s =>
        (s.type === "visit" || s.type === "settle" || s.type === "scc-found") &&
        (s.node === nodeId || (s.component && s.component.includes(nodeId)))
    );
    const isCurrent =
      steps[stepIndex] &&
      (steps[stepIndex].node === nodeId ||
        (steps[stepIndex].edge && steps[stepIndex].edge.to === nodeId));
    const onPath =
      finalResult && finalResult.path && finalResult.path.includes(nodeId);

    if (stepIndex === steps.length - 1 && onPath) return "on-path";
    if (isCurrent) return "current";
    if (isVisited) return "visited";
    return "";
  }

  function render() {
    if (!canvas) return;
    while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
    ensureMarkerDefs();

    // Edges
    for (const edge of edges) {
      const from = nodes.find(n => n.id === edge.from);
      const to = nodes.find(n => n.id === edge.to);
      if (!from || !to) continue;

      let x1 = from.x;
      let y1 = from.y;
      let x2 = to.x;
      let y2 = to.y;

      if (directed) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy);
        if (len > 35) {
          const ux = dx / len;
          const uy = dy / len;
          x1 = from.x + ux * 20;
          y1 = from.y + uy * 20;
          x2 = to.x - ux * 23;
        }
      }

      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);

      const cls = edgeClass(edge.from, edge.to);
      line.setAttribute(
        "class",
        `edge-line ${cls} ${directed ? "directed" : ""}`.trim()
      );
      canvas.appendChild(line);

      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", midX);
      label.setAttribute("y", midY - 6);
      label.setAttribute("class", "edge-weight");
      label.textContent = edge.weight ?? 1;
      canvas.appendChild(label);
    }

    // Nodes
    for (const node of nodes) {
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", node.x);
      circle.setAttribute("cy", node.y);
      circle.setAttribute("r", 20);
      circle.setAttribute("class", `node-circle ${nodeClass(node.id)}`.trim());
      circle.addEventListener("click", evt => {
        evt.stopPropagation();
        onNodeClick(node.id);
      });
      circle.addEventListener("mousedown", evt =>
        onNodePointerDown(node.id, evt)
      );
      canvas.appendChild(circle);

      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", node.x);
      label.setAttribute("y", node.y);
      label.setAttribute("class", "node-label");
      label.textContent = node.id;
      canvas.appendChild(label);
    }
  }

  // ===================== ALGORITHM & CONTROLS =====================

  function updateAlgoControls() {
    if (algorithm === "dijkstra") {
      if (nodeSelectionCard) nodeSelectionCard.style.display = "block";
      if (startGroup) startGroup.style.display = "flex";
      if (endGroup) endGroup.style.display = "flex";
    } else if (algorithm === "bfs" || algorithm === "dfs" || algorithm === "mst") {
      if (nodeSelectionCard) nodeSelectionCard.style.display = "block";
      if (startGroup) startGroup.style.display = "flex";
      if (endGroup) endGroup.style.display = "none";
    } else {
      // Kruskal, Topo, SCC do not require start/end selection
      if (nodeSelectionCard) nodeSelectionCard.style.display = "none";
    }

    // Auto-toggle directed mode if Kahn's or Tarjan's is selected
    if (algorithm === "topo" || algorithm === "scc") {
      directed = true;
      if (toggleDirected) toggleDirected.checked = true;
    }
  }

  document.querySelectorAll(".op-btn[data-algo]").forEach(btn => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".op-btn[data-algo]")
        .forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      algorithm = btn.dataset.algo;
      updateAlgoControls();
      resetPlayback();
      render();
    });
  });

  document.querySelectorAll(".op-btn[data-mode]").forEach(btn => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".op-btn[data-mode]")
        .forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      mode = btn.dataset.mode;
      edgeFirstNode = null;
      if (canvasHint) {
        canvasHint.textContent =
          mode === "add-node"
            ? "Click empty space to add a node"
            : "Click two nodes to connect them";
      }
    });
  });

  toggleDirected?.addEventListener("change", e => {
    directed = e.target.checked;
    resetPlayback();
    render();
  });

  function refreshNodeSelectors() {
    if (!startSelect || !endSelect) return;
    const currentStart = startSelect.value;
    const currentEnd = endSelect.value;
    startSelect.innerHTML = "";
    endSelect.innerHTML = "";

    for (const node of nodes) {
      const opt1 = document.createElement("option");
      opt1.value = node.id;
      opt1.textContent = node.id;
      startSelect.appendChild(opt1);

      const opt2 = opt1.cloneNode(true);
      endSelect.appendChild(opt2);
    }
    if (nodes.some(n => n.id === currentStart))
      startSelect.value = currentStart;
    if (nodes.some(n => n.id === currentEnd)) endSelect.value = currentEnd;
    else if (nodes.length > 1) endSelect.value = nodes[nodes.length - 1].id;
  }

  // ===================== RANDOM / CLEAR =====================

  function flashButton(button) {
    if (!button) return;
    button.classList.add("btn-flash");
    setTimeout(() => button.classList.remove("btn-flash"), 200);
  }

  document.getElementById("btn-random")?.addEventListener("click", () => {
    flashButton(document.getElementById("btn-random"));
    nodes = [];
    edges = [];
    nextNodeCharCode = 65;
    const count = 6;
    const cx = 450;
    const cy = 280;
    const radius = 200;
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      addNode(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    }
    const ids = nodes.map(n => n.id);
    for (let i = 0; i < ids.length; i++) {
      edges.push({
        from: ids[i],
        to: ids[(i + 1) % ids.length],
        weight: 1 + Math.floor(Math.random() * 9),
      });
    }
    for (let i = 0; i < 2; i++) {
      const a = ids[Math.floor(Math.random() * ids.length)];
      const b = ids[Math.floor(Math.random() * ids.length)];
      if (a !== b) {
        edges.push({
          from: a,
          to: b,
          weight: 1 + Math.floor(Math.random() * 9),
        });
      }
    }
    refreshNodeSelectors();
    resetPlayback();
    render();
  });

  document.getElementById("btn-clear")?.addEventListener("click", () => {
    flashButton(document.getElementById("btn-clear"));
    nodes = [];
    edges = [];
    nextNodeCharCode = 65;
    edgeFirstNode = null;
    refreshNodeSelectors();
    resetPlayback();
    render();
  });

  // ===================== PLAYBACK & STEP COMPUTATION =====================

  function computeSteps() {
    const startId = startSelect ? startSelect.value : (nodes[0] && nodes[0].id);
    const endId = endSelect ? endSelect.value : null;
    finalResult = null;

    if (nodes.length === 0) return [];

    const logic =
      typeof window !== "undefined" && window.GraphLogic
        ? window.GraphLogic
        : {
            bfs,
            dfs,
            primMST,
            kruskalMST,
            dijkstra,
            kahnTopologicalSort,
            tarjanSCC,
          };

    if (algorithm === "bfs") {
      if (!startId) return [];
      return logic.bfs(nodes, edges, startId, directed);
    }
    if (algorithm === "dfs") {
      if (!startId) return [];
      return logic.dfs(nodes, edges, startId, 1000, directed);
    }
    if (algorithm === "mst") {
      if (!startId) return [];
      const res = logic.primMST(nodes, edges, startId);
      finalResult = res;
      return res.steps;
    }
    if (algorithm === "kruskal") {
      const res = logic.kruskalMST(nodes, edges);
      finalResult = res;
      return res.steps;
    }
    if (algorithm === "dijkstra") {
      if (!startId) return [];
      const res = logic.dijkstra(nodes, edges, startId, endId, directed);
      finalResult = res;
      return res.steps;
    }
    if (algorithm === "topo") {
      const res = logic.kahnTopologicalSort(nodes, edges);
      finalResult = res;
      return res.steps;
    }
    if (algorithm === "scc") {
      const res = logic.tarjanSCC(nodes, edges);
      finalResult = res;
      return res.steps;
    }
    return [];
  }

  function describeStep(step) {
    if (!step) return "Ready to start.";
    if (step.description) return step.description;
    if (step.type === "visit") return `Visiting node ${step.node}.`;
    if (step.type === "settle") return `Node ${step.node} finalized.`;
    if (step.type === "frontier-edge")
      return `Traversing edge ${step.edge.from} → ${step.edge.to}.`;
    if (step.type === "tree-edge")
      return `Adding tree edge ${step.edge.from} — ${step.edge.to} (wt ${step.edge.weight}).`;
    if (step.type === "reject-edge")
      return `Edge ${step.edge.from} — ${step.edge.to} rejected: cycle detected.`;
    if (step.type === "relax")
      return `Relaxed edge ${step.edge.from} → ${step.edge.to}.`;
    return "Executing step.";
  }

  function updateResultPanel() {
    if (!resultPanel) return;
    if (stepIndex < steps.length - 1 || !finalResult) return;

    if (algorithm === "mst") {
      resultPanel.textContent = `Prim's MST Total Weight: ${finalResult.totalWeight}\nTree Edges: ${finalResult.mstEdges
        .map(e => `${e.from}—${e.to} (wt ${e.weight})`)
        .join(", ")}`;
    } else if (algorithm === "kruskal") {
      resultPanel.textContent = `Kruskal's MST Total Weight: ${finalResult.totalWeight}\nSpanning: ${finalResult.isSpanning ? "Yes (V - 1 edges)" : "No (Disconnected Graph)"}\nTree Edges: ${finalResult.mstEdges
        .map(e => `${e.from}—${e.to} (wt ${e.weight})`)
        .join(", ")}\nRejected Cycle Edges: ${finalResult.rejectedEdgesCount}`;
    } else if (algorithm === "dijkstra") {
      const lines = Object.entries(finalResult.distances).map(
        ([id, d]) => `${id}: ${d === Infinity ? "unreachable" : d}`
      );
      const pathLine = finalResult.path.length
        ? `Shortest Path: ${finalResult.path.join(" → ")}`
        : "No path exists between start and end nodes.";
      resultPanel.textContent = `${pathLine}\n\nDistances from start:\n${lines.join("\n")}`;
    } else if (algorithm === "topo") {
      const topoLine = finalResult.isDAG
        ? `Topological Sort Order: ${finalResult.order.join(" → ")}`
        : `Cycle Detected! Graph is NOT a DAG.\nPartial Order: ${finalResult.order.join(" → ")}`;
      resultPanel.textContent = `${topoLine}\n\nFinal In-Degrees: ${JSON.stringify(finalResult.inDegrees)}`;
    } else if (algorithm === "scc") {
      const sccLines = finalResult.components
        .map((c, i) => `Component ${i + 1}: [${c.join(", ")}]`)
        .join("\n");
      resultPanel.textContent = `Tarjan's SCC Analysis: Found ${finalResult.sccCount} Strongly Connected Component(s):\n${sccLines}`;
    }
  }

  // ===================== FRONTIER & STATE TABLE =====================

  function updateFrontierUI(step) {
    if (!frontierSummaryBadge || !frontierOpenTokens || !frontierClosedTokens)
      return;

    if (!step) {
      frontierSummaryBadge.textContent = "Awaiting Execution";
      frontierOpenTokens.innerHTML = '<span class="token-empty">(empty)</span>';
      frontierClosedTokens.innerHTML = '<span class="token-empty">(empty)</span>';
      if (frontierTableBody) {
        frontierTableBody.innerHTML = `<tr><td colspan="3" class="table-empty">Play or step through an algorithm to inspect live node and frontier states.</td></tr>`;
      }
      return;
    }

    frontierSummaryBadge.textContent = `Step ${stepIndex + 1} / ${steps.length} (${step.type})`;

    // Open set tokens
    if (Array.isArray(step.openSet) && step.openSet.length > 0) {
      frontierOpenTokens.innerHTML = step.openSet
        .map(item => `<span class="set-chip chip-open">${item}</span>`)
        .join("");
    } else {
      frontierOpenTokens.innerHTML = '<span class="token-empty">(empty)</span>';
    }

    // Closed set tokens
    if (Array.isArray(step.closedSet) && step.closedSet.length > 0) {
      frontierClosedTokens.innerHTML = step.closedSet
        .map(item => `<span class="set-chip chip-closed">${item}</span>`)
        .join("");
    } else {
      frontierClosedTokens.innerHTML = '<span class="token-empty">(empty)</span>';
    }

    // Dynamic State Table
    if (!frontierTableHead || !frontierTableBody) return;

    if (algorithm === "dijkstra") {
      frontierTableHead.innerHTML = `
        <tr><th>Node</th><th>Status</th><th>Shortest Dist (dB)</th></tr>
      `;
      const dists = step.stateTable || (finalResult && finalResult.distances) || {};
      const closed = new Set(step.closedSet || []);
      const rows = nodes
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(n => {
          const isSettled = closed.has(n.id);
          const isCurr = step.node === n.id;
          const d = dists[n.id] !== undefined ? dists[n.id] : Infinity;
          const status = isSettled
            ? '<span class="table-status-badge status-settled">Settled</span>'
            : isCurr
              ? '<span class="table-status-badge status-current">Current</span>'
              : d !== Infinity
                ? '<span class="table-status-badge status-open">Frontier</span>'
                : '<span class="table-status-badge status-unvisited">Unvisited</span>';
          return `<tr class="${isCurr ? "active-row" : ""}">
            <td><strong>${n.id}</strong></td>
            <td>${status}</td>
            <td>${d === Infinity ? "∞" : d}</td>
          </tr>`;
        });
      frontierTableBody.innerHTML = rows.join("");
    } else if (algorithm === "topo") {
      frontierTableHead.innerHTML = `
        <tr><th>Node</th><th>Status</th><th>In-Degree</th></tr>
      `;
      const degs = step.stateTable || (finalResult && finalResult.inDegrees) || {};
      const closed = new Set(step.closedSet || []);
      const open = new Set(step.openSet || []);
      const rows = nodes
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(n => {
          const inOrder = closed.has(n.id);
          const inQ = open.has(n.id);
          const isCurr = step.node === n.id;
          const status = inOrder
            ? '<span class="table-status-badge status-settled">Ordered</span>'
            : inQ
              ? '<span class="table-status-badge status-open">Queue (deg 0)</span>'
              : '<span class="table-status-badge status-unvisited">Pending</span>';
          return `<tr class="${isCurr ? "active-row" : ""}">
            <td><strong>${n.id}</strong></td>
            <td>${status}</td>
            <td>${degs[n.id] ?? 0}</td>
          </tr>`;
        });
      frontierTableBody.innerHTML = rows.join("");
    } else if (algorithm === "scc") {
      frontierTableHead.innerHTML = `
        <tr><th>Node</th><th>Status</th><th>Disc / Low Values</th></tr>
      `;
      const disc = (step.stateTable && step.stateTable.disc) || {};
      const low = (step.stateTable && step.stateTable.low) || {};
      const stack = new Set(step.openSet || []);
      const finalized = new Set(step.closedSet || []);
      const rows = nodes
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(n => {
          const isFinal = finalized.has(n.id);
          const onSt = stack.has(n.id);
          const isCurr = step.node === n.id;
          const status = isFinal
            ? '<span class="table-status-badge status-settled">In SCC</span>'
            : onSt
              ? '<span class="table-status-badge status-open">On Stack</span>'
              : disc[n.id]
                ? '<span class="table-status-badge status-current">Visiting</span>'
                : '<span class="table-status-badge status-unvisited">Unvisited</span>';
          const metrics =
            disc[n.id] !== undefined
              ? `disc: ${disc[n.id]} | low: ${low[n.id]}`
              : "—";
          return `<tr class="${isCurr ? "active-row" : ""}">
            <td><strong>${n.id}</strong></td>
            <td>${status}</td>
            <td>${metrics}</td>
          </tr>`;
        });
      frontierTableBody.innerHTML = rows.join("");
    } else {
      frontierTableHead.innerHTML = `
        <tr><th>Node</th><th>Status</th><th>Telemetry</th></tr>
      `;
      const closed = new Set(step.closedSet || []);
      const open = new Set(step.openSet || []);
      const rows = nodes
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(n => {
          const isVisited = closed.has(n.id);
          const isFrontier = open.has(n.id);
          const isCurr = step.node === n.id;
          const status = isVisited
            ? '<span class="table-status-badge status-settled">Visited</span>'
            : isFrontier
              ? '<span class="table-status-badge status-open">Frontier</span>'
              : '<span class="table-status-badge status-unvisited">Unvisited</span>';
          return `<tr class="${isCurr ? "active-row" : ""}">
            <td><strong>${n.id}</strong></td>
            <td>${status}</td>
            <td>${isCurr ? "Active focus" : isVisited ? "Processed" : "Pending"}</td>
          </tr>`;
        });
      frontierTableBody.innerHTML = rows.join("");
    }
  }

  function updatePlaybackUI() {
    if (stepCounter)
      stepCounter.textContent = `Step ${Math.max(stepIndex + 1, 0)} / ${steps.length}`;
    const pct = steps.length ? ((stepIndex + 1) / steps.length) * 100 : 0;
    if (stepProgressFill) stepProgressFill.style.width = `${pct}%`;
    if (btnPrev) btnPrev.disabled = stepIndex <= 0;
    if (btnNext)
      btnNext.disabled = steps.length === 0 || stepIndex >= steps.length - 1;

    const currentStep = steps[stepIndex] || null;
    if (explanationText) explanationText.textContent = describeStep(currentStep);

    updateFrontierUI(currentStep);
    render();
    updateResultPanel();
  }

  function goToStep(index) {
    stepIndex = Math.max(-1, Math.min(index, steps.length - 1));
    updatePlaybackUI();
    if (stepIndex >= steps.length - 1) stopPlaying();
  }

  function stopPlaying() {
    playing = false;
    if (playIcon) {
      playIcon.classList.remove("fa-pause");
      playIcon.classList.add("fa-play");
    }
    if (playTimer) clearInterval(playTimer);
    playTimer = null;
  }

  function startPlaying() {
    if (steps.length === 0) steps = computeSteps();
    if (steps.length === 0) return;
    playing = true;
    if (playIcon) {
      playIcon.classList.remove("fa-play");
      playIcon.classList.add("fa-pause");
    }
    playTimer = setInterval(() => {
      if (stepIndex >= steps.length - 1) {
        stopPlaying();
        return;
      }
      goToStep(stepIndex + 1);
    }, Number(speedSlider.value));
  }

  function resetPlayback() {
    stopPlaying();
    steps = [];
    stepIndex = -1;
    finalResult = null;
    if (resultPanel) resultPanel.textContent = "Waiting to start...";
    updatePlaybackUI();
  }

  btnPlay?.addEventListener("click", () => {
    if (playing) {
      stopPlaying();
    } else {
      if (stepIndex >= steps.length - 1) {
        steps = computeSteps();
        stepIndex = -1;
      }
      startPlaying();
    }
  });

  btnNext?.addEventListener("click", () => {
    if (steps.length === 0) steps = computeSteps();
    goToStep(stepIndex + 1);
  });

  btnPrev?.addEventListener("click", () => goToStep(stepIndex - 1));

  btnResetPlay?.addEventListener("click", () => resetPlayback());

  speedSlider?.addEventListener("input", () => {
    if (speedDisplay && speedSlider) {
      speedDisplay.textContent = `${(Number(speedSlider.value) / 1000).toFixed(1)}s / step`;
      speedSlider.setAttribute("aria-valuenow", speedSlider.value);
      speedSlider.setAttribute("aria-valuetext", speedDisplay.textContent);
    }
    if (playing) {
      stopPlaying();
      startPlaying();
    }
  });

  // ===================== IMPORT / EXPORT MODAL =====================

  function serializeGraph(format) {
    const logic =
      typeof window !== "undefined" && window.GraphLogic
        ? window.GraphLogic
        : {
            exportAdjacencyMatrix,
            exportEdgeList,
            exportJSON,
          };

    if (format === "matrix") {
      return logic.exportAdjacencyMatrix(nodes, edges, directed);
    }
    if (format === "edgelist") {
      return logic.exportEdgeList(nodes, edges, directed);
    }
    if (format === "json") {
      return logic.exportJSON(nodes, edges, { directed });
    }
    return "";
  }

  function setIoFeedback(msg, type = "success") {
    if (!ioFeedback) return;
    ioFeedback.textContent = msg;
    ioFeedback.className = `io-feedback ${type}`;
    ioFeedback.hidden = false;
  }

  function openIoModal(modeType) {
    if (!ioModal) return;
    ioModal.hidden = false;
    ioFeedback.hidden = true;
    if (ioModalTitle) {
      ioModalTitle.innerHTML =
        modeType === "export"
          ? '<i class="fa-solid fa-file-export"></i> Export Graph'
          : '<i class="fa-solid fa-file-import"></i> Import Graph';
    }
    if (btnIoApply) {
      btnIoApply.style.display = modeType === "import" ? "inline-flex" : "none";
    }

    if (ioTextarea) {
      ioTextarea.value = serializeGraph(activeIoFormat);
    }
  }

  function closeIoModal() {
    if (ioModal) ioModal.hidden = true;
  }

  btnExportOpen?.addEventListener("click", () => openIoModal("export"));
  btnImportOpen?.addEventListener("click", () => openIoModal("import"));
  btnIoClose?.addEventListener("click", closeIoModal);

  ioModal?.addEventListener("click", e => {
    if (e.target === ioModal) closeIoModal();
  });

  formatTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      formatTabs.forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      activeIoFormat = tab.dataset.format;
      if (ioTextarea) {
        ioTextarea.value = serializeGraph(activeIoFormat);
      }
      ioFeedback.hidden = true;
    });
  });

  btnIoCopy?.addEventListener("click", async () => {
    if (!ioTextarea) return;
    try {
      await navigator.clipboard.writeText(ioTextarea.value);
      setIoFeedback("✓ Graph data copied to clipboard!", "success");
    } catch (err) {
      ioTextarea.select();
      document.execCommand("copy");
      setIoFeedback("✓ Graph data copied to clipboard!", "success");
    }
  });

  btnIoDownload?.addEventListener("click", () => {
    if (!ioTextarea) return;
    const ext = activeIoFormat === "json" ? "json" : "txt";
    const blob = new Blob([ioTextarea.value], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `graph-${activeIoFormat}-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIoFeedback(`✓ Downloaded graph-${activeIoFormat}.${ext}`, "success");
  });

  btnIoApply?.addEventListener("click", () => {
    if (!ioTextarea) return;
    const text = ioTextarea.value.trim();
    if (!text) {
      setIoFeedback("Please enter graph data before importing.", "error");
      return;
    }

    try {
      const logic =
        typeof window !== "undefined" && window.GraphLogic
          ? window.GraphLogic
          : {
              importAdjacencyMatrix,
              importEdgeList,
              importJSON,
            };

      let imported;
      if (activeIoFormat === "json") {
        imported = logic.importJSON(text);
      } else if (activeIoFormat === "matrix") {
        imported = logic.importAdjacencyMatrix(text);
      } else {
        imported = logic.importEdgeList(text);
      }

      if (!imported || !Array.isArray(imported.nodes)) {
        throw new Error("Parsed data does not contain a valid node list.");
      }

      nodes = imported.nodes;
      edges = imported.edges;
      if (imported.directed !== undefined) {
        directed = imported.directed;
        if (toggleDirected) toggleDirected.checked = directed;
      }

      // Update nextNodeCharCode
      const charCodes = nodes.map(n => n.id.charCodeAt(0)).filter(c => !isNaN(c));
      nextNodeCharCode = charCodes.length ? Math.max(...charCodes) + 1 : 65;

      refreshNodeSelectors();
      resetPlayback();
      render();

      setIoFeedback(
        `✓ Successfully imported ${nodes.length} nodes and ${edges.length} edges!`,
        "success"
      );
      setTimeout(closeIoModal, 750);
    } catch (err) {
      setIoFeedback(`Import error: ${err.message}`, "error");
    }
  });

  // ===================== THEME TOGGLE =====================
  const themeToggle = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  themeToggle?.addEventListener("click", () => {
    const isLight = document.documentElement.classList.toggle("light-theme");
    themeToggle.setAttribute("aria-pressed", String(isLight));
    if (themeIcon) {
      themeIcon.classList.toggle("fa-moon", !isLight);
      themeIcon.classList.toggle("fa-sun", isLight);
    }
  });

  // ===================== INIT =====================
  updateAlgoControls();
  render();
  updatePlaybackUI();
})();

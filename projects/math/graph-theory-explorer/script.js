/**
 * script.js — Graph Theory Explorer
 * DOM wiring: graph editing (click/drag), algorithm selection, and the
 * play/step/reset animation loop. All algorithm logic lives in graphLogic.js.
 */

(function () {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const canvas = document.getElementById("graph-canvas");

    // ----- State -----
    let nodes = []; // { id, x, y }
    let edges = []; // { from, to, weight }
    let mode = "add-node"; // "add-node" | "add-edge"
    let algorithm = "bfs"; // "bfs" | "dfs" | "mst" | "dijkstra"
    let edgeFirstNode = null; // holds the first click when in add-edge mode
    let nextNodeCharCode = 65; // 'A'

    // Animation state
    let steps = [];
    let stepIndex = -1;
    let playing = false;
    let playTimer = null;
    let finalResult = null; // extra info from the algorithm (distances, mstEdges, etc.)

    // ----- DOM refs -----
    const startSelect = document.getElementById("start-node");
    const endSelect = document.getElementById("end-node");
    const endGroup = document.getElementById("end-node-group");
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

    // ===================== GRAPH EDITING =====================

    function nextNodeId() {
        const id = String.fromCharCode(nextNodeCharCode);
        nextNodeCharCode++;
        return id;
    }

    function addNode(x, y) {
        const id = nextNodeId();
        nodes.push({ id, x, y });
        render();
        refreshNodeSelectors();
    }

    function addEdge(fromId, toId) {
        if (fromId === toId) return;
        const exists = edges.some(
            e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
        );
        if (exists) return;
        const weightInput = window.prompt(`Weight for edge ${fromId} → ${toId}:`, "1");
        const weight = Number(weightInput);
        edges.push({ from: fromId, to: toId, weight: Number.isFinite(weight) && weight > 0 ? weight : 1 });
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
        // Ignore clicks that landed on a node (handled separately) or during playback.
        if (playing || evt.target?.closest(".node-circle") || evt.target?.closest(".node-label")) return;
        if (mode !== "add-node") return;
        const { x, y } = getSvgPoint(evt);
        addNode(x, y);
    });

    function onNodeClick(nodeId) {
        if (mode !== "add-edge" || playing) return;
        if (!edgeFirstNode) {
            edgeFirstNode = nodeId;
            if (canvasHint) canvasHint.textContent = `Now click a second node to connect to ${nodeId}`;
        } else {
            addEdge(edgeFirstNode, nodeId);
            edgeFirstNode = null;
            if (canvasHint) canvasHint.textContent = "Click two nodes to connect them";
        }
    }

    // ----- Node dragging -----
    let draggingNode = null;

    function onNodePointerDown(nodeId, evt) {
        if (mode !== "add-node") return; // only drag in "add-node" mode to keep edge clicks simple
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

    function clearSvg() {
        if (!canvas) return;
        while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
    }

    function edgeClass(from, to) {
        if (!steps.length || stepIndex < 0) return "";
        const seen = steps.slice(0, stepIndex + 1);
        for (const step of seen) {
            if (!step.edge) continue;
            const matches =
                (step.edge.from === from && step.edge.to === to) ||
                (step.edge.from === to && step.edge.to === from);
            if (!matches) continue;
            if (step.type === "tree-edge") return "tree-edge";
            if (step.type === "frontier-edge") return "frontier-edge";
        }
        if (finalResult && finalResult.path && finalResult.path.length) {
            for (let i = 0; i < finalResult.path.length - 1; i++) {
                const a = finalResult.path[i];
                const b = finalResult.path[i + 1];
                if ((a === from && b === to) || (a === to && b === from)) return "path-edge";
            }
        }
        return "";
    }

    function nodeClass(nodeId) {
        if (!steps.length || stepIndex < 0) return "";
        const seen = steps.slice(0, stepIndex + 1);
        const isVisited = seen.some(
            s => (s.type === "visit" || s.type === "settle") && s.node === nodeId
        );
        const isCurrent =
            steps[stepIndex] &&
            (steps[stepIndex].node === nodeId ||
                (steps[stepIndex].edge && steps[stepIndex].edge.to === nodeId));
        const onPath = finalResult && finalResult.path && finalResult.path.includes(nodeId);

        if (stepIndex === steps.length - 1 && onPath) return "on-path";
        if (isCurrent) return "current";
        if (isVisited) return "visited";
        return "";
    }

    function render() {
        clearSvg();

        // Edges first, so nodes draw on top.
        for (const edge of edges) {
            const from = nodes.find(n => n.id === edge.from);
            const to = nodes.find(n => n.id === edge.to);
            if (!from || !to) continue;

            const line = document.createElementNS(SVG_NS, "line");
            line.setAttribute("x1", from.x);
            line.setAttribute("y1", from.y);
            line.setAttribute("x2", to.x);
            line.setAttribute("y2", to.y);
            line.setAttribute("class", `edge-line ${edgeClass(edge.from, edge.to)}`.trim());
            canvas.appendChild(line);

            const midX = (from.x + to.x) / 2;
            const midY = (from.y + to.y) / 2;
            const label = document.createElementNS(SVG_NS, "text");
            label.setAttribute("x", midX);
            label.setAttribute("y", midY - 6);
            label.setAttribute("class", "edge-weight");
            label.textContent = edge.weight;
            canvas.appendChild(label);
        }

        // Nodes.
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
            circle.addEventListener("mousedown", evt => onNodePointerDown(node.id, evt));
            canvas.appendChild(circle);

            const label = document.createElementNS(SVG_NS, "text");
            label.setAttribute("x", node.x);
            label.setAttribute("y", node.y);
            label.setAttribute("class", "node-label");
            label.textContent = node.id;
            canvas.appendChild(label);
        }
    }

    // ===================== ALGORITHM SELECTION =====================

    document.querySelectorAll(".op-btn[data-algo]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".op-btn[data-algo]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            algorithm = btn.dataset.algo;
            endGroup.style.display = algorithm === "dijkstra" ? "flex" : "none";
            resetPlayback();
        });
    });

    document.querySelectorAll(".op-btn[data-mode]").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".op-btn[data-mode]").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            mode = btn.dataset.mode;
            edgeFirstNode = null;
            canvasHint.textContent =
                mode === "add-node" ? "Click empty space to add a node" : "Click two nodes to connect them";
        });
    });

    function refreshNodeSelectors() {
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
        if (nodes.some(n => n.id === currentStart)) startSelect.value = currentStart;
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
        // A handful of random weighted edges, connecting the ring plus a couple chords.
        const ids = nodes.map(n => n.id);
        for (let i = 0; i < ids.length; i++) {
            edges.push({ from: ids[i], to: ids[(i + 1) % ids.length], weight: 1 + Math.floor(Math.random() * 9) });
        }
        for (let i = 0; i < 2; i++) {
            const a = ids[Math.floor(Math.random() * ids.length)];
            const b = ids[Math.floor(Math.random() * ids.length)];
            if (a !== b) edges.push({ from: a, to: b, weight: 1 + Math.floor(Math.random() * 9) });
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

    // ===================== PLAYBACK =====================

    function computeSteps() {
        const startId = startSelect.value;
        const endId = endSelect.value;
        finalResult = null;

        if (!startId || nodes.length === 0) return [];

        if (algorithm === "bfs") return bfs(nodes, edges, startId);
        if (algorithm === "dfs") return dfs(nodes, edges, startId);
        if (algorithm === "mst") {
            const result = primMST(nodes, edges, startId);
            finalResult = result;
            return result.steps;
        }
        if (algorithm === "dijkstra") {
            const result = dijkstra(nodes, edges, startId, endId);
            finalResult = result;
            return result.steps;
        }
        return [];
    }

    function describeStep(step) {
        if (!step) return "Ready.";
        if (step.type === "visit") return `Visiting node ${step.node}.`;
        if (step.type === "settle") return `Node ${step.node} distance finalized.`;
        if (step.type === "frontier-edge") return `Traveling edge ${step.edge.from} → ${step.edge.to}.`;
        if (step.type === "tree-edge")
            return `Adding edge ${step.edge.from} → ${step.edge.to} (weight ${step.edge.weight}) to the tree.`;
        if (step.type === "relax") return `Found a shorter path via edge ${step.edge.from} → ${step.edge.to}.`;
        return "";
    }

    function updateResultPanel() {
        if (stepIndex < steps.length - 1 || !finalResult) return;
        if (algorithm === "mst") {
            resultPanel.textContent = `MST total weight: ${finalResult.totalWeight}\nEdges: ${finalResult.mstEdges
                .map(e => `${e.from}-${e.to} (${e.weight})`)
                .join(", ")}`;
        } else if (algorithm === "dijkstra") {
            const lines = Object.entries(finalResult.distances).map(
                ([id, d]) => `${id}: ${d === Infinity ? "unreachable" : d}`
            );
            const pathLine = finalResult.path.length
                ? `Shortest path: ${finalResult.path.join(" → ")}`
                : "No path to the selected end node.";
            resultPanel.textContent = `${pathLine}\n\nDistances from start:\n${lines.join("\n")}`;
        }
    }

    function updatePlaybackUI() {
        stepCounter.textContent = `Step ${Math.max(stepIndex + 1, 0)} / ${steps.length}`;
        const pct = steps.length ? ((stepIndex + 1) / steps.length) * 100 : 0;
        stepProgressFill.style.width = `${pct}%`;
        btnPrev.disabled = stepIndex <= 0;
        btnNext.disabled = steps.length === 0 || stepIndex >= steps.length - 1;
        explanationText.textContent = describeStep(steps[stepIndex]);
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
        playIcon.classList.remove("fa-pause");
        playIcon.classList.add("fa-play");
        if (playTimer) clearInterval(playTimer);
        playTimer = null;
    }

    function startPlaying() {
        if (steps.length === 0) steps = computeSteps();
        if (steps.length === 0) return;
        playing = true;
        playIcon.classList.remove("fa-play");
        playIcon.classList.add("fa-pause");
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
        if (speedDisplay && speedSlider) speedDisplay.textContent = `${(Number(speedSlider.value) / 1000).toFixed(1)}s / step`;
        if (playing) {
            stopPlaying();
            startPlaying();
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
    if (endGroup) endGroup.style.display = "none"; // only relevant for Dijkstra
    render();
})();
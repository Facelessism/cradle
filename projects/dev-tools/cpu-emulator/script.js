// --- DOM BINDING, INTERACTIVE DEBUGGER & PIPELINE RENDERING LAYER ---
const cpu = createCPUState(16);

// Pipeline Registers State
let pipeline = {
  IF_ID: {
    pc: 0,
    opcode: null,
    byte1: null,
    byte2: null,
    valid: false,
    instrStr: "NOP",
  },
  ID_EX: {
    pc: 0,
    opcode: null,
    val1: 0,
    val2: 0,
    destReg: null,
    addr: 0,
    writeReg: false,
    memRead: false,
    memWrite: false,
    branch: false,
    branchCond: false,
    valid: false,
    instrStr: "NOP",
    srcReg1: null,
    srcReg2: null,
  },
  EX_MEM: {
    pc: 0,
    opcode: null,
    aluResult: 0,
    val2: 0,
    destReg: null,
    writeReg: false,
    memRead: false,
    memWrite: false,
    branchTarget: 0,
    branchTaken: false,
    valid: false,
    instrStr: "NOP",
  },
  MEM_WB: {
    pc: 0,
    opcode: null,
    memData: 0,
    aluResult: 0,
    destReg: null,
    writeReg: false,
    valid: false,
    instrStr: "NOP",
  },
};

let runLoopActive = false;
let isAnimating = false;
let stallPipeline = false;
let flushPipeline = false;

// Breakpoint tracking
const lineBreakpoints = new Set(); // 1-based source line numbers
const addrBreakpoints = new Set(); // 0-based memory addresses
let sourceMap = { lineToAddress: new Map(), addressToLine: new Map() };
let temporaryBreakpoint = null;

// --- DOM BINDINGS ---
const ramGrid = document.getElementById("ram-matrix");
const consoleOutput = document.getElementById("console-output");
const btnAssemble = document.getElementById("btn-assemble");
const btnStep = document.getElementById("btn-step");
const btnStepInto = document.getElementById("btn-step-into");
const btnStepOver = document.getElementById("btn-step-over");
const btnStepOut = document.getElementById("btn-step-out");
const btnRun = document.getElementById("btn-run");
const btnReset = document.getElementById("btn-reset");
const chkAnimate = document.getElementById("chk-animate");
const animationLayer = document.getElementById("animation-layer");
const presetSelector = document.getElementById("preset-selector");
const assemblyInput = document.getElementById("assembly-input");
const editorGutter = document.getElementById("editor-gutter");
const hexTableBody = document.getElementById("hex-table-body");
const disasmScrollList = document.getElementById("disasm-scroll-list");
const btnHexClear = document.getElementById("btn-hex-clear");
const btnDisasmCopy = document.getElementById("btn-disasm-copy");

// Tab switching
const tabBtnHex = document.getElementById("tab-btn-hex");
const tabBtnDisasm = document.getElementById("tab-btn-disasm");
const tabBtnRam = document.getElementById("tab-btn-ram");
const tabBtnCallstack = document.getElementById("tab-btn-callstack");
const viewHex = document.getElementById("view-hex");
const viewDisasm = document.getElementById("view-disasm");
const viewRam = document.getElementById("view-ram");
const viewCallstack = document.getElementById("view-callstack");
const callstackFramesList = document.getElementById("callstack-frames-list");
const traceScrollList = document.getElementById("trace-scroll-list");
const btnTraceClear = document.getElementById("btn-trace-clear");
const badgeCallstackDepth = document.getElementById("badge-callstack-depth");
const regDepth = document.getElementById("reg-depth");

const PRESETS = {
  counter: `; Counter
; Loops from 10 down to 0, storing each value in RAM
MOV A, 10
; loop (addr 3):
MOV [15], A
DEC A
JNZ 3
HALT`,
  fibonacci: `; Fibonacci
; Generates Fibonacci numbers in registers A and B
MOV A, 0
MOV B, 1
; A = A+B, B = B+A generates sequence
ADD A, B
ADD B, A
JMP 6`,
  memcpy: `; Memory Copy
; Copies RAM [0-1] to [14-15]
MOV A, [0]
MOV [14], A
MOV A, [1]
MOV [15], A
HALT`,
  cond: `; Conditional Logic
; Demonstrates CMP and JZ instructions
MOV A, 5
MOV B, 5
CMP A, B
JZ 13
INC C
HALT`,
  call_subroutine: `; Subroutine & Stack Demo
; Demonstrates CALL, RET, and Stack Pointer (SP)
MOV A, 5
CALL 8         ; Call DOUBLE function at addr 8
MOV B, A       ; Save doubled result into Reg B
HALT
; Subroutine DOUBLE (addr 8):
ADD A, A       ; A = A + A
RET            ; Return to caller`,
  flag_demo: `; Flag Indicators Demo (Z, C, N, V)
MOV A, 127     ; 0x7F: max signed positive 8-bit
MOV B, 1
ADD A, B       ; 127 + 1 = 128 (0x80) -> Sets N and V!
SUB A, B       ; 128 - 1 = 127 -> Clears N and V
MOV B, 127
SUB A, B       ; 127 - 127 = 0 -> Sets Zero (Z)!
HALT`,
  nested_subroutines: `; Nested Subroutines & Debugging
; Demonstrates nested CALL, RET, stack frames, and register flow
CALL 3         ; Call Subroutine 1 (returns to 2)
HALT           ; Main termination (addr 2)
; Subroutine 1 (addr 3):
INC A          ; A = 1 (addr 3)
CALL 8         ; Call Subroutine 2 (addr 5, returns to 7)
RET            ; Return to main (addr 7)
; Subroutine 2 (addr 8):
ADD A, A       ; A = 1 + 1 = 2 (addr 8)
RET            ; Return to Subroutine 1 (addr 11)`,
};

if (presetSelector) {
  presetSelector.addEventListener("change", e => {
    if (PRESETS[e.target.value]) {
      assemblyInput.value = PRESETS[e.target.value];
      renderGutter();
      handleAssemble();
    }
  });
}

// --- GUTTER & BREAKPOINT HANDLING ---
function renderGutter() {
  if (!editorGutter || !assemblyInput) return;
  const lines = assemblyInput.value.split("\n");
  const currentLine = sourceMap.addressToLine.get(cpu.PC);

  editorGutter.innerHTML = "";
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const lineDiv = document.createElement("div");
    lineDiv.className = "gutter-line";
    lineDiv.dataset.line = lineNum;

    if (currentLine === lineNum && !cpu.halted) {
      lineDiv.classList.add("active-pc-line");
    }

    const dot = document.createElement("span");
    dot.className = "bp-dot";
    dot.title = `Click to toggle breakpoint on line ${lineNum}`;
    if (lineBreakpoints.has(lineNum)) {
      dot.classList.add("has-breakpoint");
    }

    const num = document.createElement("span");
    num.className = "line-num";
    num.textContent = lineNum;

    const marker = document.createElement("span");
    marker.className = "pc-marker";
    marker.textContent = "▶";

    lineDiv.append(dot, num, marker);

    lineDiv.addEventListener("click", () => {
      toggleBreakpoint(lineNum);
    });

    editorGutter.appendChild(lineDiv);
  }
}

function toggleBreakpoint(lineNum) {
  if (lineBreakpoints.has(lineNum)) {
    lineBreakpoints.delete(lineNum);
    const mappedAddr = sourceMap.lineToAddress.get(lineNum);
    if (mappedAddr !== undefined) addrBreakpoints.delete(mappedAddr);
    printConsole(`Breakpoint removed from line ${lineNum}.`);
  } else {
    lineBreakpoints.add(lineNum);
    const mappedAddr = sourceMap.lineToAddress.get(lineNum);
    if (mappedAddr !== undefined) addrBreakpoints.add(mappedAddr);
    printConsole(`Breakpoint set on line ${lineNum} (Address 0x${(mappedAddr || 0).toString(16).toUpperCase().padStart(2, "0")}).`);
  }
  renderGutter();
  renderDisassembler();
}

function toggleAddrBreakpoint(addr) {
  if (addrBreakpoints.has(addr)) {
    addrBreakpoints.delete(addr);
    const mappedLine = sourceMap.addressToLine.get(addr);
    if (mappedLine !== undefined) lineBreakpoints.delete(mappedLine);
    printConsole(`Breakpoint removed from Address 0x${addr.toString(16).toUpperCase().padStart(2, "0")}.`);
  } else {
    addrBreakpoints.add(addr);
    const mappedLine = sourceMap.addressToLine.get(addr);
    if (mappedLine !== undefined) lineBreakpoints.add(mappedLine);
    printConsole(`Breakpoint set on Address 0x${addr.toString(16).toUpperCase().padStart(2, "0")}.`);
  }
  renderGutter();
  renderDisassembler();
}

if (assemblyInput && editorGutter) {
  assemblyInput.addEventListener("scroll", () => {
    editorGutter.scrollTop = assemblyInput.scrollTop;
  });
  assemblyInput.addEventListener("input", () => {
    renderGutter();
  });
}

// --- HARDWARE DASHBOARD RENDERING ---
function renderInitialHardwareGrid() {
  if (!ramGrid) return;
  ramGrid.innerHTML = "";
  for (let i = 0; i < cpu.RAM.length; i++) {
    const hexAddress = "0x" + i.toString(16).toUpperCase();
    const cell = document.createElement("div");
    cell.className = "ram-cell";
    cell.id = `ram-cell-${i}`;
    const addrSpan = document.createElement("span");
    addrSpan.className = "ram-addr";
    addrSpan.textContent = hexAddress;
    const dataSpan = document.createElement("span");
    dataSpan.className = "ram-data";
    dataSpan.id = `ram-data-${i}`;
    dataSpan.textContent = "00";
    cell.append(addrSpan, dataSpan);
    ramGrid.appendChild(cell);
  }
}

function updateHardwareDashboard() {
  const setRegText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };

  setRegText("reg-a", cpu.registers.A.toString(16).toUpperCase().padStart(2, "0"));
  setRegText("reg-b", cpu.registers.B.toString(16).toUpperCase().padStart(2, "0"));
  setRegText("reg-c", cpu.registers.C.toString(16).toUpperCase().padStart(2, "0"));
  setRegText("reg-d", cpu.registers.D.toString(16).toUpperCase().padStart(2, "0"));
  setRegText("reg-pc", "0x" + cpu.PC.toString(16).toUpperCase().padStart(2, "0"));
  setRegText("reg-sp", "0x" + cpu.registers.SP.toString(16).toUpperCase().padStart(2, "0"));
  setRegText("reg-depth", (cpu.callFrames ? cpu.callFrames.length : 0).toString());

  setRegText(
    "reg-flags",
    `Z:${cpu.flags.Z} C:${cpu.flags.C} N:${cpu.flags.N || 0} V:${cpu.flags.V || 0}`
  );

  // Update live flag badges
  const updateFlagBadge = (key, val) => {
    const badge = document.getElementById(`flag-badge-${key.toLowerCase()}`);
    const bit = document.getElementById(`flag-bit-${key.toLowerCase()}`);
    if (badge) {
      if (val === 1) badge.classList.add("active");
      else badge.classList.remove("active");
    }
    if (bit) bit.textContent = val;
  };

  updateFlagBadge("z", cpu.flags.Z);
  updateFlagBadge("c", cpu.flags.C);
  updateFlagBadge("n", cpu.flags.N || 0);
  updateFlagBadge("v", cpu.flags.V || 0);

  // Update RAM Grid
  for (let i = 0; i < cpu.RAM.length; i++) {
    const cell = document.getElementById(`ram-cell-${i}`);
    const dataElement = document.getElementById(`ram-data-${i}`);
    if (dataElement) {
      dataElement.textContent = cpu.RAM[i].toString(16).toUpperCase().padStart(2, "0");
    }
    if (cell) {
      cell.classList.remove("active-pc", "active-sp");
      if (i === cpu.PC && !cpu.halted) {
        cell.classList.add("active-pc");
      }
      if (i === cpu.registers.SP) {
        cell.classList.add("active-sp");
      }
    }
  }

  // Pipeline UI
  updatePipelineUI("if", pipeline.IF_ID.valid ? pipeline.IF_ID.instrStr : "NOP", stallPipeline);
  updatePipelineUI("id", pipeline.ID_EX.valid ? pipeline.ID_EX.instrStr : "NOP", stallPipeline && pipeline.ID_EX.valid);
  updatePipelineUI("ex", pipeline.EX_MEM.valid ? pipeline.EX_MEM.instrStr : "NOP", false);
  updatePipelineUI("mem", pipeline.MEM_WB.valid ? pipeline.MEM_WB.instrStr : "NOP", false);
  updatePipelineUI("wb", pipeline.MEM_WB.valid ? pipeline.MEM_WB.instrStr : "NOP", false);

  renderHexViewer();
  renderDisassembler();
  renderGutter();
  renderCallStackView();
  renderTraceView();
}

// Execution Trace state
let executionTrace = [];
const MAX_TRACE_ENTRIES = 100;

function recordTraceStep(entry) {
  executionTrace.push(entry);
  if (executionTrace.length > MAX_TRACE_ENTRIES) {
    executionTrace.shift();
  }
}

function renderCallStackView() {
  if (!callstackFramesList) return;
  const depth = cpu.callFrames ? cpu.callFrames.length : 0;
  if (badgeCallstackDepth) {
    badgeCallstackDepth.textContent = `${depth} Frame${depth === 1 ? "" : "s"}`;
  }
  if (regDepth) {
    regDepth.textContent = depth;
  }

  if (!cpu.callFrames || cpu.callFrames.length === 0) {
    callstackFramesList.innerHTML = `<div class="callstack-empty-msg">No active subroutine frames (Main execution context)</div>`;
    return;
  }

  callstackFramesList.innerHTML = cpu.callFrames
    .slice()
    .reverse()
    .map((frame, idx) => {
      const frameIndex = cpu.callFrames.length - idx;
      return `
        <div class="call-frame-card" data-depth="${frame.depth}">
          <span class="call-frame-depth">Frame #${frameIndex} (Depth ${frame.depth})</span>
          <div class="call-frame-info">
            <span class="call-frame-target" title="Target subroutine address">Sub @ 0x${frame.targetAddr.toString(16).toUpperCase().padStart(2, "0")}</span>
            <span class="call-frame-ret" title="Return address saved on stack">Ret -> 0x${frame.returnAddr.toString(16).toUpperCase().padStart(2, "0")}</span>
            <span class="call-frame-sp" title="Stack pointer at entry">SP: 0x${frame.sp.toString(16).toUpperCase().padStart(2, "0")}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTraceView() {
  if (!traceScrollList) return;
  if (executionTrace.length === 0) {
    traceScrollList.innerHTML = `<div class="trace-empty-msg">Trace is empty. Execute steps or clock cycles to inspect flow.</div>`;
    return;
  }

  traceScrollList.innerHTML = executionTrace
    .map(entry => {
      let badgeClass = "trace-flow-seq";
      if (entry.flowType === "CALL") badgeClass = "trace-flow-call";
      else if (entry.flowType === "RET") badgeClass = "trace-flow-ret";
      else if (entry.flowType === "BRANCH_TAKEN" || entry.flowType === "BRANCH_NOT_TAKEN") badgeClass = "trace-flow-branch";
      else if (entry.flowType === "HALT") badgeClass = "trace-flow-halt";

      const changesStr = entry.changes ? `<span class="trace-changes">${entry.changes}</span>` : "";

      return `
        <div class="trace-entry">
          <span class="trace-step-num">#${entry.step}</span>
          <span class="trace-pc">0x${entry.pc.toString(16).toUpperCase().padStart(2, "0")}</span>
          <span class="trace-instr">${entry.instrStr}</span>
          <span class="trace-flow-badge ${badgeClass}">${entry.flowType}</span>
          <span class="trace-desc" style="color: #94a3b8; font-size: 0.7rem;">${entry.flowDesc}</span>
          ${changesStr}
        </div>
      `;
    })
    .join("");

  traceScrollList.scrollTop = traceScrollList.scrollHeight;
}

function updatePipelineUI(stage, instrStr, isStalled) {
  const stageEl = document.getElementById(`stage-${stage}`);
  const instrEl = document.getElementById(`instr-${stage}`);
  if (!stageEl || !instrEl) return;

  instrEl.textContent = instrStr;
  stageEl.classList.remove("active", "bubble", "stalled");
  if (isStalled) {
    stageEl.classList.add("stalled");
  } else if (instrStr === "NOP" || instrStr === "BUBBLE") {
    stageEl.classList.add("bubble");
  } else {
    stageEl.classList.add("active");
  }
}

function printConsole(text, isError = false) {
  if (!consoleOutput) return;
  consoleOutput.textContent = text;
  consoleOutput.style.color = isError ? "#ef4444" : "#a4b0be";
}

// --- MEMORY HEX DUMP VIEWER & DIRECT EDITING ---
function renderHexViewer() {
  if (!hexTableBody) return;
  hexTableBody.innerHTML = "";

  const ram = cpu.RAM;
  const bytesPerRow = 8;
  const totalRows = Math.ceil(ram.length / bytesPerRow);

  for (let r = 0; r < totalRows; r++) {
    const rowAddr = r * bytesPerRow;
    const tr = document.createElement("tr");

    // Offset column
    const tdOffset = document.createElement("td");
    tdOffset.className = "col-offset";
    tdOffset.textContent = "0x" + rowAddr.toString(16).toUpperCase().padStart(2, "0") + ":";
    tr.appendChild(tdOffset);

    // 8 Byte Columns
    let asciiChars = "";
    for (let col = 0; col < bytesPerRow; col++) {
      const addr = rowAddr + col;
      const td = document.createElement("td");

      if (addr < ram.length) {
        const val = ram[addr];
        const valHex = val.toString(16).toUpperCase().padStart(2, "0");
        const span = document.createElement("span");
        span.className = "hex-cell";
        span.dataset.addr = addr;
        span.textContent = valHex;

        const isPC = addr === cpu.PC && !cpu.halted;
        const isSP = addr === cpu.registers.SP;

        if (isPC && isSP) {
          span.classList.add("cell-both");
          span.title = `Address 0x${addr.toString(16).toUpperCase().padStart(2, "0")} (PC & SP)`;
        } else if (isPC) {
          span.classList.add("cell-pc");
          span.title = `Address 0x${addr.toString(16).toUpperCase().padStart(2, "0")} (Program Counter)`;
        } else if (isSP) {
          span.classList.add("cell-sp");
          span.title = `Address 0x${addr.toString(16).toUpperCase().padStart(2, "0")} (Stack Pointer)`;
        } else {
          span.title = `Address 0x${addr.toString(16).toUpperCase().padStart(2, "0")}: ${val} (0x${valHex})`;
        }

        span.addEventListener("click", e => {
          e.stopPropagation();
          startHexInlineEdit(span, addr);
        });

        td.appendChild(span);

        // ASCII representation
        asciiChars += val >= 32 && val <= 126 ? String.fromCharCode(val) : ".";
      } else {
        td.textContent = "--";
        asciiChars += " ";
      }
      tr.appendChild(td);
    }

    // ASCII Column
    const tdAscii = document.createElement("td");
    tdAscii.className = "col-ascii ascii-cell";
    tdAscii.textContent = asciiChars;
    tr.appendChild(tdAscii);

    hexTableBody.appendChild(tr);
  }
}

function startHexInlineEdit(spanEl, addr) {
  const currentVal = cpu.RAM[addr].toString(16).toUpperCase().padStart(2, "0");
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 2;
  input.className = "hex-inline-input";
  input.value = currentVal;

  spanEl.innerHTML = "";
  spanEl.appendChild(input);
  input.focus();
  input.select();

  const commitEdit = () => {
    const raw = input.value.trim();
    const parsed = parseInt(raw, 16);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 255) {
      cpu.RAM[addr] = parsed;
      printConsole(
        `Memory 0x${addr.toString(16).toUpperCase().padStart(2, "0")} modified: 0x${currentVal} -> 0x${parsed.toString(16).toUpperCase().padStart(2, "0")}`
      );
    }
    updateHardwareDashboard();
  };

  input.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      commitEdit();
    } else if (e.key === "Escape") {
      updateHardwareDashboard();
    }
  });

  input.addEventListener("blur", commitEdit);
}

// --- DISASSEMBLER RENDERING ---
function renderDisassembler() {
  if (!disasmScrollList) return;
  disasmScrollList.innerHTML = "";

  const instructions = disassembleMemory(cpu.RAM);

  instructions.forEach(instr => {
    const row = document.createElement("div");
    row.className = "disasm-row";
    row.dataset.addr = instr.address;

    if (instr.address === cpu.PC && !cpu.halted) {
      row.classList.add("active-pc");
    }

    const isBp = addrBreakpoints.has(instr.address);
    if (isBp) {
      row.classList.add("has-breakpoint");
    }

    const bpBtn = document.createElement("span");
    bpBtn.className = `disasm-bp-btn ${isBp ? "active" : ""}`;
    bpBtn.textContent = "●";
    bpBtn.title = `Toggle breakpoint at 0x${instr.address.toString(16).toUpperCase().padStart(2, "0")}`;
    bpBtn.addEventListener("click", e => {
      e.stopPropagation();
      toggleAddrBreakpoint(instr.address);
    });

    const pcArrow = document.createElement("span");
    pcArrow.className = "disasm-pc-arrow";
    pcArrow.textContent = "▶";

    const addrSpan = document.createElement("span");
    addrSpan.className = "disasm-addr";
    addrSpan.textContent = "0x" + instr.address.toString(16).toUpperCase().padStart(2, "0");

    const hexSpan = document.createElement("span");
    hexSpan.className = "disasm-hex";
    hexSpan.textContent = instr.hexBytes;

    const codeSpan = document.createElement("span");
    codeSpan.className = "disasm-code";
    codeSpan.textContent = instr.instruction;

    row.append(bpBtn, pcArrow, addrSpan, hexSpan, codeSpan);
    disasmScrollList.appendChild(row);
  });
}

// Copy disassembled instructions back into editor
if (btnDisasmCopy) {
  btnDisasmCopy.addEventListener("click", () => {
    const instructions = disassembleMemory(cpu.RAM);
    const code = instructions
      .filter(i => i.mnemonic !== "DB" || i.bytes[0] !== 0)
      .map(i => i.instruction)
      .join("\n");

    if (code.trim()) {
      assemblyInput.value = code;
      renderGutter();
      handleAssemble();
      printConsole("Disassembled machine code synchronized to Assembly Editor.");
    } else {
      printConsole("Memory is zeroed/empty. Nothing to copy.");
    }
  });
}

if (btnHexClear) {
  btnHexClear.addEventListener("click", () => {
    cpu.RAM.fill(0);
    updateHardwareDashboard();
    printConsole("RAM memory cleared to 0x00.");
  });
}

// --- TAB SWITCHING ---
function setupTabs() {
  const tabs = [
    { btn: tabBtnHex, view: viewHex },
    { btn: tabBtnDisasm, view: viewDisasm },
    { btn: tabBtnRam, view: viewRam },
    { btn: tabBtnCallstack, view: viewCallstack },
  ];

  tabs.forEach(({ btn, view }) => {
    if (!btn || !view) return;
    btn.addEventListener("click", () => {
      tabs.forEach(t => {
        if (!t.btn || !t.view) return;
        t.btn.classList.remove("active");
        t.btn.setAttribute("aria-selected", "false");
        t.view.hidden = true;
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      view.hidden = false;
    });
  });
}
setupTabs();

// --- DATA FLOW ANIMATIONS ---
function getCenterCoords(element) {
  const rect = element.getBoundingClientRect();
  const containerEl = document.querySelector(".emulator-container");
  const containerRect = containerEl
    ? containerEl.getBoundingClientRect()
    : { left: 0, top: 0 };
  return {
    x: rect.left + rect.width / 2 - containerRect.left,
    y: rect.top + rect.height / 2 - containerRect.top,
  };
}

function animateDataFlow(sourceElId, destElId) {
  return new Promise(resolve => {
    if (!chkAnimate || !chkAnimate.checked) {
      resolve();
      return;
    }

    const sourceEl = document.getElementById(sourceElId);
    const destEl = document.getElementById(destElId);
    if (!sourceEl || !destEl) {
      resolve();
      return;
    }

    const start = getCenterCoords(sourceEl);
    const end = getCenterCoords(destEl);

    sourceEl.classList.add("highlight-read");
    destEl.classList.add("highlight-write");

    const path = document.createElementNS("http://www.w3.org/2000/svg", "line");
    path.setAttribute("x1", start.x);
    path.setAttribute("y1", start.y);
    path.setAttribute("x2", end.x);
    path.setAttribute("y2", end.y);
    path.setAttribute("class", "data-path");

    const packet = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    packet.setAttribute("r", "6");
    packet.setAttribute("cx", start.x);
    packet.setAttribute("cy", start.y);
    packet.setAttribute("class", "data-packet");

    if (animationLayer) {
      animationLayer.appendChild(path);
      animationLayer.appendChild(packet);
    }

    requestAnimationFrame(() => {
      packet.setAttribute("cx", end.x);
      packet.setAttribute("cy", end.y);
    });

    setTimeout(() => {
      sourceEl.classList.remove("highlight-read");
      destEl.classList.remove("highlight-write");
      path.remove();
      packet.remove();
      resolve();
    }, 450);
  });
}

function getRegElementId(reg) {
  return "reg-" + (reg || "").toLowerCase();
}
function getRamElementId(addr) {
  return "ram-cell-" + addr;
}

// --- COMPILER HOOK ---
function handleAssemble() {
  printConsole("Initializing compilation pipeline...");

  try {
    const bytesWritten = assembleCode(assemblyInput.value, cpu.RAM);
    sourceMap = assembleCode.lastSourceMap || {
      lineToAddress: new Map(),
      addressToLine: new Map(),
    };

    resetHardwareState(false);
    setExecutionButtonsDisabled(false);
    renderGutter();
    renderDisassembler();
    renderHexViewer();

    printConsole(
      `Compilation successful (${bytesWritten} bytes emitted). Ready for step-by-step debugging.`
    );
  } catch (err) {
    printConsole(err.message, true);
  }
}

if (btnAssemble) {
  btnAssemble.addEventListener("click", handleAssemble);
}

function setExecutionButtonsDisabled(disabled) {
  if (btnStep) btnStep.disabled = disabled;
  if (btnStepInto) btnStepInto.disabled = disabled;
  if (btnStepOver) btnStepOver.disabled = disabled;
  if (btnStepOut) btnStepOut.disabled = disabled;
  if (btnRun) btnRun.disabled = disabled;
}

// --- PIPELINE STAGES ---
async function executeClockCycleStep() {
  if (
    cpu.halted &&
    !pipeline.IF_ID.valid &&
    !pipeline.ID_EX.valid &&
    !pipeline.EX_MEM.valid &&
    !pipeline.MEM_WB.valid
  ) {
    runLoopActive = false;
    printConsole("Processor execution finished (System HALT or pipeline empty).");
    return;
  }

  if (isAnimating) return;
  isAnimating = true;

  let animations = [];

  wbStage(animations);
  memStage(animations);
  exStage(animations);
  idStage();
  ifStage();

  if (flushPipeline) {
    pipeline.IF_ID = { pc: 0, opcode: null, valid: false, instrStr: "BUBBLE" };
    pipeline.ID_EX = {
      pc: 0,
      opcode: null,
      writeReg: false,
      memRead: false,
      memWrite: false,
      branch: false,
      valid: false,
      instrStr: "BUBBLE",
    };
    flushPipeline = false;
    printConsole("Control Hazard: Branch mispredicted, pipeline flushed.");
  }

  updateHardwareDashboard();

  if (animations.length > 0) {
    await Promise.all(animations);
  } else {
    await new Promise(r => setTimeout(r, 40));
  }

  isAnimating = false;
}

function wbStage(animations) {
  const reg = pipeline.MEM_WB;
  if (reg.valid) {
    if (reg.writeReg && reg.destReg) {
      let writeData =
        reg.opcode === OPCODES.MOV_MEM_R ? reg.memData : reg.aluResult;
      cpu.registers[reg.destReg] = writeData;
      animations.push(
        animateDataFlow(getRegElementId(reg.destReg), getRegElementId(reg.destReg))
      );
    }
    if (reg.opcode === OPCODES.HALT) {
      cpu.halted = true;
    }
  }
}

function memStage(animations) {
  const exReg = pipeline.EX_MEM;
  let memReg = { valid: false, writeReg: false, instrStr: "NOP" };

  if (exReg.valid) {
    memReg = { ...exReg };
    if (exReg.memRead) {
      memReg.memData = cpu.RAM[exReg.aluResult];
      animations.push(
        animateDataFlow(getRamElementId(exReg.aluResult), getRamElementId(exReg.aluResult))
      );
    }
    if (exReg.memWrite) {
      cpu.RAM[exReg.aluResult] = exReg.val2;
      animations.push(
        animateDataFlow(
          getRegElementId(exReg.destReg || "a"),
          getRamElementId(exReg.aluResult)
        )
      );
    }
  }
  pipeline.MEM_WB = memReg;
}

function exStage(animations) {
  const idReg = pipeline.ID_EX;
  let exReg = {
    valid: false,
    writeReg: false,
    memRead: false,
    memWrite: false,
    instrStr: "NOP",
  };

  if (idReg.valid) {
    exReg = { ...idReg };
    const preRegs = { ...cpu.registers };
    const preFlags = { ...cpu.flags };

    let fwdVal1 = idReg.val1;
    let fwdVal2 = idReg.val2;

    if (
      pipeline.EX_MEM.valid &&
      pipeline.EX_MEM.writeReg &&
      pipeline.EX_MEM.destReg !== null
    ) {
      if (pipeline.EX_MEM.destReg === idReg.srcReg1)
        fwdVal1 = pipeline.EX_MEM.aluResult;
      if (pipeline.EX_MEM.destReg === idReg.srcReg2)
        fwdVal2 = pipeline.EX_MEM.aluResult;
    }
    if (
      pipeline.MEM_WB.valid &&
      pipeline.MEM_WB.writeReg &&
      pipeline.MEM_WB.destReg !== null
    ) {
      let wbData =
        pipeline.MEM_WB.opcode === OPCODES.MOV_MEM_R
          ? pipeline.MEM_WB.memData
          : pipeline.MEM_WB.aluResult;
      if (
        pipeline.EX_MEM.destReg !== idReg.srcReg1 &&
        pipeline.MEM_WB.destReg === idReg.srcReg1
      )
        fwdVal1 = wbData;
      if (
        pipeline.EX_MEM.destReg !== idReg.srcReg2 &&
        pipeline.MEM_WB.destReg === idReg.srcReg2
      )
        fwdVal2 = wbData;
    }

    switch (idReg.opcode) {
      case OPCODES.ADD: {
        const sum = fwdVal1 + fwdVal2;
        updateALUFlags(cpu, sum, fwdVal1, fwdVal2, "ADD");
        exReg.aluResult = sum & 0xff;
        animations.push(
          animateDataFlow(getRegElementId(idReg.srcReg1), getRegElementId(idReg.destReg))
        );
        break;
      }
      case OPCODES.SUB: {
        const diff = fwdVal1 - fwdVal2;
        updateALUFlags(cpu, diff, fwdVal1, fwdVal2, "SUB");
        exReg.aluResult = (diff < 0 ? diff + 256 : diff) & 0xff;
        animations.push(
          animateDataFlow(getRegElementId(idReg.srcReg1), getRegElementId(idReg.destReg))
        );
        break;
      }
      case OPCODES.CMP: {
        const diff = fwdVal1 - fwdVal2;
        updateALUFlags(cpu, diff, fwdVal1, fwdVal2, "CMP");
        exReg.aluResult = (diff < 0 ? diff + 256 : diff) & 0xff;
        break;
      }
      case OPCODES.AND: {
        const res = fwdVal1 & fwdVal2 & 0xff;
        updateALUFlags(cpu, res, fwdVal1, fwdVal2, "AND");
        exReg.aluResult = res;
        break;
      }
      case OPCODES.OR: {
        const res = (fwdVal1 | fwdVal2) & 0xff;
        updateALUFlags(cpu, res, fwdVal1, fwdVal2, "OR");
        exReg.aluResult = res;
        break;
      }
      case OPCODES.XOR: {
        const res = (fwdVal1 ^ fwdVal2) & 0xff;
        updateALUFlags(cpu, res, fwdVal1, fwdVal2, "XOR");
        exReg.aluResult = res;
        break;
      }
      case OPCODES.NOT: {
        const res = ~fwdVal1 & 0xff;
        updateALUFlags(cpu, res, fwdVal1, null, "NOT");
        exReg.aluResult = res;
        break;
      }
      case OPCODES.INC: {
        const val = fwdVal1 + 1;
        updateALUFlags(cpu, val, fwdVal1, null, "INC");
        exReg.aluResult = val & 0xff;
        break;
      }
      case OPCODES.DEC: {
        const val = fwdVal1 - 1;
        updateALUFlags(cpu, val, fwdVal1, null, "DEC");
        exReg.aluResult = (val < 0 ? 255 : val) & 0xff;
        break;
      }
      case OPCODES.MOV_LIT:
      case OPCODES.MOV_REG:
        exReg.aluResult = fwdVal2;
        break;
      case OPCODES.MOV_MEM_R:
        exReg.aluResult = idReg.addr;
        break;
      case OPCODES.MOV_R_MEM:
        exReg.aluResult = idReg.addr;
        exReg.val2 = fwdVal1;
        break;
      case OPCODES.PUSH: {
        const ramSize = cpu.RAM.length;
        cpu.registers.SP = (cpu.registers.SP - 1 + ramSize) % ramSize;
        cpu.RAM[cpu.registers.SP] = fwdVal1;
        break;
      }
      case OPCODES.POP: {
        const ramSize = cpu.RAM.length;
        exReg.aluResult = cpu.RAM[cpu.registers.SP];
        cpu.registers.SP = (cpu.registers.SP + 1) % ramSize;
        break;
      }
      case OPCODES.JMP:
        exReg.branchTaken = true;
        exReg.branchTarget = idReg.addr;
        break;
      case OPCODES.JNZ:
        exReg.branchTaken = cpu.flags.Z === 0;
        exReg.branchTarget = idReg.addr;
        break;
      case OPCODES.JZ:
        exReg.branchTaken = cpu.flags.Z === 1;
        exReg.branchTarget = idReg.addr;
        break;
      case OPCODES.CALL: {
        const ramSize = cpu.RAM.length;
        const retAddr = (idReg.pc + 2) & (ramSize - 1);
        cpu.registers.SP = (cpu.registers.SP - 1 + ramSize) % ramSize;
        cpu.RAM[cpu.registers.SP] = retAddr;
        if (!cpu.callStack) cpu.callStack = [];
        cpu.callStack.push(retAddr);
        if (!cpu.callFrames) cpu.callFrames = [];
        cpu.callFrames.push({
          depth: cpu.callStack.length,
          callerPC: idReg.pc,
          targetAddr: idReg.addr,
          returnAddr: retAddr,
          sp: cpu.registers.SP,
        });
        exReg.branchTaken = true;
        exReg.branchTarget = idReg.addr;
        break;
      }
      case OPCODES.RET: {
        const ramSize = cpu.RAM.length;
        const retAddr = cpu.RAM[cpu.registers.SP];
        cpu.registers.SP = (cpu.registers.SP + 1) % ramSize;
        if (cpu.callStack && cpu.callStack.length > 0) cpu.callStack.pop();
        if (cpu.callFrames && cpu.callFrames.length > 0) cpu.callFrames.pop();
        exReg.branchTaken = true;
        exReg.branchTarget = retAddr;
        break;
      }
    }

    if (idReg.branch) {
      let predictedTaken = idReg.addr < idReg.pc;
      if (predictedTaken !== exReg.branchTaken) {
        flushPipeline = true;
        cpu.PC = exReg.branchTaken
          ? exReg.branchTarget
          : idReg.pc + getInstructionLength(idReg.opcode);
      }
    }

    // Record step in execution flow trace
    let flowType = "SEQ";
    let flowDesc = "";
    if (idReg.opcode === OPCODES.CALL) {
      flowType = "CALL";
      const depth = cpu.callFrames ? cpu.callFrames.length : 0;
      flowDesc = `CALL 0x${idReg.addr.toString(16).toUpperCase().padStart(2, "0")} (Depth ${depth}, Ret 0x${((idReg.pc + 2) & (cpu.RAM.length - 1)).toString(16).toUpperCase().padStart(2, "0")})`;
    } else if (idReg.opcode === OPCODES.RET) {
      flowType = "RET";
      const depth = cpu.callFrames ? cpu.callFrames.length : 0;
      flowDesc = `RET to 0x${exReg.branchTarget.toString(16).toUpperCase().padStart(2, "0")} (Depth ${depth})`;
    } else if (idReg.opcode === OPCODES.JMP) {
      flowType = "JMP";
      flowDesc = `JMP 0x${idReg.addr.toString(16).toUpperCase().padStart(2, "0")}`;
    } else if (idReg.opcode === OPCODES.JZ || idReg.opcode === OPCODES.JNZ) {
      flowType = exReg.branchTaken ? "BRANCH_TAKEN" : "BRANCH_NOT_TAKEN";
      flowDesc = exReg.branchTaken
        ? `Branch Taken -> 0x${idReg.addr.toString(16).toUpperCase().padStart(2, "0")}`
        : "Fallthrough";
    } else if (idReg.opcode === OPCODES.HALT) {
      flowType = "HALT";
      flowDesc = "Machine halted";
    } else {
      flowDesc = `Exec ${idReg.instrStr}`;
    }

    const regDiffs = [];
    if (exReg.writeReg && exReg.destReg) {
      regDiffs.push(`${exReg.destReg}: ${exReg.aluResult}`);
    }
    if (preRegs.SP !== cpu.registers.SP) {
      regDiffs.push(`SP: 0x${preRegs.SP.toString(16).toUpperCase().padStart(2, "0")}->0x${cpu.registers.SP.toString(16).toUpperCase().padStart(2, "0")}`);
    }
    const flagDiffs = [];
    for (const flg of ["Z", "C", "N", "V"]) {
      if (preFlags[flg] !== cpu.flags[flg]) flagDiffs.push(`${flg}=${cpu.flags[flg]}`);
    }
    if (flagDiffs.length > 0) {
      regDiffs.push(`[${flagDiffs.join(" ")}]`);
    }

    recordTraceStep({
      step: executionTrace.length + 1,
      pc: idReg.pc,
      instrStr: idReg.instrStr,
      flowType: flowType,
      flowDesc: flowDesc,
      depth: cpu.callFrames ? cpu.callFrames.length : 0,
      changes: regDiffs.join(", "),
    });
  }
  pipeline.EX_MEM = exReg;
}

function idStage() {
  const ifReg = pipeline.IF_ID;
  stallPipeline = false;
  let idReg = {
    valid: false,
    writeReg: false,
    memRead: false,
    memWrite: false,
    branch: false,
    instrStr: "NOP",
  };

  if (ifReg.valid) {
    let opcode = ifReg.opcode;
    let destRegStr = ifReg.byte1 ? String.fromCharCode(ifReg.byte1) : null;
    let srcRegStr = ifReg.byte2 ? String.fromCharCode(ifReg.byte2) : null;

    idReg.pc = ifReg.pc;
    idReg.opcode = opcode;
    idReg.valid = true;
    idReg.instrStr = ifReg.instrStr;

    switch (opcode) {
      case OPCODES.MOV_LIT:
        idReg.destReg = destRegStr;
        idReg.val2 = ifReg.byte2;
        idReg.writeReg = true;
        break;
      case OPCODES.MOV_REG:
        idReg.destReg = destRegStr;
        idReg.srcReg2 = srcRegStr;
        idReg.val2 = cpu.registers[srcRegStr];
        idReg.writeReg = true;
        break;
      case OPCODES.MOV_MEM_R:
        idReg.destReg = destRegStr;
        idReg.addr = ifReg.byte2;
        idReg.memRead = true;
        idReg.writeReg = true;
        break;
      case OPCODES.MOV_R_MEM:
        idReg.addr = ifReg.byte1;
        idReg.srcReg1 = srcRegStr;
        idReg.destReg = srcRegStr;
        idReg.val1 = cpu.registers[srcRegStr];
        idReg.memWrite = true;
        break;
      case OPCODES.ADD:
      case OPCODES.SUB:
      case OPCODES.AND:
      case OPCODES.OR:
      case OPCODES.XOR:
      case OPCODES.CMP:
        idReg.destReg = destRegStr;
        idReg.srcReg1 = destRegStr;
        idReg.srcReg2 = srcRegStr;
        idReg.val1 = cpu.registers[destRegStr];
        idReg.val2 = cpu.registers[srcRegStr];
        idReg.writeReg = opcode !== OPCODES.CMP;
        break;
      case OPCODES.NOT:
      case OPCODES.INC:
      case OPCODES.DEC:
        idReg.destReg = destRegStr;
        idReg.srcReg1 = destRegStr;
        idReg.val1 = cpu.registers[destRegStr];
        idReg.writeReg = true;
        break;
      case OPCODES.PUSH:
        idReg.srcReg1 = destRegStr;
        idReg.val1 = cpu.registers[destRegStr];
        break;
      case OPCODES.POP:
        idReg.destReg = destRegStr;
        idReg.writeReg = true;
        break;
      case OPCODES.JMP:
      case OPCODES.JNZ:
      case OPCODES.JZ:
      case OPCODES.CALL:
        idReg.branch = true;
        idReg.addr = ifReg.byte1;
        break;
      case OPCODES.RET:
        idReg.branch = true;
        break;
      case OPCODES.HALT:
        break;
    }

    if (pipeline.ID_EX.valid && pipeline.ID_EX.memRead) {
      if (
        pipeline.ID_EX.destReg === idReg.srcReg1 ||
        pipeline.ID_EX.destReg === idReg.srcReg2
      ) {
        stallPipeline = true;
      }
    }
  }

  if (!stallPipeline) {
    pipeline.ID_EX = idReg;
  } else {
    pipeline.ID_EX = {
      pc: 0,
      opcode: null,
      writeReg: false,
      memRead: false,
      memWrite: false,
      branch: false,
      valid: false,
      instrStr: "BUBBLE",
    };
  }
}

function ifStage() {
  if (stallPipeline || cpu.halted) return;

  if (cpu.PC >= cpu.RAM.length) {
    pipeline.IF_ID = { valid: false, instrStr: "NOP" };
    return;
  }

  let opcode = cpu.RAM[cpu.PC];
  let len = getInstructionLength(opcode);

  if (cpu.PC + len > cpu.RAM.length) {
    pipeline.IF_ID = { valid: false, instrStr: "NOP" };
    return;
  }

  let mnemonic = getOpcodeMnemonic(opcode);
  let byte1 = len > 1 ? cpu.RAM[cpu.PC + 1] : null;
  let byte2 = len > 2 ? cpu.RAM[cpu.PC + 2] : null;

  let instrStr = mnemonic;
  if (len === 2) {
    if (
      opcode === OPCODES.JMP ||
      opcode === OPCODES.JNZ ||
      opcode === OPCODES.JZ ||
      opcode === OPCODES.CALL
    ) {
      instrStr += ` 0x${byte1.toString(16).toUpperCase()}`;
    } else {
      instrStr += ` ${String.fromCharCode(byte1)}`;
    }
  }
  if (len === 3) {
    instrStr += ` ${String.fromCharCode(byte1)}, ${opcode === OPCODES.MOV_LIT ? byte2 : String.fromCharCode(byte2)}`;
  }

  pipeline.IF_ID = {
    pc: cpu.PC,
    opcode: opcode,
    byte1: byte1,
    byte2: byte2,
    valid: true,
    instrStr: instrStr,
  };

  if (
    opcode === OPCODES.JMP ||
    opcode === OPCODES.JNZ ||
    opcode === OPCODES.JZ
  ) {
    let predictedTaken = byte1 < cpu.PC;
    if (predictedTaken) {
      cpu.PC = byte1;
      return;
    }
  }

  cpu.PC += len;
}

// --- STEP-BY-STEP DEBUGGER IMPLEMENTATION ---

// Check if currently paused at a breakpoint
function checkBreakpoint(pc) {
  if (temporaryBreakpoint !== null && pc === temporaryBreakpoint) {
    temporaryBreakpoint = null;
    return { hit: true, reason: "temporary breakpoint reached" };
  }
  if (addrBreakpoints.has(pc)) {
    return {
      hit: true,
      reason: `Address 0x${pc.toString(16).toUpperCase().padStart(2, "0")}`,
    };
  }
  const line = sourceMap.addressToLine.get(pc);
  if (line !== undefined && lineBreakpoints.has(line)) {
    return { hit: true, reason: `Line ${line}` };
  }
  return { hit: false };
}

// Step Into: Executes one full instruction (advances pipeline until PC moves or finishes)
async function executeStepInto() {
  if (cpu.halted) {
    printConsole("Processor is halted. Reset machine to restart.");
    return;
  }

  const startPC = cpu.PC;
  let cycleGuard = 0;

  // Advance clock cycles until instruction completes or PC changes
  do {
    await executeClockCycleStep();
    cycleGuard++;
  } while (
    !cpu.halted &&
    cpu.PC === startPC &&
    cycleGuard < 10
  );

  const bp = checkBreakpoint(cpu.PC);
  if (bp.hit) {
    printConsole(`Step Into paused at breakpoint (${bp.reason}).`);
  } else {
    printConsole(`Stepped into Address 0x${cpu.PC.toString(16).toUpperCase().padStart(2, "0")}.`);
  }
  updateHardwareDashboard();
}

// Step Over: If current instruction is CALL, run until return address at the same call depth; otherwise Step Into
async function executeStepOver() {
  if (cpu.halted) {
    printConsole("Processor is halted. Reset machine to restart.");
    return;
  }

  const currentOpcode = cpu.RAM[cpu.PC];
  if (currentOpcode === OPCODES.CALL) {
    const returnAddr = (cpu.PC + 2) & (cpu.RAM.length - 1);
    const initialDepth = cpu.callStack ? cpu.callStack.length : 0;
    printConsole(
      `Stepping over CALL at 0x${cpu.PC.toString(16).toUpperCase().padStart(2, "0")} (depth ${initialDepth} -> breaks at 0x${returnAddr.toString(16).toUpperCase().padStart(2, "0")})...`
    );
    await runUntilBreakpointOrHalt(() => {
      const curDepth = cpu.callStack ? cpu.callStack.length : 0;
      return curDepth <= initialDepth && cpu.PC === returnAddr;
    });
  } else {
    await executeStepInto();
  }
}

// Step Out: Run until returning from current subroutine call (or HALT)
async function executeStepOut() {
  if (cpu.halted) {
    printConsole("Processor is halted. Reset machine to restart.");
    return;
  }

  const currentDepth = cpu.callStack ? cpu.callStack.length : 0;
  if (currentDepth > 0) {
    const targetDepth = currentDepth - 1;
    const returnAddr = cpu.callStack[cpu.callStack.length - 1];
    printConsole(
      `Stepping out from depth ${currentDepth} to ${targetDepth} (caller returns to 0x${returnAddr.toString(16).toUpperCase().padStart(2, "0")})...`
    );
    await runUntilBreakpointOrHalt(() => {
      const curDepth = cpu.callStack ? cpu.callStack.length : 0;
      return curDepth <= targetDepth;
    });
  } else {
    printConsole("Not currently in a subroutine. Running until HALT...");
    await runUntilBreakpointOrHalt();
  }
}

async function runUntilBreakpointOrHalt(stepCondition = null) {
  runLoopActive = true;
  if (btnRun) btnRun.textContent = "⏸ Pause";

  while (runLoopActive && !cpu.halted) {
    const startPC = cpu.PC;
    let cycleGuard = 0;

    do {
      await executeClockCycleStep();
      cycleGuard++;
    } while (!cpu.halted && cpu.PC === startPC && cycleGuard < 10);

    if (stepCondition && stepCondition()) {
      runLoopActive = false;
      break;
    }

    const bp = checkBreakpoint(cpu.PC);
    if (bp.hit) {
      runLoopActive = false;
      printConsole(`Execution paused: Breakpoint hit at ${bp.reason}.`);
      break;
    }

    await new Promise(r =>
      setTimeout(r, chkAnimate && chkAnimate.checked ? 80 : 30)
    );
  }

  runLoopActive = false;
  if (btnRun) btnRun.textContent = "▶ Run Machine";
  updateHardwareDashboard();
}

// --- BUTTON EVENT LISTENERS ---
if (btnStep) {
  btnStep.addEventListener("click", async () => {
    setExecutionButtonsDisabled(true);
    await executeClockCycleStep();
    if (!cpu.halted) setExecutionButtonsDisabled(false);
  });
}

if (btnStepInto) {
  btnStepInto.addEventListener("click", async () => {
    setExecutionButtonsDisabled(true);
    await executeStepInto();
    if (!cpu.halted) setExecutionButtonsDisabled(false);
  });
}

if (btnStepOver) {
  btnStepOver.addEventListener("click", async () => {
    setExecutionButtonsDisabled(true);
    await executeStepOver();
    if (!cpu.halted) setExecutionButtonsDisabled(false);
  });
}

if (btnStepOut) {
  btnStepOut.addEventListener("click", async () => {
    setExecutionButtonsDisabled(true);
    await executeStepOut();
    if (!cpu.halted) setExecutionButtonsDisabled(false);
  });
}

if (btnRun) {
  btnRun.addEventListener("click", () => {
    if (runLoopActive) {
      runLoopActive = false;
      btnRun.textContent = "▶ Run Machine";
      printConsole("Execution paused by user.");
      setExecutionButtonsDisabled(false);
    } else {
      runUntilBreakpointOrHalt();
    }
  });
}

// Keyboard shortcuts (F5, F10, F11, Shift+F11)
window.addEventListener("keydown", e => {
  // Don't intercept when user is typing in editor or inline input
  if (e.target === assemblyInput || e.target.tagName === "INPUT") {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      handleAssemble();
    }
    return;
  }

  if (e.key === "F5") {
    e.preventDefault();
    if (btnRun && !btnRun.disabled) btnRun.click();
  } else if (e.key === "F10") {
    e.preventDefault();
    if (btnStepOver && !btnStepOver.disabled) btnStepOver.click();
  } else if (e.key === "F11" && !e.shiftKey) {
    e.preventDefault();
    if (btnStepInto && !btnStepInto.disabled) btnStepInto.click();
  } else if (e.key === "F11" && e.shiftKey) {
    e.preventDefault();
    if (btnStepOut && !btnStepOut.disabled) btnStepOut.click();
  }
});

// --- RESET STATE ---
function resetHardwareState(clearRAM = true) {
  runLoopActive = false;
  isAnimating = false;
  stallPipeline = false;
  flushPipeline = false;
  temporaryBreakpoint = null;

  if (btnRun) btnRun.textContent = "▶ Run Machine";
  if (animationLayer) animationLayer.innerHTML = "";

  cpu.registers = { A: 0, B: 0, C: 0, D: 0, SP: cpu.RAM.length - 1 };
  cpu.PC = 0;
  cpu.flags = { Z: 1, C: 0, N: 0, V: 0 };
  cpu.halted = false;
  cpu.callStack = [];
  cpu.callFrames = [];
  executionTrace = [];

  if (clearRAM) cpu.RAM.fill(0);

  pipeline = {
    IF_ID: { pc: 0, opcode: null, valid: false, instrStr: "NOP" },
    ID_EX: { pc: 0, opcode: null, valid: false, instrStr: "NOP" },
    EX_MEM: { pc: 0, opcode: null, valid: false, instrStr: "NOP" },
    MEM_WB: { pc: 0, opcode: null, valid: false, instrStr: "NOP" },
  };

  updateHardwareDashboard();
}

if (btnReset) {
  btnReset.addEventListener("click", () => {
    resetHardwareState(true);
    setExecutionButtonsDisabled(true);
    printConsole("Processor reset. RAM and registers initialized.");
  });
}

if (btnTraceClear) {
  btnTraceClear.addEventListener("click", () => {
    executionTrace = [];
    renderTraceView();
    printConsole("Execution trace cleared.");
  });
}

// Initial initialization
renderInitialHardwareGrid();
renderGutter();
renderHexViewer();
renderDisassembler();
updateHardwareDashboard();

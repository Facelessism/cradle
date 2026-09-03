// --- DOM BINDING & INTERACTIVE PIPELINE RENDERING LAYER ---
const cpu = createCPUState();

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

// --- DOM BINDINGS ---
const ramGrid = document.getElementById("ram-matrix");
const consoleOutput = document.getElementById("console-output");
const btnStep = document.getElementById("btn-step");
const btnRun = document.getElementById("btn-run");
const chkAnimate = document.getElementById("chk-animate");
const animationLayer = document.getElementById("animation-layer");
const presetSelector = document.getElementById("preset-selector");
const assemblyInput = document.getElementById("assembly-input");

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
};

if (presetSelector) {
  presetSelector.addEventListener("change", e => {
    if (PRESETS[e.target.value]) {
      assemblyInput.value = PRESETS[e.target.value];
    }
  });
}

function renderInitialHardwareGrid() {
  if (!ramGrid) return;
  ramGrid.innerHTML = "";
  for (let i = 0; i < 16; i++) {
    const hexAddress = "0x" + i.toString(16).toUpperCase();
    ramGrid.innerHTML += `
            <div class="ram-cell" id="ram-cell-${i}">
                <span class="ram-addr">${hexAddress}</span>
                <span class="ram-data" id="ram-data-${i}">00</span>
            </div>
        `;
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
  setRegText("reg-flags", `Z:${cpu.flags.Z} C:${cpu.flags.C}`);

  for (let i = 0; i < 16; i++) {
    const cell = document.getElementById(`ram-cell-${i}`);
    const dataElement = document.getElementById(`ram-data-${i}`);
    if (dataElement) {
      dataElement.textContent = cpu.RAM[i]
        .toString(16)
        .toUpperCase()
        .padStart(2, "0");
    }
    if (cell) {
      if (i === cpu.PC && !cpu.halted) {
        cell.classList.add("active-pc");
      } else {
        cell.classList.remove("active-pc");
      }
    }
  }

  updatePipelineUI(
    "if",
    pipeline.IF_ID.valid ? pipeline.IF_ID.instrStr : "NOP",
    stallPipeline
  );
  updatePipelineUI(
    "id",
    pipeline.ID_EX.valid ? pipeline.ID_EX.instrStr : "NOP",
    stallPipeline && pipeline.ID_EX.valid
  );
  updatePipelineUI(
    "ex",
    pipeline.EX_MEM.valid ? pipeline.EX_MEM.instrStr : "NOP",
    false
  );
  updatePipelineUI(
    "mem",
    pipeline.MEM_WB.valid ? pipeline.MEM_WB.instrStr : "NOP",
    false
  );
  updatePipelineUI(
    "wb",
    pipeline.MEM_WB.valid ? pipeline.MEM_WB.instrStr : "NOP",
    false
  );
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

    const packet = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    packet.setAttribute("r", "6");
    packet.setAttribute("cx", start.x);
    packet.setAttribute("cy", start.y);
    packet.setAttribute("class", "data-packet");

    animationLayer.appendChild(path);
    animationLayer.appendChild(packet);

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
  return "reg-" + reg.toLowerCase();
}
function getRamElementId(addr) {
  return "ram-cell-" + addr;
}

// --- COMPILER HOOK ---
document.getElementById("btn-assemble")?.addEventListener("click", () => {
  printConsole("Initializing compilation pipeline...");

  try {
    assembleCode(assemblyInput.value, cpu.RAM);
    resetHardwareState(false);
    btnStep.disabled = false;
    btnRun.disabled = false;
    printConsole(
      "Compilation successful. Machine code map injected safely into RAM vectors."
    );
  } catch (err) {
    printConsole(err.message, true);
  }
});

async function executeClockCycleStep() {
  if (
    cpu.halted &&
    !pipeline.IF_ID.valid &&
    !pipeline.ID_EX.valid &&
    !pipeline.EX_MEM.valid &&
    !pipeline.MEM_WB.valid
  ) {
    runLoopActive = false;
    printConsole(
      "Processor execution finished (System HALT or pipeline empty)."
    );
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
    await new Promise(r => setTimeout(r, 50));
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
        animateDataFlow(
          getRegElementId(reg.destReg),
          getRegElementId(reg.destReg)
        )
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
        animateDataFlow(
          getRamElementId(exReg.aluResult),
          getRamElementId(exReg.aluResult)
        )
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
      case OPCODES.ADD:
        exReg.aluResult = fwdVal1 + fwdVal2;
        cpu.flags.C = exReg.aluResult > 255 ? 1 : 0;
        exReg.aluResult = exReg.aluResult & 0xff;
        cpu.flags.Z = exReg.aluResult === 0 ? 1 : 0;
        animations.push(
          animateDataFlow(
            getRegElementId(idReg.srcReg1),
            getRegElementId(idReg.destReg)
          )
        );
        break;
      case OPCODES.SUB:
        exReg.aluResult = fwdVal1 - fwdVal2;
        cpu.flags.C = exReg.aluResult < 0 ? 1 : 0;
        exReg.aluResult =
          (exReg.aluResult < 0 ? exReg.aluResult + 256 : exReg.aluResult) &
          0xff;
        cpu.flags.Z = exReg.aluResult === 0 ? 1 : 0;
        animations.push(
          animateDataFlow(
            getRegElementId(idReg.srcReg1),
            getRegElementId(idReg.destReg)
          )
        );
        break;
      case OPCODES.CMP:
        exReg.aluResult = fwdVal1 - fwdVal2;
        cpu.flags.C = exReg.aluResult < 0 ? 1 : 0;
        const temp =
          (exReg.aluResult < 0 ? exReg.aluResult + 256 : exReg.aluResult) &
          0xff;
        cpu.flags.Z = temp === 0 ? 1 : 0;
        break;
      case OPCODES.AND:
        exReg.aluResult = fwdVal1 & fwdVal2 & 0xff;
        cpu.flags.Z = exReg.aluResult === 0 ? 1 : 0;
        cpu.flags.C = 0;
        break;
      case OPCODES.OR:
        exReg.aluResult = (fwdVal1 | fwdVal2) & 0xff;
        cpu.flags.Z = exReg.aluResult === 0 ? 1 : 0;
        cpu.flags.C = 0;
        break;
      case OPCODES.XOR:
        exReg.aluResult = (fwdVal1 ^ fwdVal2) & 0xff;
        cpu.flags.Z = exReg.aluResult === 0 ? 1 : 0;
        cpu.flags.C = 0;
        break;
      case OPCODES.NOT:
        exReg.aluResult = ~fwdVal1 & 0xff;
        cpu.flags.Z = exReg.aluResult === 0 ? 1 : 0;
        break;
      case OPCODES.INC:
        exReg.aluResult = fwdVal1 + 1;
        cpu.flags.C = exReg.aluResult > 255 ? 1 : 0;
        exReg.aluResult = exReg.aluResult & 0xff;
        cpu.flags.Z = exReg.aluResult === 0 ? 1 : 0;
        break;
      case OPCODES.DEC:
        exReg.aluResult = fwdVal1 - 1;
        cpu.flags.C = exReg.aluResult < 0 ? 1 : 0;
        exReg.aluResult = (exReg.aluResult < 0 ? 255 : exReg.aluResult) & 0xff;
        cpu.flags.Z = exReg.aluResult === 0 ? 1 : 0;
        break;
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
      case OPCODES.JMP:
      case OPCODES.JNZ:
      case OPCODES.JZ:
        idReg.branch = true;
        idReg.addr = ifReg.byte1;
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

  if (cpu.PC >= 16) {
    pipeline.IF_ID = { valid: false, instrStr: "NOP" };
    return;
  }

  let opcode = cpu.RAM[cpu.PC];
  let len = getInstructionLength(opcode);

  if (cpu.PC + len > 16) {
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
      opcode === OPCODES.JZ
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

btnStep?.addEventListener("click", async () => {
  if (btnStep) btnStep.disabled = true;
  if (btnRun) btnRun.disabled = true;
  await executeClockCycleStep();
  if (!cpu.halted) {
    if (btnStep) btnStep.disabled = false;
    if (btnRun) btnRun.disabled = false;
  }
});

async function executionLoop() {
  while (runLoopActive && !cpu.halted) {
    await executeClockCycleStep();
    await new Promise(r =>
      setTimeout(r, chkAnimate && chkAnimate.checked ? 100 : 50)
    );
  }
  if (btnStep) btnStep.disabled = cpu.halted;
  if (btnRun) btnRun.disabled = cpu.halted;
}

btnRun?.addEventListener("click", () => {
  if (runLoopActive) return;
  runLoopActive = true;
  if (btnRun) btnRun.disabled = true;
  if (btnStep) btnStep.disabled = true;
  printConsole("Pipeline execution loop running...");
  executionLoop();
});

function resetHardwareState(clearRAM = true) {
  runLoopActive = false;
  isAnimating = false;
  stallPipeline = false;
  flushPipeline = false;
  if (animationLayer) animationLayer.innerHTML = "";
  cpu.registers = { A: 0, B: 0, C: 0, D: 0 };
  cpu.PC = 0;
  cpu.flags = { Z: 1, C: 0 };
  cpu.halted = false;
  if (clearRAM) cpu.RAM.fill(0);

  pipeline = {
    IF_ID: { pc: 0, opcode: null, valid: false, instrStr: "NOP" },
    ID_EX: { pc: 0, opcode: null, valid: false, instrStr: "NOP" },
    EX_MEM: { pc: 0, opcode: null, valid: false, instrStr: "NOP" },
    MEM_WB: { pc: 0, opcode: null, valid: false, instrStr: "NOP" },
  };

  updateHardwareDashboard();
}

document.getElementById("btn-reset")?.addEventListener("click", () => {
  resetHardwareState(true);
  if (btnStep) btnStep.disabled = true;
  if (btnRun) btnRun.disabled = true;
  printConsole("Pipeline state flushed. RAM cleared.");
});

renderInitialHardwareGrid();
updateHardwareDashboard();

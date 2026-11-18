// --- HARDWARE COMPONENT REPRESENTATION & EMULATOR CORE ---
const OPCODES = {
  HALT: 0x00,
  MOV_LIT: 0x01,
  ADD: 0x02,
  SUB: 0x03,
  JMP: 0x04,
  MOV_REG: 0x05, // MOV Reg, Reg
  MOV_MEM_R: 0x06, // MOV Reg, [Addr]
  MOV_R_MEM: 0x07, // MOV [Addr], Reg
  JNZ: 0x08, // Jump if Not Zero
  AND: 0x09, // Bitwise AND
  OR: 0x0a, // Bitwise OR
  XOR: 0x0b, // Bitwise XOR
  NOT: 0x0c, // Bitwise NOT
  INC: 0x0d, // Increment Register
  DEC: 0x0e, // Decrement Register
  JZ: 0x0f, // Jump if Zero
  CMP: 0x10, // Compare Registers
  PUSH: 0x11, // Push Register onto Stack
  POP: 0x12, // Pop Stack into Register
  CALL: 0x13, // Call Subroutine
  RET: 0x14, // Return from Subroutine
};

function createCPUState(ramSize = 16) {
  const size = Math.max(16, ramSize || 16);
  return {
    registers: { A: 0, B: 0, C: 0, D: 0, SP: size - 1 },
    PC: 0,
    flags: { Z: 1, C: 0, N: 0, V: 0 },
    RAM: new Uint8Array(size),
    halted: false,
    callStack: [],
  };
}

function getOpcodeMnemonic(opcode) {
  for (const key in OPCODES) {
    if (OPCODES[key] === opcode) return key;
  }
  return "UNKNOWN";
}

function getInstructionLength(opcode) {
  if (opcode === OPCODES.HALT || opcode === OPCODES.RET) return 1;
  if (
    opcode === OPCODES.NOT ||
    opcode === OPCODES.INC ||
    opcode === OPCODES.DEC ||
    opcode === OPCODES.PUSH ||
    opcode === OPCODES.POP ||
    opcode === OPCODES.JMP ||
    opcode === OPCODES.JNZ ||
    opcode === OPCODES.JZ ||
    opcode === OPCODES.CALL
  )
    return 2;
  return 3; // Default for 3-byte instructions like MOV, ADD, SUB, AND, OR, XOR, CMP
}

function updateALUFlags(cpuState, result, op1, op2, opType) {
  const res8 = result & 0xff;
  cpuState.flags.Z = res8 === 0 ? 1 : 0;
  cpuState.flags.N = (res8 & 0x80) !== 0 ? 1 : 0;

  if (opType === "ADD") {
    cpuState.flags.C = result > 255 ? 1 : 0;
    // Overflow when operands have same sign and result has different sign
    cpuState.flags.V = (~(op1 ^ op2) & (op1 ^ res8) & 0x80) !== 0 ? 1 : 0;
  } else if (opType === "SUB" || opType === "CMP") {
    cpuState.flags.C = op1 < op2 ? 1 : 0;
    // Overflow when operands have different signs and result has different sign than op1
    cpuState.flags.V = ((op1 ^ op2) & (op1 ^ res8) & 0x80) !== 0 ? 1 : 0;
  } else if (opType === "INC") {
    cpuState.flags.C = op1 === 255 ? 1 : 0;
    cpuState.flags.V = op1 === 0x7f ? 1 : 0; // 127 + 1 = 128 (-128) in 8-bit signed
  } else if (opType === "DEC") {
    cpuState.flags.C = op1 === 0 ? 1 : 0;
    cpuState.flags.V = op1 === 0x80 ? 1 : 0; // -128 - 1 = 127 in 8-bit signed
  } else if (["AND", "OR", "XOR", "NOT"].includes(opType)) {
    cpuState.flags.C = 0;
    cpuState.flags.V = 0;
  }
}

function executeSingleInstruction(cpuState, opcode, byte1, byte2) {
  if (cpuState.halted) return;

  const destRegStr = byte1 ? String.fromCharCode(byte1) : null;
  const srcRegStr = byte2 ? String.fromCharCode(byte2) : null;
  const ramSize = cpuState.RAM.length;

  switch (opcode) {
    case OPCODES.HALT:
      cpuState.halted = true;
      break;

    case OPCODES.MOV_LIT:
      if (destRegStr && cpuState.registers.hasOwnProperty(destRegStr)) {
        cpuState.registers[destRegStr] = byte2 & 0xff;
      }
      break;

    case OPCODES.MOV_REG:
      if (
        destRegStr &&
        srcRegStr &&
        cpuState.registers.hasOwnProperty(destRegStr) &&
        cpuState.registers.hasOwnProperty(srcRegStr)
      ) {
        cpuState.registers[destRegStr] = cpuState.registers[srcRegStr];
      }
      break;

    case OPCODES.MOV_MEM_R:
      if (destRegStr && cpuState.registers.hasOwnProperty(destRegStr)) {
        const addr = byte2 & (ramSize - 1);
        cpuState.registers[destRegStr] = cpuState.RAM[addr];
      }
      break;

    case OPCODES.MOV_R_MEM:
      if (srcRegStr && cpuState.registers.hasOwnProperty(srcRegStr)) {
        const addr = byte1 & (ramSize - 1);
        cpuState.RAM[addr] = cpuState.registers[srcRegStr];
      }
      break;

    case OPCODES.ADD:
      if (destRegStr && srcRegStr) {
        const r1 = cpuState.registers[destRegStr];
        const r2 = cpuState.registers[srcRegStr];
        const sum = r1 + r2;
        updateALUFlags(cpuState, sum, r1, r2, "ADD");
        cpuState.registers[destRegStr] = sum & 0xff;
      }
      break;

    case OPCODES.SUB:
      if (destRegStr && srcRegStr) {
        const r1 = cpuState.registers[destRegStr];
        const r2 = cpuState.registers[srcRegStr];
        const diff = r1 - r2;
        updateALUFlags(cpuState, diff, r1, r2, "SUB");
        cpuState.registers[destRegStr] = (diff < 0 ? diff + 256 : diff) & 0xff;
      }
      break;

    case OPCODES.AND:
      if (destRegStr && srcRegStr) {
        const res = cpuState.registers[destRegStr] & cpuState.registers[srcRegStr];
        updateALUFlags(cpuState, res, cpuState.registers[destRegStr], cpuState.registers[srcRegStr], "AND");
        cpuState.registers[destRegStr] = res & 0xff;
      }
      break;

    case OPCODES.OR:
      if (destRegStr && srcRegStr) {
        const res = cpuState.registers[destRegStr] | cpuState.registers[srcRegStr];
        updateALUFlags(cpuState, res, cpuState.registers[destRegStr], cpuState.registers[srcRegStr], "OR");
        cpuState.registers[destRegStr] = res & 0xff;
      }
      break;

    case OPCODES.XOR:
      if (destRegStr && srcRegStr) {
        const res = cpuState.registers[destRegStr] ^ cpuState.registers[srcRegStr];
        updateALUFlags(cpuState, res, cpuState.registers[destRegStr], cpuState.registers[srcRegStr], "XOR");
        cpuState.registers[destRegStr] = res & 0xff;
      }
      break;

    case OPCODES.NOT:
      if (destRegStr && cpuState.registers.hasOwnProperty(destRegStr)) {
        const res = ~cpuState.registers[destRegStr] & 0xff;
        updateALUFlags(cpuState, res, cpuState.registers[destRegStr], null, "NOT");
        cpuState.registers[destRegStr] = res;
      }
      break;

    case OPCODES.INC:
      if (destRegStr && cpuState.registers.hasOwnProperty(destRegStr)) {
        const val = cpuState.registers[destRegStr];
        updateALUFlags(cpuState, val + 1, val, null, "INC");
        cpuState.registers[destRegStr] = (val + 1) & 0xff;
      }
      break;

    case OPCODES.DEC:
      if (destRegStr && cpuState.registers.hasOwnProperty(destRegStr)) {
        const val = cpuState.registers[destRegStr];
        updateALUFlags(cpuState, val - 1, val, null, "DEC");
        cpuState.registers[destRegStr] = (val - 1 < 0 ? 255 : val - 1) & 0xff;
      }
      break;

    case OPCODES.JMP:
      cpuState.PC = byte1 & (ramSize - 1);
      return; // Skip PC auto increment

    case OPCODES.JNZ:
      if (cpuState.flags.Z === 0) {
        cpuState.PC = byte1 & (ramSize - 1);
        return;
      }
      break;

    case OPCODES.JZ:
      if (cpuState.flags.Z === 1) {
        cpuState.PC = byte1 & (ramSize - 1);
        return;
      }
      break;

    case OPCODES.CMP:
      if (destRegStr && srcRegStr) {
        const r1 = cpuState.registers[destRegStr];
        const r2 = cpuState.registers[srcRegStr];
        const diff = r1 - r2;
        updateALUFlags(cpuState, diff, r1, r2, "CMP");
      }
      break;

    case OPCODES.PUSH:
      if (destRegStr && cpuState.registers.hasOwnProperty(destRegStr)) {
        cpuState.registers.SP = (cpuState.registers.SP - 1 + ramSize) % ramSize;
        cpuState.RAM[cpuState.registers.SP] = cpuState.registers[destRegStr];
      }
      break;

    case OPCODES.POP:
      if (destRegStr && cpuState.registers.hasOwnProperty(destRegStr)) {
        cpuState.registers[destRegStr] = cpuState.RAM[cpuState.registers.SP];
        cpuState.registers.SP = (cpuState.registers.SP + 1) % ramSize;
      }
      break;

    case OPCODES.CALL: {
      const returnAddr = (cpuState.PC + 2) & (ramSize - 1);
      cpuState.registers.SP = (cpuState.registers.SP - 1 + ramSize) % ramSize;
      cpuState.RAM[cpuState.registers.SP] = returnAddr;
      if (!cpuState.callStack) cpuState.callStack = [];
      cpuState.callStack.push(returnAddr);
      cpuState.PC = byte1 & (ramSize - 1);
      return;
    }

    case OPCODES.RET: {
      const retAddr = cpuState.RAM[cpuState.registers.SP];
      cpuState.registers.SP = (cpuState.registers.SP + 1) % ramSize;
      if (cpuState.callStack && cpuState.callStack.length > 0) {
        cpuState.callStack.pop();
      }
      cpuState.PC = retAddr & (ramSize - 1);
      return;
    }
  }

  const len = getInstructionLength(opcode);
  cpuState.PC += len;
}

function disassembleInstruction(ram, pc) {
  if (!ram || pc < 0 || pc >= ram.length) return null;

  const opcode = ram[pc];
  const mnemonic = getOpcodeMnemonic(opcode);

  if (mnemonic === "UNKNOWN") {
    const hex = opcode.toString(16).toUpperCase().padStart(2, "0");
    return {
      address: pc,
      opcode: opcode,
      bytes: [opcode],
      hexBytes: hex,
      mnemonic: "DB",
      operands: `0x${hex}`,
      instruction: `DB 0x${hex}`,
      length: 1,
      isCall: false,
      isRet: false,
      isBranch: false,
    };
  }

  const len = getInstructionLength(opcode);
  if (pc + len > ram.length) {
    const hex = opcode.toString(16).toUpperCase().padStart(2, "0");
    return {
      address: pc,
      opcode: opcode,
      bytes: [opcode],
      hexBytes: hex,
      mnemonic: "DB",
      operands: `0x${hex}`,
      instruction: `DB 0x${hex}`,
      length: 1,
      isCall: false,
      isRet: false,
      isBranch: false,
    };
  }

  const bytes = Array.from(ram.slice(pc, pc + len));
  const hexBytes = bytes
    .map(b => b.toString(16).toUpperCase().padStart(2, "0"))
    .join(" ");

  let operands = "";
  const byte1 = len > 1 ? ram[pc + 1] : null;
  const byte2 = len > 2 ? ram[pc + 2] : null;

  switch (opcode) {
    case OPCODES.HALT:
    case OPCODES.RET:
      operands = "";
      break;

    case OPCODES.MOV_LIT: {
      const dest = byte1 ? String.fromCharCode(byte1) : "?";
      operands = `${dest}, ${byte2 !== null ? byte2 : "?"}`;
      break;
    }

    case OPCODES.MOV_REG: {
      const dest = byte1 ? String.fromCharCode(byte1) : "?";
      const src = byte2 ? String.fromCharCode(byte2) : "?";
      operands = `${dest}, ${src}`;
      break;
    }

    case OPCODES.MOV_MEM_R: {
      const dest = byte1 ? String.fromCharCode(byte1) : "?";
      operands = `${dest}, [${byte2 !== null ? byte2 : "?"}]`;
      break;
    }

    case OPCODES.MOV_R_MEM: {
      const src = byte2 ? String.fromCharCode(byte2) : "?";
      operands = `[${byte1 !== null ? byte1 : "?"}], ${src}`;
      break;
    }

    case OPCODES.ADD:
    case OPCODES.SUB:
    case OPCODES.AND:
    case OPCODES.OR:
    case OPCODES.XOR:
    case OPCODES.CMP: {
      const dest = byte1 ? String.fromCharCode(byte1) : "?";
      const src = byte2 ? String.fromCharCode(byte2) : "?";
      operands = `${dest}, ${src}`;
      break;
    }

    case OPCODES.NOT:
    case OPCODES.INC:
    case OPCODES.DEC:
    case OPCODES.PUSH:
    case OPCODES.POP: {
      const dest = byte1 ? String.fromCharCode(byte1) : "?";
      operands = dest;
      break;
    }

    case OPCODES.JMP:
    case OPCODES.JNZ:
    case OPCODES.JZ:
    case OPCODES.CALL: {
      operands = byte1 !== null ? byte1.toString() : "?";
      break;
    }
  }

  return {
    address: pc,
    opcode: opcode,
    bytes: bytes,
    hexBytes: hexBytes,
    mnemonic: mnemonic,
    operands: operands,
    instruction: operands ? `${mnemonic} ${operands}` : mnemonic,
    length: len,
    isCall: opcode === OPCODES.CALL,
    isRet: opcode === OPCODES.RET,
    isBranch: [OPCODES.JMP, OPCODES.JNZ, OPCODES.JZ, OPCODES.CALL].includes(opcode),
  };
}

function disassembleMemory(ram, start = 0, length = null) {
  if (!ram) return [];
  const maxLen = length !== null ? Math.min(ram.length, start + length) : ram.length;
  const result = [];
  let ptr = start;

  while (ptr < maxLen) {
    const disasm = disassembleInstruction(ram, ptr);
    if (!disasm) break;
    result.push(disasm);
    ptr += Math.max(1, disasm.length);
  }

  return result;
}

if (typeof window !== "undefined") {
  window.OPCODES = OPCODES;
  window.createCPUState = createCPUState;
  window.getOpcodeMnemonic = getOpcodeMnemonic;
  window.getInstructionLength = getInstructionLength;
  window.executeSingleInstruction = executeSingleInstruction;
  window.updateALUFlags = updateALUFlags;
  window.disassembleInstruction = disassembleInstruction;
  window.disassembleMemory = disassembleMemory;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    OPCODES,
    createCPUState,
    getOpcodeMnemonic,
    getInstructionLength,
    executeSingleInstruction,
    updateALUFlags,
    disassembleInstruction,
    disassembleMemory,
  };
}

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
};

function createCPUState() {
  return {
    registers: { A: 0, B: 0, C: 0, D: 0 },
    PC: 0,
    flags: { Z: 1, C: 0 },
    RAM: new Uint8Array(16),
    halted: false,
  };
}

function getOpcodeMnemonic(opcode) {
  for (const key in OPCODES) {
    if (OPCODES[key] === opcode) return key;
  }
  return "UNKNOWN";
}

function getInstructionLength(opcode) {
  if (opcode === OPCODES.HALT) return 1;
  if (
    opcode === OPCODES.NOT ||
    opcode === OPCODES.INC ||
    opcode === OPCODES.DEC
  )
    return 2;
  if (opcode === OPCODES.JMP || opcode === OPCODES.JNZ || opcode === OPCODES.JZ)
    return 2;
  return 3; // Default for 3-byte instructions like MOV, ADD, SUB, AND, OR, XOR
}

function executeSingleInstruction(cpuState, opcode, byte1, byte2) {
  if (cpuState.halted) return;

  let destRegStr = byte1 ? String.fromCharCode(byte1) : null;
  let srcRegStr = byte2 ? String.fromCharCode(byte2) : null;

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
        const addr = byte2 & 0x0f;
        cpuState.registers[destRegStr] = cpuState.RAM[addr];
      }
      break;
    case OPCODES.MOV_R_MEM:
      if (srcRegStr && cpuState.registers.hasOwnProperty(srcRegStr)) {
        const addr = byte1 & 0x0f;
        cpuState.RAM[addr] = cpuState.registers[srcRegStr];
      }
      break;
    case OPCODES.ADD:
      if (destRegStr && srcRegStr) {
        const sum =
          cpuState.registers[destRegStr] + cpuState.registers[srcRegStr];
        cpuState.flags.C = sum > 255 ? 1 : 0;
        cpuState.registers[destRegStr] = sum & 0xff;
        cpuState.flags.Z = cpuState.registers[destRegStr] === 0 ? 1 : 0;
      }
      break;
    case OPCODES.SUB:
      if (destRegStr && srcRegStr) {
        const diff =
          cpuState.registers[destRegStr] - cpuState.registers[srcRegStr];
        cpuState.flags.C = diff < 0 ? 1 : 0;
        cpuState.registers[destRegStr] = (diff < 0 ? diff + 256 : diff) & 0xff;
        cpuState.flags.Z = cpuState.registers[destRegStr] === 0 ? 1 : 0;
      }
      break;
    case OPCODES.AND:
      if (destRegStr && srcRegStr) {
        cpuState.registers[destRegStr] =
          cpuState.registers[destRegStr] & cpuState.registers[srcRegStr] & 0xff;
        cpuState.flags.Z = cpuState.registers[destRegStr] === 0 ? 1 : 0;
        cpuState.flags.C = 0;
      }
      break;
    case OPCODES.OR:
      if (destRegStr && srcRegStr) {
        cpuState.registers[destRegStr] =
          (cpuState.registers[destRegStr] | cpuState.registers[srcRegStr]) &
          0xff;
        cpuState.flags.Z = cpuState.registers[destRegStr] === 0 ? 1 : 0;
        cpuState.flags.C = 0;
      }
      break;
    case OPCODES.XOR:
      if (destRegStr && srcRegStr) {
        cpuState.registers[destRegStr] =
          (cpuState.registers[destRegStr] ^ cpuState.registers[srcRegStr]) &
          0xff;
        cpuState.flags.Z = cpuState.registers[destRegStr] === 0 ? 1 : 0;
        cpuState.flags.C = 0;
      }
      break;
    case OPCODES.NOT:
      if (destRegStr && cpuState.registers.hasOwnProperty(destRegStr)) {
        cpuState.registers[destRegStr] = ~cpuState.registers[destRegStr] & 0xff;
        cpuState.flags.Z = cpuState.registers[destRegStr] === 0 ? 1 : 0;
      }
      break;
    case OPCODES.INC:
      if (destRegStr && cpuState.registers.hasOwnProperty(destRegStr)) {
        const val = cpuState.registers[destRegStr] + 1;
        cpuState.flags.C = val > 255 ? 1 : 0;
        cpuState.registers[destRegStr] = val & 0xff;
        cpuState.flags.Z = cpuState.registers[destRegStr] === 0 ? 1 : 0;
      }
      break;
    case OPCODES.DEC:
      if (destRegStr && cpuState.registers.hasOwnProperty(destRegStr)) {
        const val = cpuState.registers[destRegStr] - 1;
        cpuState.flags.C = val < 0 ? 1 : 0;
        cpuState.registers[destRegStr] = (val < 0 ? 255 : val) & 0xff;
        cpuState.flags.Z = cpuState.registers[destRegStr] === 0 ? 1 : 0;
      }
      break;
    case OPCODES.JMP:
      cpuState.PC = byte1 & 0x0f;
      return; // Skip PC auto increment
    case OPCODES.JNZ:
      if (cpuState.flags.Z === 0) {
        cpuState.PC = byte1 & 0x0f;
        return;
      }
      break;
    case OPCODES.JZ:
      if (cpuState.flags.Z === 1) {
        cpuState.PC = byte1 & 0x0f;
        return;
      }
      break;
    case OPCODES.CMP:
      if (destRegStr && srcRegStr) {
        const diff =
          cpuState.registers[destRegStr] - cpuState.registers[srcRegStr];
        cpuState.flags.C = diff < 0 ? 1 : 0;
        const temp = (diff < 0 ? diff + 256 : diff) & 0xff;
        cpuState.flags.Z = temp === 0 ? 1 : 0;
      }
      break;
  }

  const len = getInstructionLength(opcode);
  cpuState.PC += len;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    OPCODES,
    createCPUState,
    getOpcodeMnemonic,
    getInstructionLength,
    executeSingleInstruction,
  };
}

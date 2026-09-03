// --- CPU ASSEMBLY COMPILER & PARSER MODULE ---
const { OPCODES } =
  typeof require !== "undefined" ? require("./emulatorCore") : window;

function assembleCode(sourceCode, ramTarget) {
  const rawLines = sourceCode.split("\n");
  ramTarget.fill(0);

  let memoryWritePtr = 0;
  const VALID_REGS = ["A", "B", "C", "D"];

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const cleanLine = rawLines[i].split(";")[0].trim();
    if (!cleanLine) continue;

    if (memoryWritePtr >= 16) {
      throw new Error(`Line ${lineNum}: Out of 16-byte RAM memory limits.`);
    }

    const parts = cleanLine.replace(/,/g, " ").split(/\s+/);
    const operation = parts[0].toUpperCase();

    if (operation === "HALT") {
      ramTarget[memoryWritePtr++] = OPCODES.HALT;
    } else if (operation === "MOV") {
      if (parts.length < 3)
        throw new Error(
          `Line ${lineNum}: MOV requires target and source operands.`
        );
      const target = parts[1].toUpperCase();
      const source = parts[2].toUpperCase();

      const isTargetMem = target.startsWith("[") && target.endsWith("]");
      const isSourceMem = source.startsWith("[") && source.endsWith("]");

      if (isTargetMem && isSourceMem)
        throw new Error(`Line ${lineNum}: Memory-to-Memory MOV not supported.`);

      if (isTargetMem) {
        const addr = parseInt(target.replace(/\[|\]/g, ""));
        if (
          !VALID_REGS.includes(source) ||
          isNaN(addr) ||
          addr < 0 ||
          addr > 15
        ) {
          throw new Error(`Line ${lineNum}: Invalid memory write MOV syntax.`);
        }
        ramTarget[memoryWritePtr++] = OPCODES.MOV_R_MEM;
        ramTarget[memoryWritePtr++] = addr & 0xff;
        ramTarget[memoryWritePtr++] = source.charCodeAt(0);
      } else if (isSourceMem) {
        const addr = parseInt(source.replace(/\[|\]/g, ""));
        if (
          !VALID_REGS.includes(target) ||
          isNaN(addr) ||
          addr < 0 ||
          addr > 15
        ) {
          throw new Error(`Line ${lineNum}: Invalid memory read MOV syntax.`);
        }
        ramTarget[memoryWritePtr++] = OPCODES.MOV_MEM_R;
        ramTarget[memoryWritePtr++] = target.charCodeAt(0);
        ramTarget[memoryWritePtr++] = addr & 0xff;
      } else if (VALID_REGS.includes(source)) {
        if (!VALID_REGS.includes(target))
          throw new Error(`Line ${lineNum}: Invalid register MOV target.`);
        ramTarget[memoryWritePtr++] = OPCODES.MOV_REG;
        ramTarget[memoryWritePtr++] = target.charCodeAt(0);
        ramTarget[memoryWritePtr++] = source.charCodeAt(0);
      } else {
        const val = parseInt(source);
        if (!VALID_REGS.includes(target) || isNaN(val))
          throw new Error(`Line ${lineNum}: Invalid immediate MOV operand.`);
        ramTarget[memoryWritePtr++] = OPCODES.MOV_LIT;
        ramTarget[memoryWritePtr++] = target.charCodeAt(0);
        ramTarget[memoryWritePtr++] = val & 0xff;
      }
    } else if (["ADD", "SUB", "AND", "OR", "XOR", "CMP"].includes(operation)) {
      if (parts.length < 3)
        throw new Error(
          `Line ${lineNum}: ${operation} requires 2 register operands.`
        );
      const regDest = parts[1].toUpperCase();
      const regSrc = parts[2].toUpperCase();
      if (!VALID_REGS.includes(regDest) || !VALID_REGS.includes(regSrc)) {
        throw new Error(`Line ${lineNum}: Invalid registers for ${operation}.`);
      }
      ramTarget[memoryWritePtr++] = OPCODES[operation];
      ramTarget[memoryWritePtr++] = regDest.charCodeAt(0);
      ramTarget[memoryWritePtr++] = regSrc.charCodeAt(0);
    } else if (["NOT", "INC", "DEC"].includes(operation)) {
      if (parts.length < 2)
        throw new Error(
          `Line ${lineNum}: ${operation} requires 1 register operand.`
        );
      const regDest = parts[1].toUpperCase();
      if (!VALID_REGS.includes(regDest))
        throw new Error(`Line ${lineNum}: Invalid register for ${operation}.`);
      ramTarget[memoryWritePtr++] = OPCODES[operation];
      ramTarget[memoryWritePtr++] = regDest.charCodeAt(0);
    } else if (
      operation === "JMP" ||
      operation === "JNZ" ||
      operation === "JZ"
    ) {
      if (parts.length < 2)
        throw new Error(
          `Line ${lineNum}: ${operation} requires a target address.`
        );
      const targetAddr = parseInt(parts[1]);
      if (isNaN(targetAddr) || targetAddr < 0 || targetAddr > 15) {
        throw new Error(`Line ${lineNum}: Invalid jump target address.`);
      }
      ramTarget[memoryWritePtr++] = OPCODES[operation];
      ramTarget[memoryWritePtr++] = targetAddr & 0xff;
    } else {
      throw new Error(`Line ${lineNum}: Unknown mnemonic "${operation}".`);
    }
  }

  return memoryWritePtr;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { assembleCode };
}

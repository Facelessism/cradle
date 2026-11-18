const test = require("node:test");
const assert = require("node:assert/strict");
const {
  OPCODES,
  createCPUState,
  executeSingleInstruction,
  updateALUFlags,
  disassembleInstruction,
  disassembleMemory,
} = require("../projects/dev-tools/cpu-emulator/emulatorCore");
const {
  assembleCode,
  assembleWithSourceMap,
} = require("../projects/dev-tools/cpu-emulator/assembler");

test("CPU state initialization defaults to correct values", () => {
  const cpu = createCPUState();
  assert.equal(cpu.registers.A, 0);
  assert.equal(cpu.registers.B, 0);
  assert.equal(cpu.PC, 0);
  assert.equal(cpu.flags.Z, 1);
  assert.equal(cpu.flags.C, 0);
  assert.equal(cpu.flags.N, 0);
  assert.equal(cpu.flags.V, 0);
  assert.equal(cpu.registers.SP, 15);
  assert.equal(cpu.RAM.length, 16);
  assert.equal(cpu.halted, false);
});

test("assembler compiles basic MOV and ADD instructions correctly", () => {
  const ram = new Uint8Array(16);
  const code = `
        MOV A, 10
        MOV B, 5
        ADD A, B
        HALT
    `;
  const bytesWritten = assembleCode(code, ram);
  assert.equal(ram[0], OPCODES.MOV_LIT);
  assert.equal(ram[1], "A".charCodeAt(0));
  assert.equal(ram[2], 10);
  assert.equal(ram[3], OPCODES.MOV_LIT);
  assert.equal(ram[4], "B".charCodeAt(0));
  assert.equal(ram[5], 5);
  assert.equal(ram[6], OPCODES.ADD);
  assert.equal(ram[7], "A".charCodeAt(0));
  assert.equal(ram[8], "B".charCodeAt(0));
  assert.equal(ram[9], OPCODES.HALT);
  assert.equal(bytesWritten, 10);
});

test("assembler handles bitwise and unary instructions AND, OR, XOR, NOT, INC, DEC", () => {
  const ram = new Uint8Array(16);
  const code = `
        MOV A, 12
        AND A, B
        NOT A
        INC B
        HALT
    `;
  const bytesWritten = assembleCode(code, ram);
  assert.ok(bytesWritten > 0);
  assert.ok(bytesWritten <= 16);
  assert.equal(ram[0], OPCODES.MOV_LIT);
});

test("assembler handles PUSH, POP, CALL, and RET instructions", () => {
  const ram = new Uint8Array(16);
  const code = `
        PUSH A
        CALL 6
        POP B
        RET
        HALT
    `;
  const bytesWritten = assembleCode(code, ram);
  assert.equal(ram[0], OPCODES.PUSH);
  assert.equal(ram[1], "A".charCodeAt(0));
  assert.equal(ram[2], OPCODES.CALL);
  assert.equal(ram[3], 6);
  assert.equal(ram[4], OPCODES.POP);
  assert.equal(ram[5], "B".charCodeAt(0));
  assert.equal(ram[6], OPCODES.RET);
  assert.equal(ram[7], OPCODES.HALT);
  assert.equal(bytesWritten, 8);
});

test("assembleWithSourceMap generates accurate bidirectional line mappings", () => {
  const ram = new Uint8Array(16);
  const code = `MOV A, 5\nMOV B, 3\nADD A, B`;
  const { bytesWritten, sourceMap } = assembleWithSourceMap(code, ram);
  assert.equal(bytesWritten, 9);
  assert.equal(sourceMap.lineToAddress.get(1), 0);
  assert.equal(sourceMap.lineToAddress.get(2), 3);
  assert.equal(sourceMap.lineToAddress.get(3), 6);
  assert.equal(sourceMap.addressToLine.get(0), 1);
  assert.equal(sourceMap.addressToLine.get(3), 2);
  assert.equal(sourceMap.addressToLine.get(6), 3);
});

test("executes bitwise operations correctly and updates flags", () => {
  const cpu = createCPUState();
  cpu.registers.A = 0b1100;
  cpu.registers.B = 0b1010;

  // Execute AND A, B
  executeSingleInstruction(
    cpu,
    OPCODES.AND,
    "A".charCodeAt(0),
    "B".charCodeAt(0)
  );
  assert.equal(cpu.registers.A, 0b1000);
  assert.equal(cpu.flags.Z, 0);

  // Execute XOR A, B (0b1000 ^ 0b1010 = 0b0010)
  executeSingleInstruction(
    cpu,
    OPCODES.XOR,
    "A".charCodeAt(0),
    "B".charCodeAt(0)
  );
  assert.equal(cpu.registers.A, 0b0010);
});

test("executes INC and DEC and checks flags", () => {
  const cpu = createCPUState();
  cpu.registers.C = 255;

  // INC C should overflow to 0 and set carry flag
  executeSingleInstruction(cpu, OPCODES.INC, "C".charCodeAt(0), null);
  assert.equal(cpu.registers.C, 0);
  assert.equal(cpu.flags.Z, 1);
  assert.equal(cpu.flags.C, 1);

  // DEC C should underflow to 255 and set carry flag
  executeSingleInstruction(cpu, OPCODES.DEC, "C".charCodeAt(0), null);
  assert.equal(cpu.registers.C, 255);
  assert.equal(cpu.flags.Z, 0);
  assert.equal(cpu.flags.C, 1);
});

test("calculates Negative (N) and Overflow (V) flags accurately", () => {
  const cpu = createCPUState();

  // 127 + 1 = 128 (0x80) -> Signed overflow in 8-bit two's complement: positive + positive = negative
  cpu.registers.A = 127;
  cpu.registers.B = 1;
  executeSingleInstruction(cpu, OPCODES.ADD, "A".charCodeAt(0), "B".charCodeAt(0));
  assert.equal(cpu.registers.A, 128);
  assert.equal(cpu.flags.N, 1);
  assert.equal(cpu.flags.V, 1);
  assert.equal(cpu.flags.Z, 0);
  assert.equal(cpu.flags.C, 0);

  // 128 - 1 = 127 (0x7F) -> Clears negative and overflow
  executeSingleInstruction(cpu, OPCODES.SUB, "A".charCodeAt(0), "B".charCodeAt(0));
  assert.equal(cpu.registers.A, 127);
  assert.equal(cpu.flags.N, 0);
  assert.equal(cpu.flags.V, 0);

  // Subtraction resulting in negative signed value: 5 - 10 = -5 (251 / 0xFB)
  cpu.registers.A = 5;
  cpu.registers.B = 10;
  executeSingleInstruction(cpu, OPCODES.SUB, "A".charCodeAt(0), "B".charCodeAt(0));
  assert.equal(cpu.registers.A, 251);
  assert.equal(cpu.flags.N, 1);
  assert.equal(cpu.flags.C, 1); // Borrow
});

test("executes PUSH, POP, CALL, and RET stack operations correctly", () => {
  const cpu = createCPUState(16);
  assert.equal(cpu.registers.SP, 15);

  // PUSH A (value 42)
  cpu.registers.A = 42;
  executeSingleInstruction(cpu, OPCODES.PUSH, "A".charCodeAt(0), null);
  assert.equal(cpu.registers.SP, 14);
  assert.equal(cpu.RAM[14], 42);

  // POP B -> B should be 42 and SP back to 15
  executeSingleInstruction(cpu, OPCODES.POP, "B".charCodeAt(0), null);
  assert.equal(cpu.registers.B, 42);
  assert.equal(cpu.registers.SP, 15);

  // CALL 8 from PC = 2
  cpu.PC = 2;
  executeSingleInstruction(cpu, OPCODES.CALL, 8, null);
  assert.equal(cpu.PC, 8);
  assert.equal(cpu.registers.SP, 14);
  assert.equal(cpu.RAM[14], 4); // return address PC + 2 = 4
  assert.deepEqual(cpu.callStack, [4]);

  // RET should restore PC to 4 and restore SP to 15
  executeSingleInstruction(cpu, OPCODES.RET, null, null);
  assert.equal(cpu.PC, 4);
  assert.equal(cpu.registers.SP, 15);
  assert.deepEqual(cpu.callStack, []);
});

test("disassembleInstruction decodes binary opcodes into human-readable assembly", () => {
  const ram = new Uint8Array([
    OPCODES.MOV_LIT, "A".charCodeAt(0), 10,
    OPCODES.PUSH, "A".charCodeAt(0),
    OPCODES.CALL, 8,
    OPCODES.RET,
    OPCODES.HALT,
  ]);

  const mov = disassembleInstruction(ram, 0);
  assert.equal(mov.mnemonic, "MOV");
  assert.equal(mov.instruction, "MOV A, 10");
  assert.equal(mov.length, 3);
  assert.equal(mov.hexBytes, "01 41 0A");

  const push = disassembleInstruction(ram, 3);
  assert.equal(push.instruction, "PUSH A");
  assert.equal(push.length, 2);

  const call = disassembleInstruction(ram, 5);
  assert.equal(call.instruction, "CALL 8");
  assert.equal(call.isCall, true);

  const ret = disassembleInstruction(ram, 7);
  assert.equal(ret.instruction, "RET");
  assert.equal(ret.isRet, true);

  const halt = disassembleInstruction(ram, 8);
  assert.equal(halt.instruction, "HALT");
});

test("disassembleMemory disassembles an entire RAM vector into instruction lines", () => {
  const ram = new Uint8Array(16);
  ram[0] = OPCODES.MOV_LIT;
  ram[1] = "A".charCodeAt(0);
  ram[2] = 25;
  ram[3] = OPCODES.HALT;

  const list = disassembleMemory(ram, 0, 4);
  assert.equal(list.length, 2);
  assert.equal(list[0].instruction, "MOV A, 25");
  assert.equal(list[1].instruction, "HALT");
});

test("throws descriptive assembler errors for invalid operations", () => {
  const ram = new Uint8Array(16);
  assert.throws(() => {
    assembleCode("INVALID_CMD A, B", ram);
  }, /Unknown mnemonic/);

  assert.throws(() => {
    assembleCode("MOV [0], [1]", ram);
  }, /Memory-to-Memory MOV not supported/);

  assert.throws(() => {
    assembleCode("PUSH", ram);
  }, /PUSH requires a register operand/);

  assert.throws(() => {
    assembleCode("CALL", ram);
  }, /CALL requires a target address/);
});

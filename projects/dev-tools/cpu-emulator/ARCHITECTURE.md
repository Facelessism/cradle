# CPU Emulator Architecture Documentation

## Overview

The Core8 CPU Emulator is a virtual 8-bit pipelined CPU environment with a 16-byte RAM space, 4 general-purpose registers (A, B, C, D), Program Counter (PC), status flags (Zero and Carry), and a 5-stage instruction pipeline simulator.

---

## Purpose & Goals

- Demonstrate how a CPU pipeline works (fetch, decode, execute, memory, write-back) through a visible 5-stage simulator
- Provide an end-to-end toolchain: assembly text → assembler → machine code → execution
- Show real pipeline mechanics: operand forwarding, load-use hazard stalling, and branch misprediction flushing
- Stay fully self-contained — no external libraries, build step, or server required

---

## Folder Structure

```text
projects/dev-tools/cpu-emulator/
├── ARCHITECTURE.md    # Architecture documentation
├── assembler.js       # Assembly parser & byte code generator
├── emulatorCore.js    # CPU execution state & opcode engine
├── index.html         # User interface structure
├── script.js          # DOM binding & animation layer
└── style.css          # Theme styles & responsive CSS
```

---

## System / Project Architecture Overview

```text
┌─────────────────────────────────────────────────────────┐
│                    Assembly Text IDE                    │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│              Assembler Compiler (assembler.js)          │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│               16-Byte System RAM Vector                 │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│           Pipelined CPU Core Engine (emulatorCore.js)   │
│  [IF] -> [ID] -> [EX (ALU / Logic)] -> [MEM] -> [WB]    │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│            Interactive SVG & DOM Dashboard              │
└─────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

| File | Responsibility |
|---|---|
| `index.html` | UI shell: assembly editor, preset selector, console, pipeline/register/RAM panels |
| `assembler.js` | Assembly parser that converts mnemonics and operands into 16-byte machine code |
| `emulatorCore.js` | CPU state (registers, flags, RAM) plus a per-instruction reference executor; exports `OPCODES` |
| `script.js` | DOM bindings, 5-stage pipeline simulation, forwarding/stalling/flushing, data-flow animations |
| `style.css` | Theme, dashboard grid, pipeline stage states, RAM cells |

---

## Hardware Specifications

- **Word Size**: 8-bit data, 4-bit memory addresses (0x0 to 0xF).
- **Registers**: `A` (Accumulator), `B`, `C`, `D` (8-bit width).
- **Flags**:
  - `Z` (Zero Flag): Set to 1 if the output of an ALU or bitwise operation is zero.
  - `C` (Carry Flag): Set to 1 if an arithmetic operation overflows 255 or underflows 0.
- **Pipeline Stages**:
  1. `IF` (Instruction Fetch)
  2. `ID` (Instruction Decode & Load-Use Hazard Detection)
  3. `EX` (ALU/Logic Execution, Forwarding Resolution & Misprediction Flush)
  4. `MEM` (RAM Read/Write)
  5. `WB` (Register File Write Back)

## Opcodes & Instruction Set

| Opcode (Hex) | Mnemonic    | Format          | Description                                     |
| ------------ | ----------- | --------------- | ----------------------------------------------- |
| `0x00`       | `HALT`      | `HALT`          | Stops CPU clock execution loop                  |
| `0x01`       | `MOV_LIT`   | `MOV R, Lit`    | Loads 8-bit immediate value into register       |
| `0x02`       | `ADD`       | `ADD R1, R2`    | `R1 = (R1 + R2) & 0xFF`, updates Z and C flags  |
| `0x03`       | `SUB`       | `SUB R1, R2`    | `R1 = (R1 - R2) & 0xFF`, updates Z and C flags  |
| `0x04`       | `JMP`       | `JMP Addr`      | Unconditional jump to target RAM address        |
| `0x05`       | `MOV_REG`   | `MOV R1, R2`    | Copies value of R2 into R1                      |
| `0x06`       | `MOV_MEM_R` | `MOV R, [Addr]` | Reads RAM address into register                 |
| `0x07`       | `MOV_R_MEM` | `MOV [Addr], R` | Writes register value to RAM address            |
| `0x08`       | `JNZ`       | `JNZ Addr`      | Jumps to target RAM address if Zero Flag Z == 0 |
| `0x09`       | `AND`       | `AND R1, R2`    | Bitwise AND between R1 and R2, stores in R1     |
| `0x0A`       | `OR`        | `OR R1, R2`     | Bitwise OR between R1 and R2, stores in R1      |
| `0x0B`       | `XOR`       | `XOR R1, R2`    | Bitwise XOR between R1 and R2, stores in R1     |
| `0x0C`       | `NOT`       | `NOT R`         | Bitwise NOT on register R                       |
| `0x0D`       | `INC`       | `INC R`         | Increments register R by 1                      |
| `0x0E`       | `DEC`       | `DEC R`         | Decrements register R by 1                      |

---

## Data Flow / Execution Flow

```text
User opens index.html
        ↓
User picks a preset or types assembly code
        ↓
Compile button calls assembleCode() (assembler.js)
        ↓
Machine code bytes fill the 16-byte RAM vector (emulatorCore.js)
        ↓
Step or Run starts the clock loop (script.js)
        ↓
Each cycle advances IF → ID → EX → MEM → WB
        ↓
EX applies forwarding; ID inserts a BUBBLE on load-use hazards;
   branches flush the pipeline on misprediction
        ↓
Registers, flags, and RAM are updated
        ↓
Dashboard re-renders; optional SVG packets animate the data flow
```

---

## Key Features

- 5-stage instruction pipeline (IF, ID, EX, MEM, WB) with visible NOP, bubble, and stall states
- 17-instruction set: arithmetic, bitwise, memory moves, jumps, HALT, and CMP
- Operand forwarding to resolve data hazards, load-use stall detection, and branch misprediction flushing
- Step-by-step and continuous run modes with an optional data-flow animation toggle
- Four assembly presets: counter, fibonacci, memory copy, and conditional logic
- Live compiler console with line-numbered error messages

---

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and semantic markup |
| CSS3 (Grid, Flexbox, Custom Properties) | Dashboard layout and pipeline visuals |
| Vanilla JavaScript (ES6+) | Assembler, emulator core, pipeline simulation |
| SVG (via the DOM) | Data-flow packet animations |
| `Uint8Array` | Compact 16-byte RAM vector |
| Node.js (`module.exports`) | Headless unit testing of the core modules |

---

## File Responsibilities

### `assembler.js`

- `assembleCode(sourceCode, ramTarget)` — tokenizes each line, strips `;` comments, validates registers and operands, writes opcode bytes into RAM, and throws line-numbered errors
- Handles `MOV` variants (immediate, register-to-register, memory read/write) and rejects unsupported forms like memory-to-memory MOV

### `emulatorCore.js`

- `OPCODES` — map of mnemonics to byte opcodes
- `createCPUState()` — builds the register file, PC, Z/C flags, 16-byte RAM, and halted flag
- `getOpcodeMnemonic(opcode)` / `getInstructionLength(opcode)` — decode helpers
- `executeSingleInstruction(cpuState, opcode, byte1, byte2)` — non-pipelined reference executor used by the unit tests

### `script.js`

- `renderInitialHardwareGrid()` / `updateHardwareDashboard()` — paint RAM cells, registers, and flags
- `ifStage()` / `idStage()` / `exStage()` / `memStage()` / `wbStage()` — pipeline stage implementations
- `executeClockCycleStep()` / `executionLoop()` — step and run modes
- `animateDataFlow()` — draws SVG lines and packets between register/RAM elements
- `assembleCode` hook, `resetHardwareState()`, and the `PRESETS` example programs

### `index.html`

- Assembly editor textarea, preset selector, and compile/step/run/reset buttons
- Console log area for compiler output
- Pipeline stage grid, register cards, and a 16-cell RAM matrix
- SVG layer for data-flow animations

### `style.css`

- Emulator dashboard layout and cards
- Pipeline stage states: active, bubble, and stalled
- RAM cell highlighting for the active program counter

---

## Design Decisions

- **Pipelined core vs reference executor** — `emulatorCore.js` provides a simple per-instruction executor (used by unit tests), while `script.js` implements the full 5-stage pipeline with hazards. Separating the two keeps the testable core free of DOM and animation concerns.
- **Registers encoded as character codes** — the A/B/C/D registers are stored as their ASCII codes in instruction bytes, keeping the machine code format compact.
- **Forwarding and stalling** — data hazards are resolved by forwarding EX/MEM results; load-use conflicts insert a BUBBLE and stall the pipeline.
- **Backward-branch prediction** — jumps are predicted taken when the target is behind the current PC, with a full pipeline flush on misprediction.

---

## Dependencies

None. This project uses only native browser APIs and Node.js built-in modules for testing — no external libraries are required.

---

## Future Improvements

- Add a disassembly view that maps machine code back to mnemonics
- Persist user-written assembly in localStorage
- Support CALL/RET with a stack pointer register
- Add cycle-count and instruction-count performance statistics

---

## Known Limitations

- 16-byte RAM means programs longer than a few instructions must be written compactly
- The assembler supports no labels or directives; jump targets must be hard-coded addresses
- Memory-to-memory MOV is rejected, and only four registers are available
- The pipeline is simulated in the UI layer only; the reference executor in `emulatorCore.js` runs single instructions

---

## Development Notes

- Run the unit tests with Node.js built-in test runner:
  ```
  node --test tests/cpu-emulator.test.js
  ```
- `emulatorCore.js` and `assembler.js` export via `module.exports` for Node and load as browser globals via plain `<script>` tags
- No build step is required — edit the files and refresh the browser

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None. No external fonts, images, or libraries are used.

---

## References

- [Instruction pipelining — Wikipedia](https://en.wikipedia.org/wiki/Instruction_pipelining)
- [Hazard (computer architecture) — Wikipedia](https://en.wikipedia.org/wiki/Hazard_(computer_architecture))
- [MDN Web Docs — Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)



# CPU Emulator Architecture Documentation

## Overview

The Core8 CPU Emulator is an interactive 8-bit pipelined CPU environment and visual assembly IDE. It features a 16-byte RAM space, 4 general-purpose registers (A, B, C, D), a Stack Pointer (SP), Program Counter (PC), status flags (Zero, Carry, Negative, Overflow), a 5-stage instruction pipeline simulator, a step-by-step assembly debugger (Step Over, Step Into, Step Out), visual line breakpoints, a scrollable memory hex dump viewer with direct byte editing and ASCII decoding, and a real-time disassembler.

---

## Purpose & Goals

- Demonstrate how a CPU pipeline works (fetch, decode, execute, memory, write-back) through an interactive 5-stage simulator
- Provide an end-to-end educational assembly IDE: source editing → breakpoint debugging → stepping → machine code hex inspection → disassembler reconstruction
- Support standard low-level debugging controls: Step Over, Step Into, Step Out, Continue/Pause, and Cycle Stepping
- Illustrate real computer architecture mechanics: stack frames, CALL/RET subroutine linkages, signed two's-complement overflow, operand forwarding, load-use hazard stalling, and branch misprediction flushing
- Stay fully self-contained — zero external libraries, zero build steps, and zero server dependencies

---

## Folder Structure

```text
projects/dev-tools/cpu-emulator/
├── ARCHITECTURE.md    # Architecture documentation
├── assembler.js       # Assembly parser, source map generator & byte code compiler
├── emulatorCore.js    # CPU execution state, opcode engine, flag logic & disassembler
├── index.html         # User interface shell, debugger controls & memory suite tabs
├── script.js          # DOM binding, pipeline simulation, debugger stepping & hex editor
└── style.css          # Theme styles, breakpoint gutter, hex viewer & responsive CSS
```

---

## System / Project Architecture Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Assembly Text IDE & Breakpoint Gutter                │
│             [● Line BP] [▶ Active PC] [Source Line Mapping]            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Assembler Compiler & Source Mapper (assembler.js)          │
│          - Syntax validation, opcode generation, bidirectional maps    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Virtual Memory & Register State                   │
│        - 16-Byte RAM Vector      - Registers (A, B, C, D, PC, SP)      │
│        - Flags (Z, C, N, V)      - Call Stack Frame Vector             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┴──────────────────────────┐
         ▼                                                     ▼
┌───────────────────────────────────┐ ┌──────────────────────────────────┐
│  5-Stage Pipeline (script.js)     │ │ Interactive Memory Suite         │
│  [IF] -> [ID] -> [EX] -> [MEM]    │ │ 1. Hex Dump Viewer (Byte Edit)   │
│  -> [WB] (Forwarding & Hazards)   │ │ 2. Live Disassembler (Sync IDE)  │
│  Step Into / Step Over / Step Out │ │ 3. RAM Array Grid (Data Packets) │
└───────────────────────────────────┘ └──────────────────────────────────┘
```

---

## Component Breakdown

| File              | Responsibility                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `index.html`      | UI shell: assembly editor, gutter, stepping buttons, pipeline, registers/flags, memory hex dump & disassembler |
| `assembler.js`    | Assembly parser that converts mnemonics and operands into bytecode; generates bidirectional source-address maps|
| `emulatorCore.js` | CPU state, ALU flag calculations (Z, C, N, V), reference instruction executor, and memory disassembler engine   |
| `script.js`       | DOM bindings, pipeline simulation, debugger stepping (Step Over/Into/Out), hex dump editing, and SVG animations|
| `style.css`       | Theme, breakpoint gutter, register cards, flag status pills, hex table layout, disassembler feed, and animations|

---

## Hardware Specifications

- **Word Size**: 8-bit data, 4-bit memory addresses (0x0 to 0xF).
- **Registers**:
  - `A` (Accumulator, 8-bit)
  - `B`, `C`, `D` (General-Purpose, 8-bit)
  - `PC` (Program Counter, 8-bit/4-bit address)
  - `SP` (Stack Pointer, initialized to top of RAM at 0x0F, decrements on PUSH/CALL, increments on POP/RET)
- **Status Flags**:
  - `Z` (Zero Flag): Set to 1 if ALU output is 0.
  - `C` (Carry Flag): Set to 1 on unsigned overflow (> 255) or borrow (< 0).
  - `N` (Negative Flag): Set to 1 if bit 7 (MSB) of the result is 1 (negative in 2's complement).
  - `V` (Overflow Flag): Set to 1 on signed two's-complement arithmetic overflow (e.g. positive + positive = negative).
- **Pipeline Stages**:
  1. `IF` (Instruction Fetch)
  2. `ID` (Instruction Decode & Load-Use Hazard Detection)
  3. `EX` (ALU/Logic Execution, Forwarding Resolution & Misprediction Flush)
  4. `MEM` (RAM Read/Write)
  5. `WB` (Register File Write Back)

---

## Opcodes & Instruction Set

| Opcode (Hex) | Mnemonic    | Format          | Length | Description                                                            |
| ------------ | ----------- | --------------- | ------ | ---------------------------------------------------------------------- |
| `0x00`       | `HALT`      | `HALT`          | 1 Byte | Stops CPU clock execution loop                                         |
| `0x01`       | `MOV_LIT`   | `MOV R, Lit`    | 3 Byte | Loads 8-bit immediate value into register                              |
| `0x02`       | `ADD`       | `ADD R1, R2`    | 3 Byte | `R1 = (R1 + R2) & 0xFF`, updates Z, C, N, and V flags                  |
| `0x03`       | `SUB`       | `SUB R1, R2`    | 3 Byte | `R1 = (R1 - R2) & 0xFF`, updates Z, C, N, and V flags                  |
| `0x04`       | `JMP`       | `JMP Addr`      | 2 Byte | Unconditional jump to target RAM address                               |
| `0x05`       | `MOV_REG`   | `MOV R1, R2`    | 3 Byte | Copies value of R2 into R1                                             |
| `0x06`       | `MOV_MEM_R` | `MOV R, [Addr]` | 3 Byte | Reads RAM address into register                                        |
| `0x07`       | `MOV_R_MEM` | `MOV [Addr], R` | 3 Byte | Writes register value to RAM address                                   |
| `0x08`       | `JNZ`       | `JNZ Addr`      | 2 Byte | Jumps to target RAM address if Zero Flag Z == 0                        |
| `0x09`       | `AND`       | `AND R1, R2`    | 3 Byte | Bitwise AND between R1 and R2, stores in R1 (updates Z, N)             |
| `0x0A`       | `OR`        | `OR R1, R2`     | 3 Byte | Bitwise OR between R1 and R2, stores in R1 (updates Z, N)              |
| `0x0B`       | `XOR`       | `XOR R1, R2`    | 3 Byte | Bitwise XOR between R1 and R2, stores in R1 (updates Z, N)             |
| `0x0C`       | `NOT`       | `NOT R`         | 2 Byte | Bitwise NOT on register R (updates Z, N)                               |
| `0x0D`       | `INC`       | `INC R`         | 2 Byte | Increments register R by 1 (updates Z, C, N, V)                        |
| `0x0E`       | `DEC`       | `DEC R`         | 2 Byte | Decrements register R by 1 (updates Z, C, N, V)                        |
| `0x0F`       | `JZ`        | `JZ Addr`       | 2 Byte | Jumps to target RAM address if Zero Flag Z == 1                        |
| `0x10`       | `CMP`       | `CMP R1, R2`    | 3 Byte | Compares R1 - R2 without writing result; updates Z, C, N, V flags      |
| `0x11`       | `PUSH`      | `PUSH R`        | 2 Byte | Decrements SP, stores register R at RAM[SP]                            |
| `0x12`       | `POP`       | `POP R`         | 2 Byte | Loads RAM[SP] into register R, increments SP                           |
| `0x13`       | `CALL`      | `CALL Addr`     | 2 Byte | Pushes return address (PC+2) to stack & callStack, jumps to Addr       |
| `0x14`       | `RET`       | `RET`           | 1 Byte | Pops return address from stack & callStack, jumps to return address    |

---

## Data Flow / Execution Flow

```text
User writes assembly or picks a preset
        ↓
Compile button runs assembleCode() & assembleWithSourceMap()
        ↓
Machine code bytes populate the 16-byte RAM vector
Source lines map bidirectionally to instruction memory addresses
        ↓
User sets breakpoints by clicking gutter (●) or disassembler rows
        ↓
Debugger controls execute instructions:
   ├── Step Into (F11): advances execution until the current instruction finishes
   ├── Step Over (F10): steps single instruction; for CALL, runs until return address
   ├── Step Out (Shift+F11): runs until returning from current subroutine call
   ├── Cycle Step: advances 1 clock cycle of the 5-stage pipeline
   └── Run / Continue (F5): runs continuously until breakpoint or HALT
        ↓
EX stage calculates ALU results and updates Z, C, N, V flags
MEM stage and PUSH/POP/CALL/RET update RAM and Stack Pointer (SP)
        ↓
Hex Viewer, Disassembler, Gutter markers, and SVG animations update in real time
```

---

## Key Features

- **Interactive Assembly Debugger**:
  - Line-by-line stepping with **Step Into (F11)**, **Step Over (F10)**, and **Step Out (Shift+F11)**
  - Cycle-level stepping for in-depth pipeline inspection
  - Visual breakpoint toggling on instruction lines via clickable gutter dots (`●`)
  - Execution pause with detailed breakpoint hit notifications
- **Live CPU Flag Indicators**:
  - Live color-coded status pills for **Zero (Z)**, **Carry (C)**, **Negative (N)**, and **Overflow (V)**
  - Accurate signed two's-complement arithmetic overflow detection
  - Hover tooltips explaining exact trigger conditions
- **Scrollable Real-Time Memory Hex Dump Viewer**:
  - 8-byte row format with hexadecimal offsets, byte columns, and ASCII decoding
  - Highlighted markers for active **Program Counter (PC)** and **Stack Pointer (SP)**
  - **Direct Byte Editing**: Click any byte to edit its value directly in hex, instantly synchronizing with registers, memory, and disassembler
  - **Direct ASCII Editing**: Edit ASCII characters directly to manipulate memory bytes
  - One-click "Zero RAM" utility
- **Built-in Disassembler Engine**:
  - Decodes binary machine code back into clean, readable assembly mnemonics and operands
  - Displays address, raw hex byte sequence, and instruction text
  - Active execution arrow pointing to current PC instruction
  - One-click "Copy to Editor" to synchronize disassembled RAM back into the source editor
- **5-Stage Instruction Pipeline Simulator**:
  - Visual stages: IF, ID, EX, MEM, WB with NOP, stall, and bubble status indicators
  - Operand forwarding to resolve data hazards
  - Load-use stall detection and branch misprediction flushing
- **Assembly Presets**:
  - Counter, Fibonacci, Memory Copy, Conditional Logic, Subroutine & Stack (`CALL`/`RET`), and Flag Indicators (`Z/C/N/V`)
- **Keyboard Shortcuts**:
  - F5 (Run/Pause), F10 (Step Over), F11 (Step Into), Shift+F11 (Step Out), Ctrl+Enter (Compile)

---

## Technologies Used

| Technology                              | Purpose                                                          |
| --------------------------------------- | ---------------------------------------------------------------- |
| HTML5                                   | Page structure, semantic tabs, accessible tables and gutter      |
| CSS3 (Grid, Flexbox, Custom Properties) | IDE panel layout, hex table, disassembler feed, responsive tabs  |
| Vanilla JavaScript (ES6+)               | Assembler, CPU core, debugger stepping engine, and disassembler  |
| SVG (via the DOM)                       | Data-flow packet animations between registers and memory cells   |
| `Uint8Array`                            | Fast, compact 16-byte RAM vector representation                  |
| Node.js (`module.exports`)              | Headless unit testing of emulator core, disassembler & assembler |

---

## File Responsibilities

### `assembler.js`

- `assembleCode(sourceCode, ramTarget)` — tokenizes instructions, validates registers and operands, writes bytecodes, and returns byte count
- `assembleWithSourceMap(sourceCode, ramTarget)` — returns emitted byte count along with bidirectional `lineToAddress` and `addressToLine` maps
- Supports `MOV`, `ADD`, `SUB`, `AND`, `OR`, `XOR`, `NOT`, `INC`, `DEC`, `CMP`, `JMP`, `JNZ`, `JZ`, `PUSH`, `POP`, `CALL`, `RET`, and `HALT`

### `emulatorCore.js`

- `OPCODES` — lookup map of mnemonics to byte opcodes
- `createCPUState(ramSize)` — initializes registers (A, B, C, D, SP), PC, flags (Z, C, N, V), RAM, callStack, and halted state
- `updateALUFlags(cpuState, result, op1, op2, opType)` — calculates Zero, Carry, Negative, and signed two's-complement Overflow
- `executeSingleInstruction(cpuState, opcode, byte1, byte2)` — reference execution engine with stack and subroutine support
- `disassembleInstruction(ram, pc)` — decodes raw bytes at a given PC into instruction objects
- `disassembleMemory(ram, start, length)` — disassembles a full RAM buffer into a sequence of instructions

### `script.js`

- `renderGutter()` / `toggleBreakpoint()` — interactive line gutter rendering with breakpoint markers and current line highlighting
- `renderHexViewer()` / `startHexInlineEdit()` — scrollable hex table with PC/SP markers and direct byte editing
- `renderDisassembler()` — live disassembled instruction list with breakpoint toggles and editor sync
- `executeStepInto()` / `executeStepOver()` / `executeStepOut()` / `runUntilBreakpointOrHalt()` — debugger stepping engine
- `wbStage()`, `memStage()`, `exStage()`, `idStage()`, `ifStage()` — 5-stage pipeline simulation with forwarding and stalls
- Keyboard shortcut listeners (`F5`, `F10`, `F11`, `Shift+F11`) and UI tab switcher

### `index.html`

- IDE panel with assembly editor, line gutter, stepping toolbar, and console log
- Hardware panel with pipeline stages, register cards, and live Z/C/N/V flag badges
- Tabbed memory inspection suite: Hex Dump, Disassembler, and RAM Grid

### `style.css`

- Theme variables and dark mode color scheme
- Gutter styling with breakpoint dots (`●`) and execution marker (`▶`)
- Color-coded flag badges (green for Z, amber for C, purple for N, red for V)
- Hex table styling with active PC (cyan) and SP (magenta) outlines
- Disassembler row grid styling and reduced-motion media query support

---

## Design Decisions

- **Direct Byte Editing without Compilation**: Users can click any hex byte in the Hex Viewer or ASCII column to change memory in real time; the disassembler and registers immediately reflect the edit.
- **Dual Stepping Paradigms**: Both instruction-level debugging (Step Into, Step Over, Step Out) and clock-cycle-level pipeline stepping are provided, catering to both software debugging and hardware architecture learning.
- **Stack Growing Downward**: The stack pointer (SP) begins at the top of RAM (0x0F) and decrements on `PUSH`/`CALL`, aligning with real computer architecture standards.
- **Subroutine Call Stack Tracking**: In addition to storing return addresses in physical RAM, an internal `callStack` array is maintained to power reliable `Step Out` behavior.

---

## Dependencies

None. Built entirely with native browser web standards and Node.js built-ins.

---

## Future Improvements

- Support user-defined symbolic labels in the assembler (e.g. `loop:` instead of hard-coded numbers)
- Add memory watchpoints that break execution when a specific address is written
- Configurable RAM sizes (32B, 64B, 256B) selectable directly from the UI toolbar

---

## Known Limitations

- 16-byte RAM requires programs with subroutines and data to be compactly structured
- The assembler uses explicit numeric targets for jump and call instructions rather than symbolic labels
- Memory-to-memory MOV operations are not supported by the hardware instruction set

---

## Development Notes

- Unit test specifications can be found in `tests/cpu-emulator.test.js`.
- Both `emulatorCore.js` and `assembler.js` are dual-environment modules: they export via `module.exports` for Node and attach to `window` in the browser.

---

## License & Attribution

- **Project License:** MIT
- **Third-Party Assets:** None.

---

## References

- [Instruction pipelining — Wikipedia](https://en.wikipedia.org/wiki/Instruction_pipelining)
- [Two's complement & arithmetic overflow — Wikipedia](https://en.wikipedia.org/wiki/Two%27s_complement)
- [CALL / RET instructions and call stack — Wikipedia](https://en.wikipedia.org/wiki/Call_stack)
- [MDN Web Docs — Uint8Array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)

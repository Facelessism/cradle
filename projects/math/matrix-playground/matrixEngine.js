/**
 * Matrix Playground Engine
 * Provides matrix math operations: basic arithmetic, determinants, inverses,
 * LU decomposition, QR decomposition, eigenvalues (2x2/3x3), trace, rank.
 */
(function (exports) {
  "use strict";

  const MAX_ITERATIONS = 10000;

  /**
   * Validate matrix dimensions and malformed inputs.
   */
  function validateMatrix(matrix, name = "Matrix") {
    if (!matrix || !Array.isArray(matrix) || matrix.length === 0) {
      throw new Error(`${name} must be a non-empty 2D array.`);
    }
    const cols = matrix[0] ? matrix[0].length : 0;
    if (cols === 0) {
      throw new Error(`${name} must have at least one column.`);
    }

    let iter = 0;
    for (let r = 0; r < matrix.length; r++) {
      if (++iter > MAX_ITERATIONS)
        throw new Error("Iteration limit exceeded during validation.");
      if (!Array.isArray(matrix[r]) || matrix[r].length !== cols) {
        throw new Error(`${name} must have consistent row dimensions.`);
      }
      for (let c = 0; c < cols; c++) {
        if (++iter > MAX_ITERATIONS)
          throw new Error("Iteration limit exceeded during validation.");
        const val = matrix[r][c];
        if (typeof val !== "number" || !Number.isFinite(val)) {
          throw new Error(`${name} elements must be valid finite numbers.`);
        }
      }
    }
    return true;
  }

  /**
   * Helper: create an m x n matrix filled with a initial value.
   */
  function createMatrix(rows, cols, initialValue = 0) {
    const matrix = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(
          typeof initialValue === "function" ? initialValue(r, c) : initialValue
        );
      }
      matrix.push(row);
    }
    return matrix;
  }

  /**
   * Helper: create an n x n identity matrix.
   */
  function createIdentity(size) {
    return createMatrix(size, size, (r, c) => (r === c ? 1 : 0));
  }

  /**
   * Add two matrices of identical dimensions.
   */
  function add(a, b) {
    validateMatrix(a, "Matrix A");
    validateMatrix(b, "Matrix B");
    if (a.length !== b.length || a[0].length !== b[0].length) {
      throw new Error("Matrix dimensions must match for addition.");
    }
    return a.map((row, r) => row.map((val, c) => val + b[r][c]));
  }

  /**
   * Subtract matrix B from matrix A.
   */
  function subtract(a, b) {
    validateMatrix(a, "Matrix A");
    validateMatrix(b, "Matrix B");
    if (a.length !== b.length || a[0].length !== b[0].length) {
      throw new Error("Matrix dimensions must match for subtraction.");
    }
    return a.map((row, r) => row.map((val, c) => val - b[r][c]));
  }

  /**
   * Multiply matrix A (m x n) by matrix B (n x p).
   */
  function multiply(a, b) {
    validateMatrix(a, "Matrix A");
    validateMatrix(b, "Matrix B");
    const rowsA = a.length;
    const colsA = a[0].length;
    const rowsB = b.length;
    const colsB = b[0].length;

    if (colsA !== rowsB) {
      throw new Error(
        `Cannot multiply matrix of shape (${rowsA}x${colsA}) with (${rowsB}x${colsB}).`
      );
    }

    const result = createMatrix(rowsA, colsB, 0);
    let iter = 0;
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        if (++iter > MAX_ITERATIONS)
          throw new Error("Iteration limit exceeded in multiply.");
        let sum = 0;
        for (let k = 0; k < colsA; k++) {
          sum += a[i][k] * b[k][j];
        }
        result[i][j] = Math.abs(sum) < 1e-12 ? 0 : sum;
      }
    }
    return result;
  }

  /**
   * Scale matrix by scalar multiplier.
   */
  function scale(matrix, scalar) {
    validateMatrix(matrix);
    if (typeof scalar !== "number" || !Number.isFinite(scalar)) {
      throw new Error("Scalar must be a valid finite number.");
    }
    return matrix.map(row => row.map(val => val * scalar));
  }

  /**
   * Transpose matrix.
   */
  function transpose(matrix) {
    validateMatrix(matrix);
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result = createMatrix(cols, rows, 0);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result[c][r] = matrix[r][c];
      }
    }
    return result;
  }

  /**
   * Calculate trace of a square matrix.
   */
  function trace(matrix) {
    validateMatrix(matrix);
    if (matrix.length !== matrix[0].length) {
      throw new Error("Trace is only defined for square matrices.");
    }
    let sum = 0;
    for (let i = 0; i < matrix.length; i++) {
      sum += matrix[i][i];
    }
    return sum;
  }

  /**
   * Calculate determinant of a square matrix using LU/recursion.
   */
  function determinant(matrix) {
    validateMatrix(matrix);
    const n = matrix.length;
    if (n !== matrix[0].length) {
      throw new Error("Determinant is only defined for square matrices.");
    }
    if (n === 1) return matrix[0][0];
    if (n === 2)
      return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];

    // LU decomposition approach for n >= 3
    const copy = matrix.map(r => r.slice());
    let det = 1;
    let swaps = 0;
    let iter = 0;

    for (let i = 0; i < n; i++) {
      if (++iter > MAX_ITERATIONS)
        throw new Error("Iteration limit exceeded in determinant.");
      let pivot = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(copy[j][i]) > Math.abs(copy[pivot][i])) {
          pivot = j;
        }
      }
      if (Math.abs(copy[pivot][i]) < 1e-12) return 0;

      if (pivot !== i) {
        const temp = copy[i];
        copy[i] = copy[pivot];
        copy[pivot] = temp;
        swaps++;
      }

      det *= copy[i][i];
      for (let j = i + 1; j < n; j++) {
        const factor = copy[j][i] / copy[i][i];
        for (let k = i + 1; k < n; k++) {
          copy[j][k] -= factor * copy[i][k];
        }
      }
    }

    return swaps % 2 === 0 ? det : -det;
  }

  /**
   * Inverse of a square matrix using Gauss-Jordan elimination.
   */
  function inverse(matrix) {
    validateMatrix(matrix);
    const n = matrix.length;
    if (n !== matrix[0].length) {
      throw new Error("Inverse is only defined for square matrices.");
    }

    const aug = matrix.map((row, r) => {
      const identityRow = new Array(n).fill(0);
      identityRow[r] = 1;
      return row.concat(identityRow);
    });

    let iter = 0;
    for (let i = 0; i < n; i++) {
      if (++iter > MAX_ITERATIONS)
        throw new Error("Iteration limit exceeded in inverse.");
      let pivot = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(aug[j][i]) > Math.abs(aug[pivot][i])) {
          pivot = j;
        }
      }

      if (Math.abs(aug[pivot][i]) < 1e-12) {
        throw new Error("Matrix is singular and cannot be inverted.");
      }

      if (pivot !== i) {
        const temp = aug[i];
        aug[i] = aug[pivot];
        aug[pivot] = temp;
      }

      const divisor = aug[i][i];
      for (let j = 0; j < 2 * n; j++) {
        aug[i][j] /= divisor;
      }

      for (let r = 0; r < n; r++) {
        if (r !== i) {
          const factor = aug[r][i];
          for (let c = 0; c < 2 * n; c++) {
            aug[r][c] -= factor * aug[i][c];
          }
        }
      }
    }

    return aug.map(row =>
      row.slice(n).map(val => (Math.abs(val) < 1e-12 ? 0 : val))
    );
  }

  /**
   * Calculate Matrix Rank using Row Echelon Form.
   */
  function rank(matrix) {
    validateMatrix(matrix);
    const rows = matrix.length;
    const cols = matrix[0].length;
    const copy = matrix.map(r => r.slice());

    let r = 0;
    let iter = 0;
    for (let c = 0; c < cols && r < rows; c++) {
      if (++iter > MAX_ITERATIONS)
        throw new Error("Iteration limit exceeded in rank.");
      let pivot = r;
      for (let i = r + 1; i < rows; i++) {
        if (Math.abs(copy[i][c]) > Math.abs(copy[pivot][c])) {
          pivot = i;
        }
      }

      if (Math.abs(copy[pivot][c]) < 1e-12) continue;

      if (pivot !== r) {
        const temp = copy[r];
        copy[r] = copy[pivot];
        copy[pivot] = temp;
      }

      for (let i = r + 1; i < rows; i++) {
        const factor = copy[i][c] / copy[r][c];
        for (let j = c; j < cols; j++) {
          copy[i][j] -= factor * copy[r][j];
        }
      }
      r++;
    }
    return r;
  }

  /**
   * LU Decomposition (Doolittle method)
   * Returns { L, U } where A = L * U
   */
  function luDecomposition(matrix) {
    validateMatrix(matrix);
    const n = matrix.length;
    if (n !== matrix[0].length) {
      throw new Error("LU decomposition requires a square matrix.");
    }

    const L = createIdentity(n);
    const U = createMatrix(n, n, 0);

    let iter = 0;
    for (let i = 0; i < n; i++) {
      if (++iter > MAX_ITERATIONS)
        throw new Error("Iteration limit exceeded in luDecomposition.");
      // Upper Triangular U
      for (let k = i; k < n; k++) {
        let sum = 0;
        for (let j = 0; j < i; j++) {
          sum += L[i][j] * U[j][k];
        }
        U[i][k] = matrix[i][k] - sum;
      }

      // Lower Triangular L
      for (let k = i + 1; k < n; k++) {
        let sum = 0;
        for (let j = 0; j < i; j++) {
          sum += L[k][j] * U[j][i];
        }
        if (Math.abs(U[i][i]) < 1e-12) {
          throw new Error("LU decomposition failed: zero pivot encountered.");
        }
        L[k][i] = (matrix[k][i] - sum) / U[i][i];
      }
    }

    // Clean small epsilon rounding errors
    const clean = m =>
      m.map(row =>
        row.map(val => (Math.abs(val) < 1e-12 ? 0 : Number(val.toFixed(6))))
      );
    return { L: clean(L), U: clean(U) };
  }

  /**
   * QR Decomposition (Gram-Schmidt Orthogonalization)
   * Returns { Q, R } where A = Q * R
   */
  function qrDecomposition(matrix) {
    validateMatrix(matrix);
    const rows = matrix.length;
    const cols = matrix[0].length;

    const A = matrix;
    const Q = createMatrix(rows, cols, 0);
    const R = createMatrix(cols, cols, 0);

    let iter = 0;
    for (let j = 0; j < cols; j++) {
      if (++iter > MAX_ITERATIONS)
        throw new Error("Iteration limit exceeded in qrDecomposition.");
      let v = A.map(row => row[j]);

      for (let i = 0; i < j; i++) {
        let r_ij = 0;
        for (let k = 0; k < rows; k++) {
          r_ij += Q[k][i] * A[k][j];
        }
        R[i][j] = r_ij;
        for (let k = 0; k < rows; k++) {
          v[k] -= r_ij * Q[k][i];
        }
      }

      let norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
      R[j][j] = norm;

      if (norm > 1e-12) {
        for (let k = 0; k < rows; k++) {
          Q[k][j] = v[k] / norm;
        }
      }
    }

    const clean = m =>
      m.map(row =>
        row.map(val => (Math.abs(val) < 1e-12 ? 0 : Number(val.toFixed(6))))
      );
    return { Q: clean(Q), R: clean(R) };
  }

  /**
   * Calculate Real Eigenvalues for 2x2 or 3x3 matrices.
   */
  function eigenvalues(matrix) {
    validateMatrix(matrix);
    const n = matrix.length;
    if (n !== matrix[0].length || (n !== 2 && n !== 3)) {
      throw new Error(
        "Eigenvalue computation supports 2x2 or 3x3 square matrices."
      );
    }

    if (n === 2) {
      const a = matrix[0][0];
      const b = matrix[0][1];
      const c = matrix[1][0];
      const d = matrix[1][1];
      const tr = a + d;
      const det = a * d - b * c;
      const discriminant = tr * tr - 4 * det;

      if (discriminant < 0) {
        const real = tr / 2;
        const imag = Math.sqrt(-discriminant) / 2;
        return [
          { real, imag },
          { real, imag: -imag },
        ];
      }
      return [
        { real: (tr + Math.sqrt(discriminant)) / 2, imag: 0 },
        { real: (tr - Math.sqrt(discriminant)) / 2, imag: 0 },
      ];
    }

    // 3x3 Characteristic polynomial via Cardano / Trigonometric solution
    const tr = trace(matrix);
    const m00 = matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1];
    const m11 = matrix[0][0] * matrix[2][2] - matrix[0][2] * matrix[2][0];
    const m22 = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    const subDetSum = m00 + m11 + m22;
    const det = determinant(matrix);

    // Solve the characteristic cubic λ³ - tr·λ² + subDetSum·λ - det = 0 via the
    // depressed cubic t³ + P·t + Q = 0 (λ = t + tr/3). The discriminant selects
    // the case: Δ' > 0 → one real + two complex-conjugate roots; Δ' < 0 → three
    // distinct real roots; Δ' = 0 → repeated roots. (The old code returned tr/3
    // three times for any p ≤ 0, which was wrong for every matrix with complex
    // eigenvalues, e.g. a rotation.)
    const shift = tr / 3;
    const P = subDetSum - (tr * tr) / 3;
    const Q = (-2 * tr * tr * tr) / 27 + (tr * subDetSum) / 3 - det;

    const round6 = x => Number(x.toFixed(6));
    const discriminant = (Q * Q) / 4 + (P * P * P) / 27;

    if (discriminant > 1e-9) {
      // One real root and a complex-conjugate pair (Cardano).
      const sqrtDisc = Math.sqrt(discriminant);
      const u = Math.cbrt(-Q / 2 + sqrtDisc);
      const v = Math.cbrt(-Q / 2 - sqrtDisc);
      const realRoot = u + v;
      const realPart = -(u + v) / 2;
      const imagPart = (Math.sqrt(3) / 2) * (u - v);
      return [
        { real: round6(realRoot + shift), imag: 0 },
        { real: round6(realPart + shift), imag: round6(imagPart) },
        { real: round6(realPart + shift), imag: round6(-imagPart) },
      ];
    }

    if (discriminant < -1e-9) {
      // Three distinct real roots (trigonometric form; here P < 0).
      const m = 2 * Math.sqrt(-P / 3);
      const arg = Math.max(-1, Math.min(1, (3 * Q) / (P * m)));
      const theta = Math.acos(arg) / 3;
      return [0, 1, 2].map(k => ({
        real: round6(m * Math.cos(theta - (2 * Math.PI * k) / 3) + shift),
        imag: 0,
      }));
    }

    // Repeated roots (Δ' ≈ 0).
    if (Math.abs(P) < 1e-9) {
      return [
        { real: round6(shift), imag: 0 },
        { real: round6(shift), imag: 0 },
        { real: round6(shift), imag: 0 },
      ];
    }
    const w = Math.cbrt(-Q / 2);
    return [
      { real: round6(2 * w + shift), imag: 0 },
      { real: round6(-w + shift), imag: 0 },
      { real: round6(-w + shift), imag: 0 },
    ];
  }

  /**
   * Helper: round a number to a fixed number of decimals, eliminating -0 and small floats.
   */
  function cleanNumber(val, decimals = 6) {
    if (Math.abs(val) < 1e-12) return 0;
    return Number(val.toFixed(decimals));
  }

  function cloneMatrix(m) {
    return m.map(row => row.slice());
  }

  /**
   * Format a number or fraction for human-readable annotations.
   */
  function formatFraction(val) {
    if (Math.abs(val) < 1e-12) return "0";
    if (Number.isInteger(val)) return val.toString();
    // Try simple denominators 2 through 12
    for (let d = 2; d <= 12; d++) {
      const n = Math.round(val * d);
      if (Math.abs(val - n / d) < 1e-6) {
        return `${n}/${d}`;
      }
    }
    return Number(val.toFixed(3)).toString();
  }

  /**
   * Step-by-step Gauss-Jordan Row Reduction to Reduced Row Echelon Form (RREF).
   * Records every elementary row operation (swap, scale, eliminate) with math annotations.
   */
  function gaussJordanSteps(matrix) {
    validateMatrix(matrix);
    const m = matrix.length;
    const n = matrix[0].length;
    const A = cloneMatrix(matrix);

    const steps = [];

    // Initial state step
    steps.push({
      stepIndex: 0,
      type: "initial",
      annotation: "Initial Matrix A",
      description: "Initial matrix state before row operations begin.",
      matrix: cloneMatrix(A).map(row => row.map(v => cleanNumber(v))),
      pivot: null,
      activeRows: [],
      factor: null,
    });

    let leadRow = 0;
    let stepNum = 1;

    for (let col = 0; col < n && leadRow < m; col++) {
      // 1. Partial Pivoting: Find row with max absolute value in current column
      let pivotRow = leadRow;
      let maxVal = Math.abs(A[leadRow][col]);

      for (let r = leadRow + 1; r < m; r++) {
        if (Math.abs(A[r][col]) > maxVal) {
          maxVal = Math.abs(A[r][col]);
          pivotRow = r;
        }
      }

      // If entire column below leadRow is zero, skip this column
      if (maxVal < 1e-9) {
        continue;
      }

      // 2. Row Swap if needed
      if (pivotRow !== leadRow) {
        const temp = A[leadRow];
        A[leadRow] = A[pivotRow];
        A[pivotRow] = temp;

        steps.push({
          stepIndex: stepNum++,
          type: "swap",
          annotation: `R${leadRow + 1} ↔ R${pivotRow + 1}`,
          description: `Swap Row ${leadRow + 1} with Row ${pivotRow + 1} to bring pivot element (${cleanNumber(A[leadRow][col])}) to diagonal.`,
          matrix: cloneMatrix(A).map(row => row.map(v => cleanNumber(v))),
          pivot: [leadRow, col],
          activeRows: [leadRow, pivotRow],
          factor: null,
        });
      }

      // 3. Scale pivot row so pivot element becomes 1
      const pivotVal = A[leadRow][col];
      if (Math.abs(pivotVal - 1) > 1e-9) {
        const scaleFactor = 1 / pivotVal;
        for (let c = 0; c < n; c++) {
          A[leadRow][c] = A[leadRow][c] * scaleFactor;
        }
        A[leadRow][col] = 1; // ensure exact 1

        steps.push({
          stepIndex: stepNum++,
          type: "scale",
          annotation: `R${leadRow + 1} ← (${formatFraction(scaleFactor)}) · R${leadRow + 1}`,
          description: `Scale Row ${leadRow + 1} by 1 / (${cleanNumber(pivotVal)}) to normalize pivot to 1.`,
          matrix: cloneMatrix(A).map(row => row.map(v => cleanNumber(v))),
          pivot: [leadRow, col],
          activeRows: [leadRow],
          factor: scaleFactor,
        });
      }

      // 4. Eliminate all other rows in this column (Gauss-Jordan eliminates above AND below)
      for (let r = 0; r < m; r++) {
        if (r === leadRow) continue;
        const factor = A[r][col];
        if (Math.abs(factor) > 1e-9) {
          for (let c = 0; c < n; c++) {
            A[r][c] = A[r][c] - factor * A[leadRow][c];
          }
          A[r][col] = 0; // ensure exact 0

          const sign = factor >= 0 ? "-" : "+";
          const absFactorStr = formatFraction(Math.abs(factor));
          const factorAnnotation =
            absFactorStr === "1" ? "" : `${absFactorStr} · `;

          steps.push({
            stepIndex: stepNum++,
            type: "eliminate",
            annotation: `R${r + 1} ← R${r + 1} ${sign} ${factorAnnotation}R${leadRow + 1}`,
            description: `Eliminate entry at [Row ${r + 1}, Col ${col + 1}]: subtract ${cleanNumber(factor)} × Row ${leadRow + 1} from Row ${r + 1}.`,
            matrix: cloneMatrix(A).map(row => row.map(v => cleanNumber(v))),
            pivot: [leadRow, col],
            activeRows: [leadRow, r],
            factor: factor,
          });
        }
      }

      leadRow++;
    }

    // Final completion step
    const finalCleanMatrix = cloneMatrix(A).map(row =>
      row.map(v => cleanNumber(v))
    );
    steps.push({
      stepIndex: stepNum,
      type: "complete",
      annotation: "RREF Complete",
      description:
        "Gauss-Jordan elimination complete. Matrix is in Reduced Row Echelon Form (RREF).",
      matrix: finalCleanMatrix,
      pivot: null,
      activeRows: [],
      factor: null,
    });

    return steps;
  }

  /**
   * Characteristic Polynomial for 2x2 and 3x3 matrices.
   * Calculates det(λI - A) = 0 in monic polynomial form.
   */
  function characteristicPolynomial(matrix) {
    validateMatrix(matrix);
    const n = matrix.length;
    if (n !== matrix[0].length || (n !== 2 && n !== 3)) {
      throw new Error(
        "Characteristic polynomial calculation supports 2x2 or 3x3 square matrices."
      );
    }

    if (n === 2) {
      // P(λ) = λ² - tr(A)λ + det(A)
      const tr = trace(matrix);
      const det = determinant(matrix);
      const c2 = 1;
      const c1 = -tr;
      const c0 = det;

      const formatTerm = (coef, power) => {
        if (Math.abs(coef) < 1e-9) return "";
        const sign = coef > 0 ? "+" : "-";
        const absVal = Math.abs(cleanNumber(coef));
        const valStr = absVal === 1 && power > 0 ? "" : absVal.toString();
        const varStr = power === 2 ? "λ²" : power === 1 ? "λ" : "";
        return `${sign} ${valStr}${varStr}`;
      };

      // Construct equation string: λ² - tr·λ + det = 0
      let eq = "λ²";
      const term1 = formatTerm(c1, 1);
      const term0 = formatTerm(c0, 0);
      if (term1) eq += ` ${term1}`;
      if (term0) eq += ` ${term0}`;
      eq += " = 0";

      // LaTeX equation
      let latex = "\\lambda^2";
      if (Math.abs(c1) > 1e-9) {
        const sign = c1 > 0 ? "+" : "-";
        const absVal = Math.abs(cleanNumber(c1));
        latex += ` ${sign} ${absVal === 1 ? "" : absVal}\\lambda`;
      }
      if (Math.abs(c0) > 1e-9) {
        const sign = c0 > 0 ? "+" : "-";
        latex += ` ${sign} ${Math.abs(cleanNumber(c0))}`;
      }
      latex += " = 0";

      return {
        degree: 2,
        coefficients: [c2, cleanNumber(c1), cleanNumber(c0)],
        equation: eq,
        latex: latex,
        trace: cleanNumber(tr),
        determinant: cleanNumber(det),
      };
    }

    // 3x3 case: P(λ) = λ³ - tr·λ² + subDetSum·λ - det = 0
    const tr = trace(matrix);
    const m00 = matrix[1][1] * matrix[2][2] - matrix[1][2] * matrix[2][1];
    const m11 = matrix[0][0] * matrix[2][2] - matrix[0][2] * matrix[2][0];
    const m22 = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
    const subDetSum = m00 + m11 + m22;
    const det = determinant(matrix);

    const c3 = 1;
    const c2 = -tr;
    const c1 = subDetSum;
    const c0 = -det;

    let eq = "λ³";
    const formatTerm3 = (coef, power) => {
      if (Math.abs(coef) < 1e-9) return "";
      const sign = coef > 0 ? "+" : "-";
      const absVal = Math.abs(cleanNumber(coef));
      const valStr = absVal === 1 && power > 0 ? "" : absVal.toString();
      const varStr = power === 2 ? "λ²" : power === 1 ? "λ" : "";
      return `${sign} ${valStr}${varStr}`;
    };

    const t2 = formatTerm3(c2, 2);
    const t1 = formatTerm3(c1, 1);
    const t0 = formatTerm3(c0, 0);
    if (t2) eq += ` ${t2}`;
    if (t1) eq += ` ${t1}`;
    if (t0) eq += ` ${t0}`;
    eq += " = 0";

    let latex = "\\lambda^3";
    if (Math.abs(c2) > 1e-9) {
      const sign = c2 > 0 ? "+" : "-";
      const absVal = Math.abs(cleanNumber(c2));
      latex += ` ${sign} ${absVal === 1 ? "" : absVal}\\lambda^2`;
    }
    if (Math.abs(c1) > 1e-9) {
      const sign = c1 > 0 ? "+" : "-";
      const absVal = Math.abs(cleanNumber(c1));
      latex += ` ${sign} ${absVal === 1 ? "" : absVal}\\lambda`;
    }
    if (Math.abs(c0) > 1e-9) {
      const sign = c0 > 0 ? "+" : "-";
      latex += ` ${sign} ${Math.abs(cleanNumber(c0))}`;
    }
    latex += " = 0";

    return {
      degree: 3,
      coefficients: [c3, cleanNumber(c2), cleanNumber(c1), cleanNumber(c0)],
      equation: eq,
      latex: latex,
      trace: cleanNumber(tr),
      subDetSum: cleanNumber(subDetSum),
      determinant: cleanNumber(det),
    };
  }

  /**
   * Calculate Eigenvectors for 2x2 and 3x3 matrices given their eigenvalues.
   * Solves (A - λI)v = 0.
   */
  function eigenvectors(matrix, evs = null) {
    validateMatrix(matrix);
    const n = matrix.length;
    if (n !== matrix[0].length || (n !== 2 && n !== 3)) {
      throw new Error(
        "Eigenvector computation supports 2x2 or 3x3 square matrices."
      );
    }

    if (!evs) {
      evs = eigenvalues(matrix);
    }

    const vectorResults = [];

    if (n === 2) {
      for (let i = 0; i < evs.length; i++) {
        const ev = evs[i];
        if (Math.abs(ev.imag) > 1e-7) {
          vectorResults.push({
            eigenvalue: ev,
            isComplex: true,
            vector: null,
            normalized: null,
            description: `Complex eigenvalue λ = ${cleanNumber(ev.real)} ± ${cleanNumber(Math.abs(ev.imag))}i (no real eigenvector).`,
          });
          continue;
        }

        const lambda = ev.real;
        const a_minus_lam = matrix[0][0] - lambda;
        const b = matrix[0][1];
        const c = matrix[1][0];
        const d_minus_lam = matrix[1][1] - lambda;

        let v = null;
        if (Math.abs(b) > 1e-7 || Math.abs(a_minus_lam) > 1e-7) {
          v = [-b, a_minus_lam];
        } else if (Math.abs(c) > 1e-7 || Math.abs(d_minus_lam) > 1e-7) {
          v = [-d_minus_lam, c];
        } else {
          // Both rows zero => scalar matrix A = λI
          v = i === 0 ? [1, 0] : [0, 1];
        }

        let norm = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
        if (norm < 1e-9) {
          v = [1, 0];
          norm = 1;
        }

        // Standardize direction so first non-zero component is positive
        const firstNonZero = v.find(x => Math.abs(x) > 1e-6) || 1;
        const sign = firstNonZero < 0 ? -1 : 1;
        v = [v[0] * sign, v[1] * sign];

        const normalized = [
          cleanNumber(v[0] / norm),
          cleanNumber(v[1] / norm),
        ];

        vectorResults.push({
          eigenvalue: ev,
          isComplex: false,
          vector: v.map(cleanNumber),
          normalized: normalized,
          description: `Eigenvector for λ = ${cleanNumber(lambda)}: [${normalized.join(", ")}]ᵀ`,
        });
      }
      return vectorResults;
    }

    // 3x3 case
    for (let i = 0; i < evs.length; i++) {
      const ev = evs[i];
      if (Math.abs(ev.imag) > 1e-7) {
        vectorResults.push({
          eigenvalue: ev,
          isComplex: true,
          vector: null,
          normalized: null,
          description: `Complex eigenvalue λ = ${cleanNumber(ev.real)} ± ${cleanNumber(Math.abs(ev.imag))}i (no real eigenvector).`,
        });
        continue;
      }

      const lambda = ev.real;
      const M = [
        [matrix[0][0] - lambda, matrix[0][1], matrix[0][2]],
        [matrix[1][0], matrix[1][1] - lambda, matrix[1][2]],
        [matrix[2][0], matrix[2][1], matrix[2][2] - lambda],
      ];

      const cross = (u, v) => [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];

      const c01 = cross(M[0], M[1]);
      const c02 = cross(M[0], M[2]);
      const c12 = cross(M[1], M[2]);

      const norm01 = Math.sqrt(c01[0] * c01[0] + c01[1] * c01[1] + c01[2] * c01[2]);
      const norm02 = Math.sqrt(c02[0] * c02[0] + c02[1] * c02[1] + c02[2] * c02[2]);
      const norm12 = Math.sqrt(c12[0] * c12[0] + c12[1] * c12[1] + c12[2] * c12[2]);

      let bestV = c01;
      let maxNorm = norm01;

      if (norm02 > maxNorm) {
        maxNorm = norm02;
        bestV = c02;
      }
      if (norm12 > maxNorm) {
        maxNorm = norm12;
        bestV = c12;
      }

      if (maxNorm > 1e-7) {
        const firstNonZero = bestV.find(x => Math.abs(x) > 1e-6) || 1;
        const sign = firstNonZero < 0 ? -1 : 1;
        const normalized = [
          cleanNumber((bestV[0] * sign) / maxNorm),
          cleanNumber((bestV[1] * sign) / maxNorm),
          cleanNumber((bestV[2] * sign) / maxNorm),
        ];

        vectorResults.push({
          eigenvalue: ev,
          isComplex: false,
          vector: bestV.map(x => cleanNumber(x * sign)),
          normalized: normalized,
          description: `Eigenvector for λ = ${cleanNumber(lambda)}: [${normalized.join(", ")}]ᵀ`,
        });
      } else {
        // Rank < 2 (Geometric multiplicity >= 2 or scalar matrix)
        const nonZeroRow = M.find(row => row.some(val => Math.abs(val) > 1e-6));
        if (!nonZeroRow) {
          // M identically zero: A = λI
          const stdBasis = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ];
          const chosen = stdBasis[i % 3];
          vectorResults.push({
            eigenvalue: ev,
            isComplex: false,
            vector: chosen,
            normalized: chosen,
            description: `Eigenvector for λ = ${cleanNumber(lambda)}: [${chosen.join(", ")}]ᵀ (Scalar Matrix)`,
          });
        } else {
          const r = nonZeroRow;
          let vCandidate;
          if (Math.abs(r[0]) >= Math.abs(r[1]) && Math.abs(r[0]) >= Math.abs(r[2])) {
            vCandidate = i % 2 === 0 ? [-r[1] / r[0], 1, 0] : [-r[2] / r[0], 0, 1];
          } else if (Math.abs(r[1]) >= Math.abs(r[0]) && Math.abs(r[1]) >= Math.abs(r[2])) {
            vCandidate = i % 2 === 0 ? [1, -r[0] / r[1], 0] : [0, -r[2] / r[1], 1];
          } else {
            vCandidate = i % 2 === 0 ? [1, 0, -r[0] / r[2]] : [0, 1, -r[1] / r[2]];
          }

          const cNorm = Math.sqrt(
            vCandidate[0] * vCandidate[0] +
              vCandidate[1] * vCandidate[1] +
              vCandidate[2] * vCandidate[2]
          );
          const normalized = vCandidate.map(x => cleanNumber(x / (cNorm || 1)));

          vectorResults.push({
            eigenvalue: ev,
            isComplex: false,
            vector: vCandidate.map(cleanNumber),
            normalized: normalized,
            description: `Eigenvector for λ = ${cleanNumber(lambda)}: [${normalized.join(", ")}]ᵀ (Mult. space)`,
          });
        }
      }
    }

    return vectorResults;
  }

  /**
   * Full Eigenvalue Decomposition: A = V · Λ · V⁻¹
   * Returns characteristic polynomial, eigenvalues, eigenvectors, modal matrix V,
   * diagonal matrix Lambda, and inverse modal matrix V⁻¹.
   */
  function eigenDecomposition(matrix) {
    validateMatrix(matrix);
    const n = matrix.length;
    if (n !== matrix[0].length || (n !== 2 && n !== 3)) {
      throw new Error(
        "Eigenvalue decomposition supports 2x2 or 3x3 square matrices."
      );
    }

    const poly = characteristicPolynomial(matrix);
    const evs = eigenvalues(matrix);
    const evecs = eigenvectors(matrix, evs);

    const hasComplex = evs.some(e => Math.abs(e.imag) > 1e-7);

    let isDiagonalizable = !hasComplex;
    let V = null;
    let Lambda = null;
    let Vinv = null;
    let reconstructed = null;

    if (!hasComplex) {
      V = createMatrix(n, n, 0);
      Lambda = createMatrix(n, n, 0);

      for (let j = 0; j < n; j++) {
        Lambda[j][j] = cleanNumber(evs[j].real);
        const col = evecs[j].normalized;
        for (let i = 0; i < n; i++) {
          V[i][j] = col ? col[i] : 0;
        }
      }

      // Check linear independence of eigenvectors: det(V) !== 0
      const detV = determinant(V);
      if (Math.abs(detV) < 1e-6) {
        isDiagonalizable = false;
      } else {
        Vinv = inverse(V);
        reconstructed = multiply(multiply(V, Lambda), Vinv).map(row =>
          row.map(v => cleanNumber(v))
        );
      }
    }

    return {
      characteristicPolynomial: poly,
      eigenvalues: evs,
      eigenvectors: evecs,
      isDiagonalizable,
      V: V ? V.map(row => row.map(v => cleanNumber(v))) : null,
      Lambda: Lambda ? Lambda.map(row => row.map(v => cleanNumber(v))) : null,
      Vinv: Vinv ? Vinv.map(row => row.map(v => cleanNumber(v))) : null,
      reconstructed,
    };
  }

  exports.createMatrix = createMatrix;
  exports.createIdentity = createIdentity;
  exports.add = add;
  exports.subtract = subtract;
  exports.multiply = multiply;
  exports.scale = scale;
  exports.transpose = transpose;
  exports.trace = trace;
  exports.determinant = determinant;
  exports.inverse = inverse;
  exports.rank = rank;
  exports.luDecomposition = luDecomposition;
  exports.qrDecomposition = qrDecomposition;
  exports.eigenvalues = eigenvalues;
  exports.gaussJordanSteps = gaussJordanSteps;
  exports.characteristicPolynomial = characteristicPolynomial;
  exports.eigenvectors = eigenvectors;
  exports.eigenDecomposition = eigenDecomposition;
})(typeof exports === "undefined" ? (window.MatrixEngine = {}) : exports);

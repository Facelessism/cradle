/**
 * Matrix Playground Engine
 * Provides matrix math operations: basic arithmetic, determinants, inverses,
 * LU decomposition, QR decomposition, eigenvalues (2x2/3x3), trace, rank.
 */
(function (exports) {
  "use strict";

  /**
   * Helper: create an m x n matrix filled with a initial value.
   */
  function createMatrix(rows, cols, initialValue = 0) {
    const matrix = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(typeof initialValue === "function" ? initialValue(r, c) : initialValue);
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
    if (a.length !== b.length || a[0].length !== b[0].length) {
      throw new Error("Matrix dimensions must match for addition.");
    }
    return a.map((row, r) => row.map((val, c) => val + b[r][c]));
  }

  /**
   * Subtract matrix B from matrix A.
   */
  function subtract(a, b) {
    if (a.length !== b.length || a[0].length !== b[0].length) {
      throw new Error("Matrix dimensions must match for subtraction.");
    }
    return a.map((row, r) => row.map((val, c) => val - b[r][c]));
  }

  /**
   * Multiply matrix A (m x n) by matrix B (n x p).
   */
  function multiply(a, b) {
    const rowsA = a.length;
    const colsA = a[0].length;
    const rowsB = b.length;
    const colsB = b[0].length;

    if (colsA !== rowsB) {
      throw new Error(`Cannot multiply matrix of shape (${rowsA}x${colsA}) with (${rowsB}x${colsB}).`);
    }

    const result = createMatrix(rowsA, colsB, 0);
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
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
    return matrix.map(row => row.map(val => val * scalar));
  }

  /**
   * Transpose matrix.
   */
  function transpose(matrix) {
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
    const n = matrix.length;
    if (n !== matrix[0].length) {
      throw new Error("Determinant is only defined for square matrices.");
    }
    if (n === 1) return matrix[0][0];
    if (n === 2) return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];

    // LU decomposition approach for n >= 3
    const copy = matrix.map(r => r.slice());
    let det = 1;
    let swaps = 0;

    for (let i = 0; i < n; i++) {
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
    const n = matrix.length;
    if (n !== matrix[0].length) {
      throw new Error("Inverse is only defined for square matrices.");
    }

    const aug = matrix.map((row, r) => {
      const identityRow = new Array(n).fill(0);
      identityRow[r] = 1;
      return row.concat(identityRow);
    });

    for (let i = 0; i < n; i++) {
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

    return aug.map(row => row.slice(n).map(val => (Math.abs(val) < 1e-12 ? 0 : val)));
  }

  /**
   * Calculate Matrix Rank using Row Echelon Form.
   */
  function rank(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const copy = matrix.map(r => r.slice());

    let r = 0;
    for (let c = 0; c < cols && r < rows; c++) {
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
    const n = matrix.length;
    if (n !== matrix[0].length) {
      throw new Error("LU decomposition requires a square matrix.");
    }

    const L = createIdentity(n);
    const U = createMatrix(n, n, 0);

    for (let i = 0; i < n; i++) {
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
    const clean = m => m.map(row => row.map(val => (Math.abs(val) < 1e-12 ? 0 : Number(val.toFixed(6)))));
    return { L: clean(L), U: clean(U) };
  }

  /**
   * QR Decomposition (Gram-Schmidt Orthogonalization)
   * Returns { Q, R } where A = Q * R
   */
  function qrDecomposition(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;

    const A = matrix;
    const Q = createMatrix(rows, cols, 0);
    const R = createMatrix(cols, cols, 0);

    for (let j = 0; j < cols; j++) {
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

    const clean = m => m.map(row => row.map(val => (Math.abs(val) < 1e-12 ? 0 : Number(val.toFixed(6)))));
    return { Q: clean(Q), R: clean(R) };
  }

  /**
   * Calculate Real Eigenvalues for 2x2 or 3x3 matrices.
   */
  function eigenvalues(matrix) {
    const n = matrix.length;
    if (n !== matrix[0].length || (n !== 2 && n !== 3)) {
      throw new Error("Eigenvalue computation supports 2x2 or 3x3 square matrices.");
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
          { real, imag: -imag }
        ];
      }
      return [
        { real: (tr + Math.sqrt(discriminant)) / 2, imag: 0 },
        { real: (tr - Math.sqrt(discriminant)) / 2, imag: 0 }
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

    const round6 = (x) => Number(x.toFixed(6));
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
        { real: round6(realPart + shift), imag: round6(-imagPart) }
      ];
    }

    if (discriminant < -1e-9) {
      // Three distinct real roots (trigonometric form; here P < 0).
      const m = 2 * Math.sqrt(-P / 3);
      const arg = Math.max(-1, Math.min(1, (3 * Q) / (P * m)));
      const theta = Math.acos(arg) / 3;
      return [0, 1, 2].map((k) => ({
        real: round6(m * Math.cos(theta - (2 * Math.PI * k) / 3) + shift),
        imag: 0
      }));
    }

    // Repeated roots (Δ' ≈ 0).
    if (Math.abs(P) < 1e-9) {
      return [
        { real: round6(shift), imag: 0 },
        { real: round6(shift), imag: 0 },
        { real: round6(shift), imag: 0 }
      ];
    }
    const w = Math.cbrt(-Q / 2);
    return [
      { real: round6(2 * w + shift), imag: 0 },
      { real: round6(-w + shift), imag: 0 },
      { real: round6(-w + shift), imag: 0 }
    ];
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
})(typeof exports === "undefined" ? (window.MatrixEngine = {}) : exports);

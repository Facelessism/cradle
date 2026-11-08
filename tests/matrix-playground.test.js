const test = require("node:test");
const assert = require("node:assert");
const engine = require("../projects/math/matrix-playground/matrixEngine.js");
const storage = require("../projects/math/matrix-playground/matrixStorage.js");

test("MatrixEngine creates empty matrix and identity matrix", () => {
  const m = engine.createMatrix(2, 3, 5);
  assert.strictEqual(m.length, 2);
  assert.strictEqual(m[0].length, 3);
  assert.strictEqual(m[0][0], 5);

  const eye = engine.createIdentity(3);
  assert.deepStrictEqual(eye, [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]);
});

test("MatrixEngine performs addition, subtraction, multiplication, scale, transpose", () => {
  const A = [
    [1, 2],
    [3, 4],
  ];
  const B = [
    [5, 6],
    [7, 8],
  ];

  const sum = engine.add(A, B);
  assert.deepStrictEqual(sum, [
    [6, 8],
    [10, 12],
  ]);

  const diff = engine.subtract(A, B);
  assert.deepStrictEqual(diff, [
    [-4, -4],
    [-4, -4],
  ]);

  const prod = engine.multiply(A, B);
  assert.deepStrictEqual(prod, [
    [19, 22],
    [43, 50],
  ]);

  const scaled = engine.scale(A, 2);
  assert.deepStrictEqual(scaled, [
    [2, 4],
    [6, 8],
  ]);

  const tr = engine.transpose(A);
  assert.deepStrictEqual(tr, [
    [1, 3],
    [2, 4],
  ]);
});

test("MatrixEngine calculates determinant, trace, and inverse correctly", () => {
  const A = [
    [4, 7],
    [2, 6],
  ];

  assert.strictEqual(engine.trace(A), 10);
  assert.strictEqual(engine.determinant(A), 10);

  const inv = engine.inverse(A);
  const prod = engine.multiply(A, inv);
  assert.strictEqual(Math.round(prod[0][0]), 1);
  assert.strictEqual(Math.round(prod[0][1]), 0);
  assert.strictEqual(Math.round(prod[1][0]), 0);
  assert.strictEqual(Math.round(prod[1][1]), 1);
});

test("MatrixEngine performs LU Decomposition", () => {
  const A = [
    [2, 1],
    [6, 8],
  ];

  const { L, U } = engine.luDecomposition(A);
  assert.strictEqual(L[0][0], 1);
  assert.strictEqual(L[1][0], 3);
  assert.strictEqual(U[0][0], 2);
  assert.strictEqual(U[1][1], 5);
});

test("MatrixEngine performs QR Decomposition", () => {
  const A = [
    [1, 0],
    [1, 1],
  ];

  const { Q, R } = engine.qrDecomposition(A);
  assert.ok(Q.length === 2 && Q[0].length === 2);
  assert.ok(R.length === 2 && R[0].length === 2);
});

test("MatrixEngine computes Eigenvalues for 2x2 matrix", () => {
  const A = [
    [0, 1],
    [-2, -3],
  ];

  const evs = engine.eigenvalues(A);
  assert.strictEqual(evs.length, 2);
  assert.strictEqual(evs[0].real, -1);
  assert.strictEqual(evs[1].real, -2);
});

test("MatrixStorage formats LaTeX, CSV, and handles presets", () => {
  const presets = storage.getPresets();
  assert.ok(presets.identity3);

  const presetMat = storage.getPreset("identity3");
  assert.strictEqual(presetMat.length, 3);

  const latex = storage.toLaTeX([
    [1, 2],
    [3, 4],
  ]);
  assert.ok(latex.includes("\\begin{bmatrix}"));
  assert.ok(latex.includes("1 & 2 \\\\"));

  const csv = storage.toCSV([
    [1, 2],
    [3, 4],
  ]);
  assert.strictEqual(csv, "1,2\n3,4");
});

test("MatrixEngine computes step-by-step Gauss-Jordan row reduction", () => {
  const A = [
    [2, 1],
    [4, 5],
  ];

  const steps = engine.gaussJordanSteps(A);
  assert.ok(steps.length > 1);
  assert.strictEqual(steps[0].type, "initial");
  assert.strictEqual(steps[steps.length - 1].type, "complete");

  const finalMatrix = steps[steps.length - 1].matrix;
  assert.deepStrictEqual(finalMatrix, [
    [1, 0],
    [0, 1],
  ]);

  // Test singular matrix reduction
  const singular = [
    [1, 2],
    [2, 4],
  ];
  const singularSteps = engine.gaussJordanSteps(singular);
  const singularFinal = singularSteps[singularSteps.length - 1].matrix;
  assert.deepStrictEqual(singularFinal, [
    [1, 2],
    [0, 0],
  ]);

  // Check step annotation and properties
  const scaleOrElimStep = steps.find(s => s.type === "eliminate" || s.type === "scale");
  assert.ok(scaleOrElimStep);
  assert.ok(typeof scaleOrElimStep.annotation === "string");
  assert.ok(Array.isArray(scaleOrElimStep.activeRows));
});

test("MatrixEngine computes characteristic polynomial for 2x2 and 3x3 matrices", () => {
  const A2 = [
    [2, 1],
    [1, 2],
  ];
  const poly2 = engine.characteristicPolynomial(A2);
  assert.strictEqual(poly2.degree, 2);
  assert.strictEqual(poly2.trace, 4);
  assert.strictEqual(poly2.determinant, 3);
  assert.ok(poly2.equation.includes("λ²"));
  assert.ok(poly2.equation.includes("4λ"));
  assert.ok(poly2.equation.includes("3"));

  const A3 = [
    [3, 0, 0],
    [0, 2, 0],
    [0, 0, 1],
  ];
  const poly3 = engine.characteristicPolynomial(A3);
  assert.strictEqual(poly3.degree, 3);
  assert.strictEqual(poly3.trace, 6);
  assert.strictEqual(poly3.determinant, 6);
  assert.ok(poly3.equation.includes("λ³"));
});

test("MatrixEngine calculates eigenvectors for 2x2 and 3x3 matrices", () => {
  const A = [
    [2, 1],
    [1, 2],
  ];
  const evs = engine.eigenvalues(A);
  const evecs = engine.eigenvectors(A, evs);

  assert.strictEqual(evecs.length, 2);
  assert.strictEqual(evecs[0].isComplex, false);
  assert.strictEqual(evecs[1].isComplex, false);

  // Check Av = λv for first eigenvalue
  const lambda1 = evecs[0].eigenvalue.real;
  const v1 = evecs[0].normalized;
  const Av1 = [
    A[0][0] * v1[0] + A[0][1] * v1[1],
    A[1][0] * v1[0] + A[1][1] * v1[1],
  ];
  assert.ok(Math.abs(Av1[0] - lambda1 * v1[0]) < 1e-4);
  assert.ok(Math.abs(Av1[1] - lambda1 * v1[1]) < 1e-4);
});

test("MatrixEngine performs full Eigenvalue Decomposition (A = V·Λ·V⁻¹)", () => {
  const A = [
    [2, 1],
    [1, 2],
  ];
  const decomp = engine.eigenDecomposition(A);

  assert.strictEqual(decomp.isDiagonalizable, true);
  assert.ok(decomp.V);
  assert.ok(decomp.Lambda);
  assert.ok(decomp.Vinv);
  assert.ok(decomp.reconstructed);

  // Reconstructed matrix must closely match original A
  assert.strictEqual(Math.round(decomp.reconstructed[0][0]), 2);
  assert.strictEqual(Math.round(decomp.reconstructed[0][1]), 1);
  assert.strictEqual(Math.round(decomp.reconstructed[1][0]), 1);
  assert.strictEqual(Math.round(decomp.reconstructed[1][1]), 2);

  // Defective / non-diagonalizable matrix test
  const defective = [
    [1, 1],
    [0, 1],
  ];
  const defDecomp = engine.eigenDecomposition(defective);
  assert.strictEqual(defDecomp.isDiagonalizable, false);
});

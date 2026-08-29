// ---- GRID SETUP ----
// The avatar is drawn on a 16x16 grid of square "pixels".
const GRID_SIZE = 16;
const CANVAS_SIZE = 200;
const PIXEL_SIZE = CANVAS_SIZE / GRID_SIZE;

// ---- FACE SHAPE ----
// Rounder, more proportional head outline (narrow at top/chin, wide in middle)
const faceRows = {
  2: [7, 8],
  3: [6, 9],
  4: [5, 10],
  5: [4, 11],
  6: [4, 11],
  7: [3, 12],
  8: [3, 12],
  9: [3, 12],
  10: [4, 11],
  11: [4, 11],
  12: [5, 10],
  13: [6, 9],
  14: [7, 8],
};

// ---- HAIR STYLES ----
const hairStyles = [
  // 0: Bowl Cut — solid cap on top + full bangs + sideburns
  [
    [1, 7],
    [1, 8],
    [2, 6],
    [2, 7],
    [2, 8],
    [2, 9],
    [3, 5],
    [3, 6],
    [3, 7],
    [3, 8],
    [3, 9],
    [3, 10],
    [4, 4],
    [4, 5],
    [4, 6],
    [4, 7],
    [4, 8],
    [4, 9],
    [4, 10],
    [4, 11],
    [5, 4],
    [5, 11],
  ],
  // 1: Spiky — built from a zigzag of column heights, so each spike is a
  // solid triangular column connected to the head (not floating dots).
  // topRow[col] = how high that column's spike goes; it fills down to
  // row 5 (base), giving a continuous, connected spiky silhouette.
  (() => {
    const topRowByCol = {
      4: 3,
      5: 4,
      6: 2,
      7: 0,
      8: 0,
      9: 2,
      10: 4,
      11: 3,
    };
    const pixels = [];
    for (const col in topRowByCol) {
      for (let row = topRowByCol[col]; row <= 5; row++) {
        pixels.push([row, parseInt(col)]);
      }
    }
    return pixels;
  })(),
  // 2: Bald
  [],
];

// Facial features
const eyePositions = [
  [9, 5],
  [9, 10],
];
const mouthPositions = [
  [12, 7],
  [12, 8],
];
// Light blush pixels on cheeks for a friendlier look
const blushPositions = [
  [10, 4],
  [10, 11],
];

// ---- DOM REFERENCES ----
const svg = document.getElementById("avatar-svg");
const bgColorInput = document.getElementById("bg-color");
const skinColorInput = document.getElementById("skin-color");
const hairColorInput = document.getElementById("hair-color");
const hairStyleInput = document.getElementById("hair-style");
const randomizeBtn = document.getElementById("randomize-btn");
const downloadBtn = document.getElementById("download-btn");

function drawPixel(row, col, color) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", col * PIXEL_SIZE);
  rect.setAttribute("y", row * PIXEL_SIZE);
  rect.setAttribute("width", PIXEL_SIZE);
  rect.setAttribute("height", PIXEL_SIZE);
  rect.setAttribute("fill", color);
  svg.appendChild(rect);
}

// Rebuilds the entire avatar from scratch, in careful layer order:
// background -> face -> blush -> hair -> mouth -> eyes
function renderAvatar() {
  if (typeof AvatarEngine !== "undefined" && AvatarEngine.generateAvatarSVG) {
    const svgMarkup = AvatarEngine.generateAvatarSVG({
      bgColor: bgColorInput.value,
      skinColor: skinColorInput.value,
      hairColor: hairColorInput.value,
      hairStyle: hairStyleInput.value,
    });
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
    const newSvg = doc.querySelector("svg");
    svg.innerHTML = newSvg ? newSvg.innerHTML : "";
    return;
  }
  svg.innerHTML = "";

  const bgColor = bgColorInput.value;
  const skinColor = skinColorInput.value;
  const hairColor = hairColorInput.value;
  const styleIndex = parseInt(hairStyleInput.value);

  // 1. Background
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      drawPixel(row, col, bgColor);
    }
  }

  // 2. Face
  for (const row in faceRows) {
    const [startCol, endCol] = faceRows[row];
    for (let col = startCol; col <= endCol; col++) {
      drawPixel(parseInt(row), col, skinColor);
    }
  }

  // 3. Blush
  blushPositions.forEach(([row, col]) => {
    drawPixel(row, col, "#ff9a9a");
  });

  // 4. Hair
  hairStyles[styleIndex].forEach(([row, col]) => {
    drawPixel(row, col, hairColor);
  });

  // 5. Mouth
  mouthPositions.forEach(([row, col]) => {
    drawPixel(row, col, "#7a4a3a");
  });

  // 6. Eyes
  eyePositions.forEach(([row, col]) => {
    drawPixel(row, col, "#000000");
  });
}

// ---- EVENT LISTENERS ----
bgColorInput.addEventListener("input", renderAvatar);
skinColorInput.addEventListener("input", renderAvatar);
hairColorInput.addEventListener("input", renderAvatar);
hairStyleInput.addEventListener("change", renderAvatar);

// ---- RANDOMIZE ----
function randomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

randomizeBtn.addEventListener("click", () => {
  bgColorInput.value = randomColor();
  skinColorInput.value = randomColor();
  hairColorInput.value = randomColor();
  hairStyleInput.value = Math.floor(Math.random() * hairStyles.length);
  renderAvatar();
});

// ---- DOWNLOAD AS PNG ----
downloadBtn.addEventListener("click", () => {
  const svgData = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    const pngUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "my-pixel-avatar.png";
    link.href = pngUrl;
    link.click();
  };

  img.src = url;
});

// ---- FILE IMPORT AND VALIDATION ----
const importSvgInput = document.getElementById("import-svg-input");
const errorMessage = document.getElementById("error-message");

if (importSvgInput) {
  importSvgInput.addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target.result;
      try {
        if (typeof AvatarEngine !== "undefined" && AvatarEngine.validateSVG) {
          AvatarEngine.validateSVG(content, file.size, file.type, file.name);
        }

        errorMessage.textContent = "";
        errorMessage.style.display = "none";

        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "image/svg+xml");
        const newSvg = doc.querySelector("svg");
        svg.innerHTML = newSvg ? newSvg.innerHTML : "";
      } catch (err) {
        errorMessage.textContent = err.message || "Invalid SVG file.";
        errorMessage.style.display = "block";
        importSvgInput.value = ""; // reset input
      }
    };
    reader.onerror = () => {
      errorMessage.textContent = "Failed to read file.";
      errorMessage.style.display = "block";
      importSvgInput.value = "";
    };
    reader.readAsText(file);
  });
}

// ---- INITIAL RENDER ----
renderAvatar();

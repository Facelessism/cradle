// --- MEME GENERATOR CONTROLLER & EVENT HANDLERS ---
const canvas = document.getElementById("memeCanvas");
const hiddenImg = document.getElementById("memeHiddenImg");
const loadBtn = document.getElementById("loadBtn");
const savePresetBtn = document.getElementById("savePresetBtn");
const downloadBtn = document.getElementById("downloadBtn");
const fileUpload = document.getElementById("fileUpload");

const inputTopText = document.getElementById("inputTopText");
const inputBottomText = document.getElementById("inputBottomText");
const inputFontSize = document.getElementById("inputFontSize");
const fontSizeVal = document.getElementById("fontSizeVal");
const inputTextColor = document.getElementById("inputTextColor");
const inputStrokeColor = document.getElementById("inputStrokeColor");
const presetsList = document.getElementById("presetsList");

let currentImgUrl = "https://i.imgflip.com/1g8my4.jpg"; // fallback starter meme
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function getOptionsFromUI() {
  return {
    topText: inputTopText.value,
    bottomText: inputBottomText.value,
    fontSize: parseInt(inputFontSize.value, 10),
    textColor: inputTextColor.value,
    strokeColor: inputStrokeColor.value,
    strokeWidth: Math.max(2, Math.floor(parseInt(inputFontSize.value, 10) / 9)),
  };
}

function updateMeme() {
  if (fontSizeVal) fontSizeVal.textContent = inputFontSize.value;
  renderMemeCanvas(canvas, hiddenImg, getOptionsFromUI());
}

function loadMemeFromUrl(url) {
  currentImgUrl = url;
  hiddenImg.crossOrigin = "anonymous";
  hiddenImg.src = url;
  hiddenImg.onload = () => {
    updateMeme();
  };
  hiddenImg.onerror = () => {
    console.warn(
      "Failed to load cross-origin image cleanly, falling back to direct render"
    );
    updateMeme();
  };
}

async function fetchRandomMeme() {
  try {
    loadBtn.disabled = true;
    const response = await fetch("https://meme-api.com/gimme");
    if (!response.ok) throw new Error("Failed to fetch meme");
    const data = await response.json();
    loadMemeFromUrl(data.url);
  } catch (error) {
    console.error("Meme API Error:", error);
    loadMemeFromUrl("https://i.imgflip.com/1g8my4.jpg");
  } finally {
    loadBtn.disabled = false;
  }
}

function renderPresetsUI() {
  if (!presetsList) return;
  const presets = getSavedMemes();
  if (typeof presetsList.replaceChildren === "function") {
    presetsList.replaceChildren();
  } else {
    while (presetsList.firstChild) {
      presetsList.removeChild(presetsList.firstChild);
    }
  }

  if (presets.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "empty-presets";
    emptyMsg.textContent =
      'No saved presets yet. Customize text and click "Save Preset".';
    presetsList.appendChild(emptyMsg);
    return;
  }

  presets.forEach(p => {
    const item = document.createElement("div");
    item.className = "preset-card";

    const infoDiv = document.createElement("div");
    infoDiv.className = "preset-info";

    const strongEl = document.createElement("strong");
    strongEl.textContent = `"${p.topText || ""}"`;

    const spanEl = document.createElement("span");
    spanEl.textContent = p.bottomText || "";

    infoDiv.appendChild(strongEl);
    infoDiv.appendChild(spanEl);

    const actionsDiv = document.createElement("div");
    actionsDiv.className = "preset-actions";

    const loadBtn = document.createElement("button");
    loadBtn.className = "btn-sm load-preset-btn";
    loadBtn.textContent = "Load";
    loadBtn.addEventListener("click", () => {
      inputTopText.value = p.topText || "";
      inputBottomText.value = p.bottomText || "";
      inputFontSize.value = p.fontSize || 36;
      inputTextColor.value = p.textColor || "#FFFFFF";
      inputStrokeColor.value = p.strokeColor || "#000000";
      updateMeme();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-sm delete-preset-btn";
    deleteBtn.textContent = "\u00D7";
    deleteBtn.addEventListener("click", () => {
      deleteMemePreset(p.id);
      renderPresetsUI();
    });

    actionsDiv.appendChild(loadBtn);
    actionsDiv.appendChild(deleteBtn);

    item.appendChild(infoDiv);
    item.appendChild(actionsDiv);

    presetsList.appendChild(item);
  });
}

// Event Bindings
[
  inputTopText,
  inputBottomText,
  inputFontSize,
  inputTextColor,
  inputStrokeColor,
].forEach(el => {
  if (el) el.addEventListener("input", updateMeme);
});

if (fileUpload) {
  fileUpload.addEventListener("change", e => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    const MAX_IMAGE_WIDTH = 4096;
    const MAX_IMAGE_HEIGHT = 4096;

    // Check actual file size before reading the file.
    if (file.size > MAX_IMAGE_SIZE) {
      showError(
        `Image is too large (${(file.size / (1024 * 1024)).toFixed(
          2
        )} MB). Maximum allowed file size is 5 MB.`
      );

      e.target.value = "";
      return;
    }

    // Check file type.
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      showError(
        "Invalid image type. Please upload a JPEG, PNG, WebP, or GIF image."
      );

      e.target.value = "";
      return;
    }

    // Check image dimensions before actually loading it into the meme.
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;

      URL.revokeObjectURL(objectUrl);

      if (
        width > MAX_IMAGE_WIDTH ||
        height > MAX_IMAGE_HEIGHT
      ) {
        showError(
          `Image resolution is too high (${width} × ${height}px). Maximum allowed resolution is ${MAX_IMAGE_WIDTH} × ${MAX_IMAGE_HEIGHT}px.`
        );

        e.target.value = "";
        return;
      }

      // Only load the image after ALL validation passes.
      const reader = new FileReader();

      reader.onload = event => {
        loadMemeFromUrl(event.target.result);
      };

      reader.onerror = () => {
        showError("Unable to read the selected image.");
      };

      reader.readAsDataURL(file);

      // Allows selecting the same file again.
      e.target.value = "";
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);

      showError(
        "Unable to validate the selected image. Please choose a valid image."
      );

      e.target.value = "";
    };

    img.src = objectUrl;
  });
}

if (loadBtn) loadBtn.addEventListener("click", fetchRandomMeme);

if (savePresetBtn) {
  savePresetBtn.addEventListener("click", () => {
    saveMemePreset(getOptionsFromUI());
    renderPresetsUI();
  });
}

let errorTimeout;
function showError(msg) {
  const container = document.getElementById("errorContainer");
  const message = document.getElementById("errorMessage");
  if (container && message) {
    message.textContent = msg;
    container.style.display = "flex";
    clearTimeout(errorTimeout);
    errorTimeout = setTimeout(() => {
      container.style.display = "none";
    }, 5000);
  }
}

if (downloadBtn) {
  downloadBtn.addEventListener("click", () => {
    try {
      const dataUrl = exportMemeCanvas(canvas);
      const link = document.createElement("a");

      link.download = `meme-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Meme export failed:", e);
      showError(
        e.message ||
          "To download cross-origin images, upload a local image or host on same origin."
      );
    }
  });
}

// Initial Kickoff
loadMemeFromUrl(currentImgUrl);
renderPresetsUI();


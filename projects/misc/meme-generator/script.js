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
  if (presets.length === 0) {
    presetsList.innerHTML = `<p class="empty-presets">No saved presets yet. Customize text and click "Save Preset".</p>`;
    return;
  }

  presetsList.innerHTML = "";
  presets.forEach(p => {
    const item = document.createElement("div");
    item.className = "preset-card";
    // Static skeleton only — the preset text is user-controlled and must be
    // inserted as text (textContent), never interpolated into innerHTML, or a
    // saved preset like `<img src=x onerror=...>` would execute on render.
    item.innerHTML = `
            <div class="preset-info">
                <strong></strong>
                <span></span>
            </div>
            <div class="preset-actions">
                <button class="btn-sm load-preset-btn">Load</button>
                <button class="btn-sm delete-preset-btn">&times;</button>
            </div>
        `;
    item.querySelector(".preset-info strong").textContent = `"${p.topText || ""}"`;
    item.querySelector(".preset-info span").textContent = p.bottomText || "";

    item.querySelector(".load-preset-btn").addEventListener("click", () => {
      inputTopText.value = p.topText || "";
      inputBottomText.value = p.bottomText || "";
      inputFontSize.value = p.fontSize || 36;
      inputTextColor.value = p.textColor || "#FFFFFF";
      inputStrokeColor.value = p.strokeColor || "#000000";
      updateMeme();
    });

    item.querySelector(".delete-preset-btn").addEventListener("click", () => {
      deleteMemePreset(p.id);
      renderPresetsUI();
    });

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
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = event => {
        loadMemeFromUrl(event.target.result);
      };
      reader.readAsDataURL(file);
    }
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
      const link = document.createElement("a");
      link.download = `meme-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      showError(
        "To download cross-origin images, upload a local image or host on same origin."
      );
    }
  });
}

// Initial Kickoff
loadMemeFromUrl(currentImgUrl);
renderPresetsUI();

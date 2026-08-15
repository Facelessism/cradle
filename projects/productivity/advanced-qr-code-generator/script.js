/* =========================================================
   ADVANCED QR CODE GENERATOR — APP LOGIC
   Uses: qr-code-styling library (loaded globally as QRCodeStyling)
   ========================================================= */

"use strict";

/* ---------------------- DOM REFERENCES ---------------------- */
const hasDocument = typeof document !== "undefined";
const getElement = id => (hasDocument ? document.getElementById(id) : null);

const el = {
  themeToggle: getElement("theme-toggle"),
  themeIcon: getElement("theme-icon"),
  textInput: getElement("qr-text"),
  fgColor: getElement("fg-color"),
  fgColorText: getElement("fg-color-text"),
  bgColor: getElement("bg-color"),
  bgColorText: getElement("bg-color-text"),
  size: getElement("qr-size"),
  sizeValue: getElement("size-value"),
  margin: getElement("qr-margin"),
  marginValue: getElement("margin-value"),
  errorLevel: getElement("error-level"),
  logoUpload: getElement("logo-upload"),
  uploadText: getElement("upload-text"),
  removeLogoBtn: getElement("remove-logo-btn"),
  downloadPngBtn: getElement("download-png-btn"),
  downloadSvgBtn: getElement("download-svg-btn"),
  copyImageBtn: getElement("copy-image-btn"),
  resetBtn: getElement("reset-btn"),
  qrContainer: getElement("qr-code-container"),
  emptyState: getElement("empty-state"),
  toastContainer: getElement("toast-container"),
};

/* ---------------------- DEFAULT STATE ---------------------- */
const DEFAULTS = Object.freeze({
  text: "",
  fgColor: "#2B2D42",
  bgColor: "#FFFFFF",
  size: 300,
  margin: 10,
  errorLevel: "M",
  logo: null,
});

let state = { ...DEFAULTS };
let qrCode = null; // QRCodeStyling instance
let debounceTimer = null;

function addListener(target, eventName, handler, options) {
  if (target) {
    target.addEventListener(eventName, handler, options);
  }
}

/* ---------------------- THEME (LIGHT / DARK) ---------------------- */

/** Apply a theme and persist the choice */
function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    el.themeIcon.classList.remove("fa-moon");
    el.themeIcon.classList.add("fa-sun");
    el.themeToggle.setAttribute("aria-pressed", "true");
  } else {
    document.documentElement.removeAttribute("data-theme");
    el.themeIcon.classList.remove("fa-sun");
    el.themeIcon.classList.add("fa-moon");
    el.themeToggle.setAttribute("aria-pressed", "false");
  }
  localStorage.setItem("theme", theme);
}

/** Initialize theme from saved preference or system setting */
function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved) {
    applyTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

addListener(el.themeToggle, "click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  applyTheme(isDark ? "light" : "dark");
});

/* ---------------------- UTILITIES ---------------------- */

/** Debounce helper for live-typing input */
function debounce(fn, delay = 200) {
  return (...args) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn(...args), delay);
  };
}

/** Validate a hex color string */
function isValidHex(hex) {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

/** Show a toast notification */
function showToast(message, type = "info") {
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info",
  };

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i><span>${message}</span>`;

  el.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");
    toast.addEventListener("animationend", () => toast.remove(), {
      once: true,
    });
  }, 3200);
}

/** Enable/disable export buttons based on whether a QR exists */
function toggleExportButtons(enabled) {
  el.downloadPngBtn.disabled = !enabled;
  el.downloadSvgBtn.disabled = !enabled;
  el.copyImageBtn.disabled = !enabled;
}

/** Ripple effect for buttons */
function attachRippleEffect() {
  document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("click", function (e) {
      if (this.disabled) return;
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height);
      ripple.className = "ripple";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
}

/* ---------------------- QR GENERATION ---------------------- */

/** Build qr-code-styling options object from current state */
function buildQrOptions() {
  if (typeof QREngine !== "undefined" && typeof QREngine.buildConfigPayload === "function") {
    return QREngine.buildConfigPayload(state);
  }
  return {
    width: qrState.size,
    height: qrState.size,
    data: qrState.text,
    margin: qrState.margin,
    qrOptions: {
      errorCorrectionLevel: qrState.errorLevel,
    },
    dotsOptions: {
      color: qrState.fgColor,
      type: "rounded",
    },
    cornersSquareOptions: {
      color: qrState.fgColor,
      type: "extra-rounded",
    },
    cornersDotOptions: {
      color: qrState.fgColor,
      type: "dot",
    },
    backgroundOptions: {
      color: qrState.bgColor,
    },
    image: qrState.logo || undefined,
    imageOptions: {
      crossOrigin: "anonymous",
      margin: 6,
      imageSize: 0.4,
    },
  };
}

/** Show the empty/validation state and hide the QR */
function showEmptyState() {
  el.emptyState.hidden = false;
  el.emptyState.style.display = "flex";
  el.qrContainer.hidden = true;
  el.qrContainer.innerHTML = "";
  toggleExportButtons(false);
}

/** Main function: generate or update the QR code preview */
function generateQRCode() {
  const text = state.text.trim();

  // Validation: don't generate if input is empty
  if (!shouldGenerateQRCode(text)) {
    showEmptyState();
    return;
  }

  try {
    const options = buildQrOptions();

    // Hide empty state completely once QR generation starts
    el.emptyState.hidden = true;
    el.emptyState.style.display = "none";

    if (!qrCode) {
      qrCode = new QRCodeStyling(options);
      el.qrContainer.innerHTML = "";
      qrCode.append(el.qrContainer);
    } else {
      qrCode.update(options);
    }

    el.qrContainer.hidden = false;

    // Restart the subtle fade-in animation
    el.qrContainer.classList.remove("qr-code-container");
    void el.qrContainer.offsetWidth;
    el.qrContainer.classList.add("qr-code-container");

    toggleExportButtons(true);
  } catch (err) {
    showEmptyState();
    showToast("Something went wrong generating the QR code.", "error");
    console.error("QR generation error:", err);
  }
}

const debouncedGenerate = debounce(generateQRCode, 200);

/* ---------------------- EVENT HANDLERS ---------------------- */

/** Text input — live generation */
addListener(el.textInput, "input", e => {
  state.text = e.target.value;
  debouncedGenerate();
});

/** Foreground color — swatch + text field sync */
addListener(el.fgColor, "input", e => {
  state.fgColor = e.target.value;
  el.fgColorText.value = e.target.value.toUpperCase();
  debouncedGenerate();
});

addListener(el.fgColorText, "input", e => {
  const value = e.target.value;
  if (isValidHex(value)) {
    state.fgColor = value;
    el.fgColor.value = value;
    debouncedGenerate();
  }
});

/** Background color — swatch + text field sync */
addListener(el.bgColor, "input", e => {
  state.bgColor = e.target.value;
  el.bgColorText.value = e.target.value.toUpperCase();
  debouncedGenerate();
});

addListener(el.bgColorText, "input", e => {
  const value = e.target.value;
  if (isValidHex(value)) {
    state.bgColor = value;
    el.bgColor.value = value;
    debouncedGenerate();
  }
});

/** Size slider */
addListener(el.size, "input", e => {
  state.size = parseInt(e.target.value, 10);
  el.sizeValue.textContent = `${state.size}px`;
  debouncedGenerate();
});

/** Margin slider */
addListener(el.margin, "input", e => {
  state.margin = parseInt(e.target.value, 10);
  el.marginValue.textContent = `${state.margin}px`;
  debouncedGenerate();
});

/** Error correction level */
addListener(el.errorLevel, "change", e => {
  state.errorLevel = e.target.value;
  debouncedGenerate();
});

/** Logo upload */
addListener(el.logoUpload, "change", e => {
  const file = e.target.files[0];
  if (!file) return;

  if (!isValidLogoType(file.type)) {
    showToast("Please upload a PNG, JPG, JPEG, or SVG file.", "error");
    el.logoUpload.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = event => {
    state.logo = event.target.result;
    el.uploadText.textContent = file.name;
    el.removeLogoBtn.disabled = false;
    generateQRCode();
    showToast("Logo added to your QR code!", "success");
  };
  reader.onerror = () => {
    showToast("Failed to read the logo file.", "error");
  };
  reader.readAsDataURL(file);
});

/** Remove logo */
addListener(el.removeLogoBtn, "click", () => {
  state.logo = null;
  el.logoUpload.value = "";
  el.uploadText.textContent = "Click to upload logo";
  el.removeLogoBtn.disabled = true;
  generateQRCode();
  showToast("Logo removed.", "info");
});

/** Download PNG */
addListener(el.downloadPngBtn, "click", async () => {
  if (!qrCode || !state.text.trim()) return;
  try {
    await qrCode.download({ name: "qr-code", extension: "png" });
    showToast("PNG downloaded successfully!", "success");
  } catch (err) {
    showToast("Failed to download PNG.", "error");
    console.error(err);
  }
});

/** Download SVG */
addListener(el.downloadSvgBtn, "click", async () => {
  if (!qrCode || !state.text.trim()) return;
  try {
    await qrCode.download({ name: "qr-code", extension: "svg" });
    showToast("SVG downloaded successfully!", "success");
  } catch (err) {
    showToast("Failed to download SVG.", "error");
    console.error(err);
  }
});

/** Copy QR image to clipboard */
addListener(el.copyImageBtn, "click", async () => {
  if (!qrCode || !state.text.trim()) return;

  const canvas = el.qrContainer.querySelector("canvas");

  if (!canvas) {
    showToast("Unable to copy image right now.", "error");
    return;
  }

  if (!navigator.clipboard || !window.ClipboardItem) {
    showToast(
      "Clipboard image copy is not supported in this browser.",
      "error"
    );
    return;
  }

  try {
    canvas.toBlob(async blob => {
      if (!blob) {
        showToast("Failed to prepare image for copying.", "error");
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      showToast("QR image copied to clipboard!", "success");
    }, "image/png");
  } catch (err) {
    showToast("Failed to copy image to clipboard.", "error");
    console.error(err);
  }
});

/** Reset everything to defaults */
addListener(el.resetBtn, "click", () => {
  state = { ...DEFAULTS };

  el.textInput.value = "";
  el.fgColor.value = DEFAULTS.fgColor;
  el.fgColorText.value = DEFAULTS.fgColor;
  el.bgColor.value = DEFAULTS.bgColor;
  el.bgColorText.value = DEFAULTS.bgColor;
  el.size.value = DEFAULTS.size;
  el.sizeValue.textContent = `${DEFAULTS.size}px`;
  el.margin.value = DEFAULTS.margin;
  el.marginValue.textContent = `${DEFAULTS.margin}px`;
  el.errorLevel.value = DEFAULTS.errorLevel;
  el.logoUpload.value = "";
  el.uploadText.textContent = "Click to upload logo";
  el.removeLogoBtn.disabled = true;

  qrCode = null;
  showEmptyState();
  showToast("Everything has been reset.", "info");
});

/* ---------------------- KEYBOARD ACCESSIBILITY ---------------------- */

/** Allow Enter/Space on upload label to trigger file dialog */
if (hasDocument) {
  const uploadLabel = document.querySelector(".upload-label");

  addListener(uploadLabel, "keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      el.logoUpload.click();
    }
  });
}

function shouldGenerateQRCode(text) {
  return typeof text === "string" && text.trim().length > 0;
}

function isValidLogoType(type) {
  return ["image/png", "image/jpeg", "image/svg+xml"].includes(type);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    DEFAULTS,
    buildQrOptions,
    isValidHex,
    isValidLogoType,
    shouldGenerateQRCode,
  };
}

if (hasDocument) {
  /* ---------------------- INIT ---------------------- */
  function init() {
    initTheme();
    attachRippleEffect();
    showEmptyState();
  }

  document.addEventListener("DOMContentLoaded", init);
}

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
  fillType: getElement("fill-type"),
  fgColor: getElement("fg-color"),
  fgColorText: getElement("fg-color-text"),
  bgColor: getElement("bg-color"),
  bgColorText: getElement("bg-color-text"),
  gradientControlsWrap: getElement("gradient-controls-wrap"),
  gradientColor1: getElement("gradient-color-1"),
  gradientColor1Text: getElement("gradient-color-1-text"),
  gradientColor2: getElement("gradient-color-2"),
  gradientColor2Text: getElement("gradient-color-2-text"),
  gradientRotation: getElement("gradient-rotation"),
  gradientRotationValue: getElement("gradient-rotation-value"),
  dotStyle: getElement("dot-style"),
  cornerSquareStyle: getElement("corner-square-style"),
  cornerDotStyle: getElement("corner-dot-style"),
  size: getElement("qr-size"),
  sizeValue: getElement("size-value"),
  margin: getElement("qr-margin"),
  marginValue: getElement("margin-value"),
  errorLevel: getElement("error-level"),
  errorElevationBadge: getElement("error-elevation-badge"),
  logoUpload: getElement("logo-upload"),
  uploadText: getElement("upload-text"),
  logoSize: getElement("logo-size"),
  logoSizeValue: getElement("logo-size-value"),
  removeLogoBtn: getElement("remove-logo-btn"),
  exportResolution: getElement("export-resolution"),
  downloadPngBtn: getElement("download-png-btn"),
  downloadSvgBtn: getElement("download-svg-btn"),
  downloadEpsBtn: getElement("download-eps-btn"),
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
  dotStyle: "rounded",
  cornerSquareStyle: "extra-rounded",
  cornerDotStyle: "dot",
  gradientEnabled: false,
  gradientType: "linear",
  gradientColor1: "#2B2D42",
  gradientColor2: "#6366F1",
  gradientRotation: 0,
  logo: null,
  logoSize: 0.3,
  logoMargin: 6,
  exportResolution: 4000,
});

let state = { ...DEFAULTS };
let previousUserErrorLevel = "M";
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
  const icon = document.createElement("i");
  icon.className = `fa-solid ${icons[type] || "fa-circle-info"}`;
  const span = document.createElement("span");
  span.textContent = message;
  toast.append(icon, span);

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
  if (el.downloadPngBtn) el.downloadPngBtn.disabled = !enabled;
  if (el.downloadSvgBtn) el.downloadSvgBtn.disabled = !enabled;
  if (el.downloadEpsBtn) el.downloadEpsBtn.disabled = !enabled;
  if (el.copyImageBtn) el.copyImageBtn.disabled = !enabled;
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
  if (
    typeof QREngine !== "undefined" &&
    typeof QREngine.buildConfigPayload === "function"
  ) {
    return QREngine.buildConfigPayload(state);
  }
  return {
    width: state.size,
    height: state.size,
    data: state.text,
    margin: state.margin,
    qrOptions: {
      errorCorrectionLevel: state.logo ? "H" : state.errorLevel,
    },
    dotsOptions: {
      color: state.fgColor,
      type: state.dotStyle === "diamond" ? "dots" : state.dotStyle,
    },
    cornersSquareOptions: {
      color: state.fgColor,
      type: state.cornerSquareStyle,
    },
    cornersDotOptions: {
      color: state.fgColor,
      type: state.cornerDotStyle,
    },
    backgroundOptions: {
      color: state.bgColor,
    },
    image: state.logo || undefined,
    imageOptions: {
      crossOrigin: "anonymous",
      margin: state.logoMargin || 6,
      imageSize: state.logoSize || 0.3,
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
    options.type = "svg"; // Vector SVG preview

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

    // Apply diamond geometry post-processing if diamond dots requested
    if (state.dotStyle === "diamond") {
      setTimeout(() => {
        const svgEl = el.qrContainer
          ? el.qrContainer.querySelector("svg")
          : null;
        if (
          svgEl &&
          typeof QREngine !== "undefined" &&
          typeof QREngine.applyDiamondGeometry === "function"
        ) {
          const raw = svgEl.outerHTML;
          if (!raw.includes("<polygon")) {
            el.qrContainer.innerHTML = QREngine.applyDiamondGeometry(raw);
          }
        }
      }, 50);
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

/** Fill type selector (Solid / Linear Gradient / Radial Gradient) */
addListener(el.fillType, "change", e => {
  const val = e.target.value;
  state.gradientEnabled = val !== "solid";
  if (state.gradientEnabled) {
    state.gradientType = val;
    if (el.gradientControlsWrap) el.gradientControlsWrap.hidden = false;
  } else {
    if (el.gradientControlsWrap) el.gradientControlsWrap.hidden = true;
  }
  debouncedGenerate();
});

/** Foreground color — swatch + text field sync */
addListener(el.fgColor, "input", e => {
  state.fgColor = e.target.value;
  if (el.fgColorText) el.fgColorText.value = e.target.value.toUpperCase();
  debouncedGenerate();
});

addListener(el.fgColorText, "input", e => {
  const value = e.target.value;
  if (isValidHex(value)) {
    state.fgColor = value;
    if (el.fgColor) el.fgColor.value = value;
    debouncedGenerate();
  }
});

/** Background color — swatch + text field sync */
addListener(el.bgColor, "input", e => {
  state.bgColor = e.target.value;
  if (el.bgColorText) el.bgColorText.value = e.target.value.toUpperCase();
  debouncedGenerate();
});

addListener(el.bgColorText, "input", e => {
  const value = e.target.value;
  if (isValidHex(value)) {
    state.bgColor = value;
    if (el.bgColor) el.bgColor.value = value;
    debouncedGenerate();
  }
});

/** Gradient Color 1 */
addListener(el.gradientColor1, "input", e => {
  state.gradientColor1 = e.target.value;
  if (el.gradientColor1Text)
    el.gradientColor1Text.value = e.target.value.toUpperCase();
  debouncedGenerate();
});

addListener(el.gradientColor1Text, "input", e => {
  const val = e.target.value;
  if (isValidHex(val)) {
    state.gradientColor1 = val;
    if (el.gradientColor1) el.gradientColor1.value = val;
    debouncedGenerate();
  }
});

/** Gradient Color 2 */
addListener(el.gradientColor2, "input", e => {
  state.gradientColor2 = e.target.value;
  if (el.gradientColor2Text)
    el.gradientColor2Text.value = e.target.value.toUpperCase();
  debouncedGenerate();
});

addListener(el.gradientColor2Text, "input", e => {
  const val = e.target.value;
  if (isValidHex(val)) {
    state.gradientColor2 = val;
    if (el.gradientColor2) el.gradientColor2.value = val;
    debouncedGenerate();
  }
});

/** Gradient Rotation */
addListener(el.gradientRotation, "input", e => {
  state.gradientRotation = parseInt(e.target.value, 10);
  if (el.gradientRotationValue)
    el.gradientRotationValue.textContent = `${state.gradientRotation}°`;
  debouncedGenerate();
});

/** Dot Style Selector */
addListener(el.dotStyle, "change", e => {
  state.dotStyle = e.target.value;
  debouncedGenerate();
});

/** Corner Square Style Selector */
addListener(el.cornerSquareStyle, "change", e => {
  state.cornerSquareStyle = e.target.value;
  debouncedGenerate();
});

/** Corner Dot Style Selector */
addListener(el.cornerDotStyle, "change", e => {
  state.cornerDotStyle = e.target.value;
  debouncedGenerate();
});

/** Size slider */
addListener(el.size, "input", e => {
  state.size = parseInt(e.target.value, 10);
  if (el.sizeValue) el.sizeValue.textContent = `${state.size}px`;
  debouncedGenerate();
});

/** Margin slider */
addListener(el.margin, "input", e => {
  state.margin = parseInt(e.target.value, 10);
  if (el.marginValue) el.marginValue.textContent = `${state.margin}px`;
  debouncedGenerate();
});

/** Error correction level */
addListener(el.errorLevel, "change", e => {
  state.errorLevel = e.target.value;
  if (!state.logo) {
    previousUserErrorLevel = e.target.value;
  } else if (e.target.value !== "H") {
    showToast(
      "Note: Center logo requires Level H (30%) for maximum damage recovery.",
      "info"
    );
  }
  debouncedGenerate();
});

/** Logo scale slider */
addListener(el.logoSize, "input", e => {
  state.logoSize = parseInt(e.target.value, 10) / 100;
  if (el.logoSizeValue) el.logoSizeValue.textContent = `${e.target.value}%`;
  debouncedGenerate();
});

/** Logo upload with automatic Reed-Solomon Level H elevation */
addListener(el.logoUpload, "change", async e => {
  const file = e.target.files[0];
  if (!file) return;

  if (!isValidLogoType(file.type)) {
    showToast("Please upload a PNG, JPG, JPEG, or SVG file.", "error");
    el.logoUpload.value = "";
    return;
  }

  const validator =
    typeof QREngine !== "undefined" &&
    typeof QREngine.validateLogoSignature === "function"
      ? QREngine.validateLogoSignature
      : validateLogoSignature;

  if (typeof validator === "function") {
    const sigCheck = await validator(file);
    if (!sigCheck.valid) {
      showToast(
        sigCheck.error ||
          "File signature does not match a supported image format.",
        "error"
      );
      el.logoUpload.value = "";
      return;
    }
  }

  const reader = new FileReader();
  reader.onload = event => {
    state.logo = event.target.result;
    // Automatic Reed-Solomon error correction elevation to Level H (up to 30% damage recovery)
    previousUserErrorLevel = state.errorLevel;
    state.errorLevel = "H";
    if (el.errorLevel) el.errorLevel.value = "H";
    if (el.errorElevationBadge) el.errorElevationBadge.hidden = false;

    if (el.uploadText) el.uploadText.textContent = file.name;
    if (el.removeLogoBtn) el.removeLogoBtn.disabled = false;
    generateQRCode();
    showToast(
      "Logo embedded! Auto-elevated error correction to Level H (30% recovery).",
      "success"
    );
  };
  reader.onerror = () => {
    showToast("Failed to read the logo file.", "error");
  };
  reader.readAsDataURL(file);
});

/** Remove logo & restore previous error correction */
addListener(el.removeLogoBtn, "click", () => {
  state.logo = null;
  if (el.logoUpload) el.logoUpload.value = "";
  if (el.uploadText) el.uploadText.textContent = "Click to upload logo";
  if (el.removeLogoBtn) el.removeLogoBtn.disabled = true;

  // Restore previous user error level
  state.errorLevel = previousUserErrorLevel || "M";
  if (el.errorLevel) el.errorLevel.value = state.errorLevel;
  if (el.errorElevationBadge) el.errorElevationBadge.hidden = true;

  generateQRCode();
  showToast("Logo removed; error correction restored.", "info");
});

/* ---------------------- DOWNLOAD HELPERS ---------------------- */

/** Helper to trigger file download using an anchor element with explicit filename */
function triggerDownloadFile(blobOrUrl, filename) {
  if (
    typeof QREngine !== "undefined" &&
    typeof QREngine.triggerDownload === "function"
  ) {
    return QREngine.triggerDownload(blobOrUrl, filename);
  }

  const isBlob = typeof Blob !== "undefined" && blobOrUrl instanceof Blob;
  const url = isBlob ? URL.createObjectURL(blobOrUrl) : blobOrUrl;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.setAttribute("download", filename);
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    if (
      isBlob &&
      typeof URL !== "undefined" &&
      typeof URL.revokeObjectURL === "function"
    ) {
      URL.revokeObjectURL(url);
    }
  }, 1000);
  return true;
}

/** Render SVG element or string to a Blob of requested raster format at specified resolution */
function renderSvgToBlob(svgElOrSource, size = 4000, extension = "png") {
  return new Promise((resolve, reject) => {
    try {
      let source = "";
      if (typeof svgElOrSource === "string") {
        source = svgElOrSource;
      } else if (svgElOrSource && typeof svgElOrSource.outerHTML === "string") {
        source = svgElOrSource.outerHTML;
      } else if (svgElOrSource) {
        const serializer = new XMLSerializer();
        source = serializer.serializeToString(svgElOrSource);
      }
      if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(
          /^<svg/,
          '<svg xmlns="http://www.w3.org/2000/svg"'
        );
      }
      const svgBlob = new Blob([source], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, size, size);
          URL.revokeObjectURL(url);
          if (typeof canvas.toBlob === "function") {
            canvas.toBlob(blob => resolve(blob), `image/${extension}`, 1.0);
          } else {
            resolve(null);
          }
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = e => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

/** Main download handler for PNG (High-DPI up to 4000x4000), SVG, and EPS */
async function downloadQR(extension = "png") {
  if (!qrCode || !state.text.trim()) return;

  const filename =
    typeof QREngine !== "undefined" &&
    typeof QREngine.getDownloadFilename === "function"
      ? QREngine.getDownloadFilename("qr-code", extension)
      : `qr-code.${extension}`;

  try {
    let blob = null;

    // Retrieve SVG markup from DOM container or library
    let svgSource = "";
    const svgEl = el.qrContainer ? el.qrContainer.querySelector("svg") : null;
    if (svgEl) {
      const serializer = new XMLSerializer();
      svgSource = serializer.serializeToString(svgEl);
    } else if (typeof qrCode.getRawData === "function") {
      try {
        const rawSvgBlob = await qrCode.getRawData("svg");
        if (rawSvgBlob) {
          svgSource = await rawSvgBlob.text();
        }
      } catch (err) {
        console.warn("getRawData SVG extraction failed:", err);
      }
    }

    if (!svgSource.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      svgSource = svgSource.replace(
        /^<svg/,
        '<svg xmlns="http://www.w3.org/2000/svg"'
      );
    }

    if (
      state.dotStyle === "diamond" &&
      typeof QREngine !== "undefined" &&
      typeof QREngine.applyDiamondGeometry === "function"
    ) {
      svgSource = QREngine.applyDiamondGeometry(svgSource);
    }

    // 1. Vector EPS Export
    if (extension === "eps") {
      if (
        typeof QREngine !== "undefined" &&
        typeof QREngine.svgToEps === "function"
      ) {
        const epsContent = QREngine.svgToEps(svgSource);
        blob = new Blob([epsContent], { type: "application/postscript" });
      } else {
        throw new Error("EPS export engine unavailable.");
      }
    }

    // 2. Vector SVG Export
    else if (extension === "svg") {
      blob = new Blob(
        ['<?xml version="1.0" standalone="no"?>\r\n' + svgSource],
        { type: "image/svg+xml;charset=utf-8" }
      );
    }

    // 3. High-DPI Raster PNG Export (up to 4000x4000 px)
    else {
      let targetResolution = state.size;
      if (el.exportResolution) {
        const resVal = el.exportResolution.value;
        if (resVal === "4000") targetResolution = 4000;
        else if (resVal === "2000") targetResolution = 2000;
        else if (resVal === "1000") targetResolution = 1000;
      }
      blob = await renderSvgToBlob(svgSource, targetResolution, "png");
    }

    if (blob) {
      triggerDownloadFile(blob, filename);
      showToast(
        `${extension.toUpperCase()} downloaded successfully!`,
        "success"
      );
    } else {
      await qrCode.download({ name: "qr-code", extension });
      showToast(
        `${extension.toUpperCase()} downloaded successfully!`,
        "success"
      );
    }
  } catch (err) {
    showToast(`Failed to download ${extension.toUpperCase()}.`, "error");
    console.error(err);
  }
}

/** Download PNG */
addListener(el.downloadPngBtn, "click", async () => {
  await downloadQR("png");
});

/** Download SVG */
addListener(el.downloadSvgBtn, "click", async () => {
  await downloadQR("svg");
});

/** Download EPS */
addListener(el.downloadEpsBtn, "click", async () => {
  await downloadQR("eps");
});

/** Copy or share QR image */
addListener(el.copyImageBtn, "click", async () => {
  if (!qrCode || !state.text.trim()) return;

  const canvas = el.qrContainer ? el.qrContainer.querySelector("canvas") : null;

  if (!canvas) {
    showToast("Unable to process image right now.", "error");
    return;
  }

  // Attempt Web Share API first if supported
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      const blob = await new Promise(resolve =>
        canvas.toBlob(resolve, "image/png")
      );
      if (blob) {
        const file = new File([blob], "qr-code.png", { type: "image/png" });
        if (
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({
            title: "QR Code",
            text: state.text,
            files: [file],
          });
          showToast("Shared successfully!", "success");
          return;
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return; // User cancelled share dialog
      // Fall through to clipboard copy fallback
    }
  }

  // Fallback to Clipboard API
  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard ||
    !window.ClipboardItem
  ) {
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
  previousUserErrorLevel = "M";

  if (el.textInput) el.textInput.value = "";
  if (el.fillType) el.fillType.value = "solid";
  if (el.fgColor) el.fgColor.value = DEFAULTS.fgColor;
  if (el.fgColorText) el.fgColorText.value = DEFAULTS.fgColor;
  if (el.bgColor) el.bgColor.value = DEFAULTS.bgColor;
  if (el.bgColorText) el.bgColorText.value = DEFAULTS.bgColor;
  if (el.gradientControlsWrap) el.gradientControlsWrap.hidden = true;
  if (el.gradientColor1) el.gradientColor1.value = DEFAULTS.gradientColor1;
  if (el.gradientColor1Text)
    el.gradientColor1Text.value = DEFAULTS.gradientColor1;
  if (el.gradientColor2) el.gradientColor2.value = DEFAULTS.gradientColor2;
  if (el.gradientColor2Text)
    el.gradientColor2Text.value = DEFAULTS.gradientColor2;
  if (el.gradientRotation) el.gradientRotation.value = "0";
  if (el.gradientRotationValue) el.gradientRotationValue.textContent = "0°";
  if (el.dotStyle) el.dotStyle.value = DEFAULTS.dotStyle;
  if (el.cornerSquareStyle)
    el.cornerSquareStyle.value = DEFAULTS.cornerSquareStyle;
  if (el.cornerDotStyle) el.cornerDotStyle.value = DEFAULTS.cornerDotStyle;
  if (el.size) el.size.value = DEFAULTS.size;
  if (el.sizeValue) el.sizeValue.textContent = `${DEFAULTS.size}px`;
  if (el.margin) el.margin.value = DEFAULTS.margin;
  if (el.marginValue) el.marginValue.textContent = `${DEFAULTS.margin}px`;
  if (el.errorLevel) el.errorLevel.value = DEFAULTS.errorLevel;
  if (el.errorElevationBadge) el.errorElevationBadge.hidden = true;
  if (el.logoUpload) el.logoUpload.value = "";
  if (el.uploadText) el.uploadText.textContent = "Click to upload logo";
  if (el.logoSize) el.logoSize.value = "30";
  if (el.logoSizeValue) el.logoSizeValue.textContent = "30%";
  if (el.removeLogoBtn) el.removeLogoBtn.disabled = true;
  if (el.exportResolution) el.exportResolution.value = "4000";

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


async function validateLogoSignature(file) {
  if (typeof QREngine !== "undefined" && typeof QREngine.validateLogoSignature === "function") {
    return await QREngine.validateLogoSignature(file);
  }
  return { valid: true };
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
    validateLogoSignature,
    shouldGenerateQRCode,
    downloadQR,
    triggerDownloadFile,
    renderSvgToBlob,
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

// --- IMAGE METADATA VIEWER & PRIVACY SCRUBBER CONTROLLER ---

const imageInput = document.getElementById("imageInput");
const uploadCard = document.getElementById("uploadCard");

const resultsSection = document.getElementById("resultsSection");
const errorMessage = document.getElementById("errorMessage");
const statusBanner = document.getElementById("statusBanner");

const imagePreview = document.getElementById("imagePreview");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const dimensions = document.getElementById("dimensions");
const fileType = document.getElementById("fileType");

const metadataCount = document.getElementById("metadataCount");
const emptyMetadata = document.getElementById("emptyMetadata");

const newImageBtn = document.getElementById("newImageBtn");
const exportBtn = document.getElementById("exportBtn");
const scrubBtn = document.getElementById("scrubBtn");

// GPS Map Elements
const gpsMapCard = document.getElementById("gpsMapCard");
const gpsCoordinatesBadge = document.getElementById("gpsCoordinatesBadge");
const osmMapIframe = document.getElementById("osmMapIframe");
const radarMapCanvas = document.getElementById("radarMapCanvas");
const osmLink = document.getElementById("osmLink");
const gmapsLink = document.getElementById("gmapsLink");
const copyCoordsBtn = document.getElementById("copyCoordsBtn");

let currentFile = null;
let currentMetadata = null;
let currentObjectUrl = null;

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCEPTED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/* --------------------------------
   Utility Functions
-------------------------------- */

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

function showError(message) {
  console.error("Image metadata error:", message);

  if (!errorMessage) return;

  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
  errorMessage.style.display = "block";
  errorMessage.style.visibility = "visible";
  errorMessage.style.opacity = "1";
}

function hideError() {
  if (!errorMessage) return;

  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
  errorMessage.style.display = "none";
}

function showStatus(message, isError = false) {
  if (!statusBanner) return;
  statusBanner.textContent = message;
  statusBanner.className = `status-banner ${isError ? "error" : ""}`;
  statusBanner.classList.remove("hidden");

  setTimeout(() => {
    if (statusBanner) {
      statusBanner.classList.add("hidden");
    }
  }, 5000);
}

function validateImageFile(file) {
  if (!file) {
    return {
      valid: false,
      message: "Please select an image file.",
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      message: "The image file is empty (0 bytes).",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message: `Image is too large (${formatFileSize(file.size)}). Maximum allowed size is 5 MB.`,
    };
  }

  if (file.type && !ACCEPTED_FILE_TYPES.has(file.type)) {
    return {
      valid: false,
      message: "Unsupported image format. Only JPEG, PNG, and WebP are supported.",
    };
  }

  return {
    valid: true,
    message: "",
  };
}

/* --------------------------------
   Metadata UI Rendering
-------------------------------- */

const METADATA_FIELDS = [
  "cameraMake",
  "cameraModel",
  "bodySerialNumber",
  "lensModel",
  "lensSerialNumber",
  "software",
  "exposureTime",
  "fNumber",
  "iso",
  "focalLength",
  "focalLengthIn35mm",
  "exposureProgram",
  "exposureBias",
  "meteringMode",
  "whiteBalance",
  "latitude",
  "longitude",
  "altitude",
  "gpsCoordinates",
  "iptcTitle",
  "iptcCreator",
  "iptcCredit",
  "iptcCopyright",
  "iptcLocation",
  "iptcKeywords",
  "dateTaken",
  "dateDigitized",
  "xmpCreateDate",
  "creatorTool",
  "colorSpace",
  "orientation",
];

function setMetadataValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = formatValue(value);
  }
}

function renderGPSMap(latitude, longitude) {
  if (!gpsMapCard) return;

  if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
    gpsMapCard.classList.add("hidden");
    return;
  }

  gpsMapCard.classList.remove("hidden");

  const latNum = Number(latitude);
  const lonNum = Number(longitude);
  const coordsStr = `📍 ${latNum.toFixed(6)}°, ${lonNum.toFixed(6)}°`;

  if (gpsCoordinatesBadge) {
    gpsCoordinatesBadge.textContent = coordsStr;
  }

  if (osmLink) {
    osmLink.href = `https://www.openstreetmap.org/?mlat=${latNum}&mlon=${lonNum}#map=16/${latNum}/${lonNum}`;
  }

  if (gmapsLink) {
    gmapsLink.href = `https://www.google.com/maps/search/?api=1&query=${latNum},${lonNum}`;
  }

  if (osmMapIframe) {
    const delta = 0.008;
    const bbox = `${(lonNum - delta).toFixed(5)}%2C${(latNum - delta).toFixed(5)}%2C${(lonNum + delta).toFixed(5)}%2C${(latNum + delta).toFixed(5)}`;
    osmMapIframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latNum}%2C${lonNum}`;
  }

  drawRadarMap(latNum, lonNum);
}

function drawRadarMap(lat, lon) {
  if (!radarMapCanvas) return;
  const ctx = radarMapCanvas.getContext("2d");
  if (!ctx) return;

  const w = radarMapCanvas.width;
  const h = radarMapCanvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.fillStyle = "#080d17";
  ctx.fillRect(0, 0, w, h);

  // Radar grid rings
  ctx.strokeStyle = "rgba(56, 189, 248, 0.18)";
  ctx.lineWidth = 1;

  for (let r = 30; r <= 100; r += 25) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Crosshairs
  ctx.beginPath();
  ctx.moveTo(cx - 110, cy);
  ctx.lineTo(cx + 110, cy);
  ctx.moveTo(cx, cy - 110);
  ctx.lineTo(cx, cy + 110);
  ctx.stroke();

  // Cardinal labels
  ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("N", cx, cy - 115);
  ctx.fillText("S", cx, cy + 125);
  ctx.fillText("W", cx - 120, cy + 4);
  ctx.fillText("E", cx + 120, cy + 4);

  // Pin marker
  ctx.fillStyle = "#f87171";
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(248, 113, 113, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Coordinate text overlay
  ctx.fillStyle = "#38bdf8";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${lat.toFixed(6)}, ${lon.toFixed(6)}`, cx, cy + 90);
}

function renderMetadata(metadata) {
  const data = metadata || {};

  // Camera & Hardware
  setMetadataValue("cameraMake", data.make);
  setMetadataValue("cameraModel", data.model);
  setMetadataValue("bodySerialNumber", data.bodySerialNumber);
  setMetadataValue("lensModel", data.lensModel);
  setMetadataValue("lensSerialNumber", data.lensSerialNumber);
  setMetadataValue("software", data.software);

  // Exposure & Optics
  setMetadataValue("exposureTime", data.exposureTime);
  setMetadataValue("fNumber", data.fNumber);
  setMetadataValue("iso", data.iso);
  setMetadataValue("focalLength", data.focalLength);
  setMetadataValue("focalLengthIn35mm", data.focalLengthIn35mm);
  setMetadataValue("exposureProgram", data.exposureProgram);
  setMetadataValue("exposureBias", data.exposureBias);
  setMetadataValue("meteringMode", data.meteringMode);
  setMetadataValue("whiteBalance", data.whiteBalance);

  // Location & GPS
  setMetadataValue("latitude", data.latitude);
  setMetadataValue("longitude", data.longitude);
  setMetadataValue("altitude", data.altitude);
  setMetadataValue("gpsCoordinates", data.gpsCoordinates);

  // IPTC & Rights
  setMetadataValue("iptcTitle", data.title || data.headline);
  setMetadataValue("iptcCreator", data.creator || data.artist);
  setMetadataValue("iptcCredit", data.credit);
  setMetadataValue("iptcCopyright", data.copyright);

  const locParts = [data.city, data.provinceOrState, data.country].filter(Boolean);
  setMetadataValue("iptcLocation", locParts.length > 0 ? locParts.join(", ") : null);
  setMetadataValue("iptcKeywords", data.keywords);

  // XMP & Dates
  setMetadataValue("dateTaken", data.dateTaken);
  setMetadataValue("dateDigitized", data.dateDigitized);
  setMetadataValue("xmpCreateDate", data.xmpCreateDate);
  setMetadataValue("creatorTool", data.creatorTool);

  // Image & Color
  setMetadataValue("colorSpace", data.colorSpace);
  setMetadataValue("orientation", data.orientation);

  // Render GPS Map preview if coordinates are available
  renderGPSMap(data.latitude, data.longitude);

  const count = METADATA_FIELDS.filter(id => {
    const element = document.getElementById(id);
    if (!element) return false;
    const value = element.textContent;
    return value && value !== "—";
  }).length;

  if (metadataCount) {
    metadataCount.textContent = `${count} ${count === 1 ? "field" : "fields"}`;
  }

  if (emptyMetadata) {
    emptyMetadata.classList.toggle("hidden", count > 0);
  }
}

/* --------------------------------
   Image Preview
-------------------------------- */

function loadImagePreview(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No image selected."));
      return;
    }

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    try {
      currentObjectUrl = URL.createObjectURL(file);
    } catch {
      reject(new Error("Unable to create preview URL for the image file."));
      return;
    }

    const image = new Image();

    image.onload = () => {
      if (imagePreview) {
        imagePreview.src = currentObjectUrl;
      }

      const width = image.naturalWidth;
      const height = image.naturalHeight;

      if (dimensions) {
        dimensions.textContent = `${width} × ${height}`;
      }

      resolve({
        width,
        height,
      });
    };

    image.onerror = () => {
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
      }
      reject(
        new Error(
          "The selected image could not be loaded. The format may be unsupported or the file is corrupted."
        )
      );
    };

    image.src = currentObjectUrl;
  });
}

/* --------------------------------
   Process Image
-------------------------------- */

async function processImage(file) {
  hideError();

  const validation = validateImageFile(file);

  if (!validation.valid) {
    currentFile = null;
    currentMetadata = null;

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    if (imagePreview) {
      imagePreview.removeAttribute("src");
    }

    showError(validation.message);
    return;
  }

  currentFile = file;

  try {
    if (fileName) fileName.textContent = file.name;
    if (fileSize) fileSize.textContent = formatFileSize(file.size);
    if (fileType) fileType.textContent = file.type || "Unknown";

    const imageInfo = await loadImagePreview(file);

    if (
      !globalThis.ImageMetadataEngine ||
      typeof globalThis.ImageMetadataEngine.parse !== "function"
    ) {
      throw new Error("Image metadata engine is unavailable.");
    }

    const exifMetadata = await globalThis.ImageMetadataEngine.parse(file);

    currentMetadata = {
      ...exifMetadata,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || "Unknown",
      width: imageInfo.width,
      height: imageInfo.height,
    };

    renderMetadata(currentMetadata);

    uploadCard.classList.add("hidden");
    resultsSection.classList.remove("hidden");
  } catch (error) {
    console.error("Image metadata error:", error);

    currentFile = null;
    currentMetadata = null;

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    if (imagePreview) {
      imagePreview.removeAttribute("src");
    }

    if (resultsSection) {
      resultsSection.classList.add("hidden");
    }

    if (uploadCard) {
      uploadCard.classList.remove("hidden");
    }

    showError(
      error instanceof Error ? error.message : "Unable to read image metadata."
    );
  }
}

/* --------------------------------
   Privacy Scrubber (One-Click)
-------------------------------- */

async function handleScrubMetadata() {
  if (!currentFile) {
    showError("Please load an image before scrubbing metadata.");
    return;
  }

  try {
    if (
      !globalThis.ImageMetadataEngine ||
      typeof globalThis.ImageMetadataEngine.scrubMetadata !== "function"
    ) {
      throw new Error("Metadata scrubbing engine is unavailable.");
    }

    const buffer = await currentFile.arrayBuffer();
    const cleanBuffer = globalThis.ImageMetadataEngine.scrubMetadata(buffer);

    const mime = currentFile.type || "image/jpeg";
    const cleanBlob = new Blob([cleanBuffer], { type: mime });

    // Download the scrubbed image
    const url = URL.createObjectURL(cleanBlob);
    const link = document.createElement("a");

    const baseName =
      currentFile.name
        ?.replace(/\.[^/.]+$/, "")
        .replace(/[^a-z0-9_-]/gi, "-") || "sanitized-image";

    const extMatch = currentFile.name.match(/\.([a-z0-9]+)$/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";

    link.href = url;
    link.download = `${baseName}-sanitized.${ext}`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showStatus(
      `✓ Privacy Protected: Removed all EXIF, GPS, camera serials, and IPTC/XMP tags (${formatFileSize(currentFile.size)} → ${formatFileSize(cleanBlob.size)}).`
    );
  } catch (err) {
    console.error("Metadata scrub error:", err);
    showError(`Failed to scrub image metadata: ${err.message}`);
  }
}

/* --------------------------------
   Copy Coordinates
-------------------------------- */

if (copyCoordsBtn) {
  copyCoordsBtn.addEventListener("click", async () => {
    if (!currentMetadata || currentMetadata.latitude === undefined || currentMetadata.longitude === undefined) {
      return;
    }

    const coordsText = `${currentMetadata.latitude}, ${currentMetadata.longitude}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(coordsText);
        copyCoordsBtn.textContent = "✓ Copied!";
        setTimeout(() => {
          if (copyCoordsBtn) copyCoordsBtn.textContent = "📋 Copy Coords";
        }, 1500);
      }
    } catch {
      // Fallback
    }
  });
}

/* --------------------------------
   File Input & Drag/Drop
-------------------------------- */

if (imageInput) {
  imageInput.addEventListener("change", event => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    input.value = "";

    if (!validation.valid) {
      showError(validation.message);
      return;
    }

    processImage(file);
  });
}

if (uploadCard) {
  uploadCard.addEventListener("dragover", event => {
    event.preventDefault();
    uploadCard.classList.add("drag-over");
  });

  uploadCard.addEventListener("dragleave", event => {
    if (!uploadCard.contains(event.relatedTarget)) {
      uploadCard.classList.remove("drag-over");
    }
  });

  uploadCard.addEventListener("drop", event => {
    event.preventDefault();
    uploadCard.classList.remove("drag-over");

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      showError(validation.message);
      return;
    }

    processImage(file);
  });
}

/* --------------------------------
   Toolbar Actions
-------------------------------- */

if (newImageBtn) {
  newImageBtn.addEventListener("click", () => {
    currentFile = null;
    currentMetadata = null;

    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }

    if (imagePreview) {
      imagePreview.removeAttribute("src");
    }

    resultsSection.classList.add("hidden");
    uploadCard.classList.remove("hidden");

    hideError();

    if (imageInput) {
      imageInput.click();
    }
  });
}

if (scrubBtn) {
  scrubBtn.addEventListener("click", handleScrubMetadata);
}

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    if (!currentMetadata) {
      showError("Load an image before exporting metadata.");
      return;
    }

    try {
      const json = JSON.stringify(currentMetadata, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const baseName =
        currentFile?.name
          ?.replace(/\.[^/.]+$/, "")
          .replace(/[^a-z0-9_-]/gi, "-") || "image";

      link.href = url;
      link.download = `${baseName}-metadata.json`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Metadata export error:", error);
      showError("Unable to export metadata.");
    }
  });
}

/* --------------------------------
   Cleanup
-------------------------------- */

window.addEventListener("beforeunload", () => {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }
});

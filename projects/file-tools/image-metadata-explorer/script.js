// --- IMAGE METADATA VIEWER CONTROLLER ---

const imageInput = document.getElementById("imageInput");
const uploadCard = document.getElementById("uploadCard");

const resultsSection = document.getElementById("resultsSection");
const errorMessage = document.getElementById("errorMessage");

const imagePreview = document.getElementById("imagePreview");
const fileName = document.getElementById("fileName");
const fileSize = document.getElementById("fileSize");
const dimensions = document.getElementById("dimensions");
const fileType = document.getElementById("fileType");

const metadataCount = document.getElementById("metadataCount");
const emptyMetadata = document.getElementById("emptyMetadata");

const newImageBtn = document.getElementById("newImageBtn");
const exportBtn = document.getElementById("exportBtn");

let currentFile = null;
let currentMetadata = null;
let currentObjectUrl = null;

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
  if (!errorMessage) return;

  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function hideError() {
  if (!errorMessage) return;

  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
}

/* --------------------------------
   Metadata UI
-------------------------------- */

const METADATA_FIELDS = [
  "cameraMake",
  "cameraModel",
  "dateTaken",
  "orientation",
  "iso",
  "exposureTime",
  "fNumber",
  "focalLength",
  "latitude",
  "longitude",
];

function setMetadataValue(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = formatValue(value);
  }
}

function renderMetadata(metadata) {
  const data = metadata || {};

  setMetadataValue("cameraMake", data.make);
  setMetadataValue("cameraModel", data.model);

  setMetadataValue("dateTaken", data.dateTaken);
  setMetadataValue("orientation", data.orientation);

  setMetadataValue("iso", data.iso);
  setMetadataValue("exposureTime", data.exposureTime);
  setMetadataValue("fNumber", data.fNumber);
  setMetadataValue("focalLength", data.focalLength);

  setMetadataValue("latitude", data.latitude);
  setMetadataValue("longitude", data.longitude);

  const count = METADATA_FIELDS.filter(id => {
    const element = document.getElementById(id);

    if (!element) {
      return false;
    }

    const value = element.textContent;

    return value && value !== "—";
  }).length;

  if (metadataCount) {
    metadataCount.textContent =
      `${count} ${count === 1 ? "field" : "fields"}`;
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
    }

    currentObjectUrl = URL.createObjectURL(file);

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
      reject(
        new Error("The selected image could not be loaded.")
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

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    showError("Please select a valid image file.");
    return;
  }

  currentFile = file;

  try {
    if (fileName) {
      fileName.textContent = file.name;
    }

    if (fileSize) {
      fileSize.textContent = formatFileSize(file.size);
    }

    if (fileType) {
      fileType.textContent =
        file.type || "Unknown";
    }

    const imageInfo = await loadImagePreview(file);

    /*
     * metadataEngine.js handles EXIF metadata.
     */
    if (
      !globalThis.ImageMetadataEngine ||
      typeof globalThis.ImageMetadataEngine.parse !== "function"
    ) {
      throw new Error(
        "Image metadata engine is unavailable."
      );
    }

    const exifMetadata =
      await globalThis.ImageMetadataEngine.parse(file);

    /*
     * Only keep the basic metadata we actually display.
     */
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
    console.error(
      "Image metadata error:",
      error
    );

    currentMetadata = null;

    showError(
      error instanceof Error
        ? error.message
        : "Unable to read image metadata."
    );
  }
}

/* --------------------------------
   File Input
-------------------------------- */

if (imageInput) {
  imageInput.addEventListener("change", event => {
    const file = event.target.files?.[0];

    if (file) {
      processImage(file);
    }

    /*
     * Allows selecting the same image again.
     */
    imageInput.value = "";
  });
}

/* --------------------------------
   Drag & Drop
-------------------------------- */

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

    const file =
      event.dataTransfer?.files?.[0];

    if (file) {
      processImage(file);
    }
  });
}

/* --------------------------------
   Choose Another Image
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

/* --------------------------------
   Export Metadata
-------------------------------- */

if (exportBtn) {
  exportBtn.addEventListener("click", () => {
    if (!currentMetadata) {
      showError(
        "Load an image before exporting metadata."
      );
      return;
    }

    try {
      const json = JSON.stringify(
        currentMetadata,
        null,
        2
      );

      const blob = new Blob(
        [json],
        {
          type: "application/json",
        }
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      const baseName =
        currentFile?.name
          ?.replace(/\.[^/.]+$/, "")
          .replace(/[^a-z0-9_-]/gi, "-") ||
        "image";

      link.href = url;
      link.download =
        `${baseName}-metadata.json`;

      document.body.appendChild(link);

      link.click();

      link.remove();

      URL.revokeObjectURL(url);

    } catch (error) {
      console.error(
        "Metadata export error:",
        error
      );

      showError(
        "Unable to export metadata."
      );
    }
  });
}

/* --------------------------------
   Cleanup
-------------------------------- */

window.addEventListener(
  "beforeunload",
  () => {
    if (currentObjectUrl) {
      URL.revokeObjectURL(
        currentObjectUrl
      );
    }
  }
);
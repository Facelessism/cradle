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

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCEPTED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
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
  if (!errorMessage) return;

  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

function hideError() {
  if (!errorMessage) return;

  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
}

function validateImageFile(file) {
  if (!file) {
    return {
      valid: false,
      message: "Please select an image file."
    };
  }

  console.log(
    "Selected file:",
    file.name,
    "Size:",
    file.size,
    "Bytes",
    formatFileSize(file.size)
  );

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      message: `Image is too large (${formatFileSize(file.size)}). Maximum allowed size is 5 MB.`
    };
  }

  if (!ACCEPTED_FILE_TYPES.has(file.type)) {
    return {
      valid: false,
      message: "Invalid file type. Please select a supported image file."
    };
  }

  return {
    valid: true,
    message: ""
  };
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

  // Nothing below this line runs for an oversized file.

  currentFile = file;

  try {
    if (fileName) {
      fileName.textContent = file.name;
    }

    if (fileSize) {
      fileSize.textContent = formatFileSize(file.size);
    }

    if (fileType) {
      fileType.textContent = file.type || "Unknown";
    }

    const imageInfo = await loadImagePreview(file);

    if (
      !globalThis.ImageMetadataEngine ||
      typeof globalThis.ImageMetadataEngine.parse !== "function"
    ) {
      throw new Error("Image metadata engine is unavailable.");
    }

    const exifMetadata =
      await globalThis.ImageMetadataEngine.parse(file);

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
    const input = event.target;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    console.log("IMAGE UPLOAD ATTEMPT:", {
      name: file.name,
      size: file.size,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      type: file.type
    });

    const validation = validateImageFile(file);

    // ALWAYS clear the input.
    input.value = "";

    // STOP immediately if invalid.
    if (!validation.valid) {
      console.warn("IMAGE REJECTED:", validation.message);

      currentFile = null;
      currentMetadata = null;

      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = null;
      }

      if (imagePreview) {
        imagePreview.removeAttribute("src");
        imagePreview.removeAttribute("srcset");
      }

      if (resultsSection) {
        resultsSection.classList.add("hidden");
      }

      if (uploadCard) {
        uploadCard.classList.remove("hidden");
      }

      if (dimensions) {
        dimensions.textContent = "—";
      }

      if (fileName) {
        fileName.textContent = "—";
      }

      if (fileSize) {
        fileSize.textContent = "—";
      }

      if (fileType) {
        fileType.textContent = "—";
      }

      showError(validation.message);

      return;
    }

    console.log("IMAGE ACCEPTED:", file.name);

    processImage(file);
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

    const file = event.dataTransfer?.files?.[0];

    if (!file) return;

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

    processImage(file);
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

function showError(message) {
  console.error("SHOW ERROR:", message);

  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
    errorMessage.style.display = "block";
    errorMessage.style.visibility = "visible";
    errorMessage.style.opacity = "1";
  }

  alert(message);
}
(function () {
  "use strict";

  const engine = window.ASCIIEngine;
  const exporter = window.ASCIIExporter;

  const sampleArt = [
    "      ####      ",
    "   ##      ##   ",
    "  #  ASCII   #  ",
    " #   CAMERA   # ",
    "  #          #  ",
    "   ##      ##   ",
    "      ####      "
  ].join("\n");

  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

  const ACCEPTED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif"
  ]);

  const els = {
    video: document.getElementById("cameraVideo"),
    sourceCanvas: document.getElementById("sourceCanvas"),
    analysisCanvas: document.getElementById("analysisCanvas"),
    asciiOutput: document.getElementById("asciiOutput"),
    cameraBtn: document.getElementById("cameraBtn"),
    stopCameraBtn: document.getElementById("stopCameraBtn"),
    imageUpload: document.getElementById("imageUpload"),
    densitySelect: document.getElementById("densitySelect"),
    columnRange: document.getElementById("columnRange"),
    columnValue: document.getElementById("columnValue"),
    contrastRange: document.getElementById("contrastRange"),
    contrastValue: document.getElementById("contrastValue"),
    brightnessRange: document.getElementById("brightnessRange"),
    brightnessValue: document.getElementById("brightnessValue"),
    fpsRange: document.getElementById("fpsRange"),
    fpsValue: document.getElementById("fpsValue"),
    invertToggle: document.getElementById("invertToggle"),
    edgeToggle: document.getElementById("edgeToggle"),
    colorToggle: document.getElementById("colorToggle"),
    copyBtn: document.getElementById("copyBtn"),
    downloadTxtBtn: document.getElementById("downloadTxtBtn"),
    downloadHtmlBtn: document.getElementById("downloadHtmlBtn"),
    downloadSvgBtn: document.getElementById("downloadSvgBtn"),
    downloadPngBtn: document.getElementById("downloadPngBtn"),
    sampleBtn: document.getElementById("sampleBtn"),
    sourceStatus: document.getElementById("sourceStatus"),
    frameMeta: document.getElementById("frameMeta"),
    exportMeta: document.getElementById("exportMeta"),
    sourceHelp: document.getElementById("sourceHelp"),
    renderStats: document.getElementById("renderStats"),
    emptyPreview: document.getElementById("emptyPreview")
  };

  const sourceCtx = els.sourceCanvas.getContext("2d", {
    willReadFrequently: true
  });

  const analysisCtx = els.analysisCanvas.getContext("2d", {
    willReadFrequently: true
  });

  const state = {
    stream: null,
    mode: "empty",
    sourceImage: null,
    animationId: null,
    lastFrameAt: 0,
    asciiText: "",
    lines: [],
    sourceName: "",
    objectUrl: ""
  };

  function numberValue(el) {
    return Number(el.value);
  }

  function formatFileSize(bytes) {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function updateControlLabels() {
    if (els.columnValue) {
      els.columnValue.textContent = els.columnRange.value;
    }

    if (els.contrastValue) {
      els.contrastValue.textContent = `${els.contrastRange.value}%`;
    }

    if (els.brightnessValue) {
      els.brightnessValue.textContent = els.brightnessRange.value;
    }

    if (els.fpsValue) {
      els.fpsValue.textContent = els.fpsRange.value;
    }

    if (els.frameMeta) {
      els.frameMeta.textContent = `${els.columnRange.value} cols`;
    }
  }

  function setStatus(source, detail, help) {
    if (els.sourceStatus) {
      els.sourceStatus.textContent = source;
    }

    if (els.exportMeta) {
      els.exportMeta.textContent = detail;
    }

    if (els.sourceHelp) {
      els.sourceHelp.textContent = help;
    }
  }

  function setEmptyState() {
    stopCamera();

    state.mode = "empty";
    state.sourceImage = null;
    state.asciiText = "";
    state.lines = [];

    els.sourceCanvas.style.display = "none";
    els.video.style.display = "none";
    els.emptyPreview.style.display = "flex";
    els.asciiOutput.textContent = "";

    if (els.renderStats) {
      els.renderStats.textContent = "Waiting for a source.";
    }

    setStatus(
      "Idle",
      "Ready to render",
      "Upload an image or start camera."
    );
  }

  async function startCamera() {
    try {
      stopCamera();

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "Camera access is not supported by this browser."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }
      });

      state.stream = stream;
      state.mode = "camera";
      state.lastFrameAt = 0;

      els.video.srcObject = stream;
      await els.video.play();

      els.video.style.display = "block";
      els.sourceCanvas.style.display = "none";
      els.emptyPreview.style.display = "none";

      els.cameraBtn.disabled = true;
      els.stopCameraBtn.disabled = false;

      setStatus(
        "Camera Active",
        "Live Streaming",
        "Streaming live webcam feed."
      );

      scheduleNextFrame();
    } catch (err) {
      stopCamera();

      state.mode = "empty";
      state.sourceImage = null;

      els.video.srcObject = null;
      els.video.style.display = "none";
      els.sourceCanvas.style.display = "none";
      els.emptyPreview.style.display = "flex";

      els.cameraBtn.disabled = false;
      els.stopCameraBtn.disabled = true;

      let message =
        "Camera access was denied. You can upload an image instead.";

      if (err && err.name === "NotAllowedError") {
        message =
          "Camera permission was denied. Allow camera access in your browser settings, or upload an image instead.";
      } else if (err && err.name === "NotFoundError") {
        message =
          "No camera was found on this device. You can upload an image instead.";
      } else if (err && err.name === "NotReadableError") {
        message =
          "The camera is already being used by another application. Close it and try again, or upload an image instead.";
      } else if (err && err.name === "SecurityError") {
        message =
          "Camera access is blocked by the browser or page security settings. Try using a secure connection, or upload an image instead.";
      } else if (err && err.message) {
        message = `${err.message} You can upload an image instead.`;
      }

      setStatus(
        "Camera Unavailable",
        "Using fallback mode",
        message
      );

      els.emptyPreview.innerHTML = `
        <strong>Camera unavailable</strong>
        <span>${message}</span>
      `;
    }
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach((track) => track.stop());
      state.stream = null;
    }

    if (state.animationId) {
      cancelAnimationFrame(state.animationId);
      state.animationId = null;
    }

    els.cameraBtn.disabled = false;
    els.stopCameraBtn.disabled = true;
  }

  function scheduleNextFrame() {
    if (state.mode !== "camera") {
      return;
    }

    const now = performance.now();
    const fps = numberValue(els.fpsRange);
    const targetInterval = 1000 / fps;

    if (now - state.lastFrameAt >= targetInterval) {
      state.lastFrameAt = now;
      processCurrentFrame();
    }

    state.animationId = requestAnimationFrame(scheduleNextFrame);
  }

  function processCurrentFrame() {
    let sourceWidth = 0;
    let sourceHeight = 0;

    if (state.mode === "camera") {
      sourceWidth = els.video.videoWidth;
      sourceHeight = els.video.videoHeight;

      if (!sourceWidth || !sourceHeight) {
        return;
      }
    } else if (state.mode === "image" && state.sourceImage) {
      sourceWidth =
        state.sourceImage.naturalWidth ||
        state.sourceImage.width;

      sourceHeight =
        state.sourceImage.naturalHeight ||
        state.sourceImage.height;
    } else {
      return;
    }

    const cols = numberValue(els.columnRange);
    const aspect = sourceHeight / sourceWidth;
    const rows = Math.max(
      12,
      Math.round(cols * aspect * 0.5)
    );

    els.analysisCanvas.width = cols;
    els.analysisCanvas.height = rows;

    if (state.mode === "camera") {
      analysisCtx.drawImage(
        els.video,
        0,
        0,
        cols,
        rows
      );
    } else {
      analysisCtx.drawImage(
        state.sourceImage,
        0,
        0,
        cols,
        rows
      );
    }

    const imageData = analysisCtx.getImageData(
      0,
      0,
      cols,
      rows
    );

    const rendered = engine
      ? engine.renderImageDataToASCII(imageData, {
          paletteKey: els.densitySelect
            ? els.densitySelect.value
            : "standard",

          invert: els.invertToggle
            ? els.invertToggle.checked
            : false,

          contrast:
            numberValue(els.contrastRange) / 100,

          brightness:
            numberValue(els.brightnessRange),

          edgeDetection: els.edgeToggle
            ? els.edgeToggle.checked
            : false
        })
      : {
          lines: [],
          rawText: ""
        };

    state.lines = rendered.lines;
    state.asciiText = rendered.rawText;

    els.asciiOutput.textContent = state.asciiText;

    if (els.renderStats) {
      els.renderStats.textContent =
        `Rendered ${cols}×${rows} grid (${rendered.lines.length} lines).`;
    }
  }

  function loadUploadedImage(file) {
  if (!file) {
    return;
  }

  const rejectUpload = (status, detail, message) => {
    setStatus(status, detail, message);

    if (els.imageUpload) {
      els.imageUpload.value = "";
    }

    alert(message);
  };

  // Maximum file size: 5 MB
  if (file.size > MAX_IMAGE_SIZE) {
    const actualSize = formatFileSize(file.size);

    rejectUpload(
      "Image Rejected",
      "File too large",
      `Image upload rejected.\n\nSelected file: ${actualSize}\nMaximum allowed: 5 MB`
    );

    return;
  }

  // Check MIME type
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    rejectUpload(
      "Image Rejected",
      "Invalid file type",
      "This file type is not supported.\n\nPlease upload a JPEG, PNG, WebP, or GIF image."
    );

    return;
  }

  stopCamera();

  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = "";
  }

  state.objectUrl = URL.createObjectURL(file);

  const img = new Image();

  img.onload = () => {
    const width = img.naturalWidth;
    const height = img.naturalHeight;

    // Maximum image dimensions
    const MAX_IMAGE_WIDTH = 4096;
    const MAX_IMAGE_HEIGHT = 4096;

    if (
      width > MAX_IMAGE_WIDTH ||
      height > MAX_IMAGE_HEIGHT
    ) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = "";

      state.sourceImage = null;
      state.mode = "empty";

      els.sourceCanvas.style.display = "none";
      els.video.style.display = "none";
      els.emptyPreview.style.display = "flex";

      rejectUpload(
        "Image Rejected",
        "Resolution too high",
        `This image has a resolution of ${width} × ${height}px.\n\nMaximum allowed resolution: ${MAX_IMAGE_WIDTH} × ${MAX_IMAGE_HEIGHT}px.\n\nPlease choose a smaller image.`
      );

      return;
    }

    // Image passed all validation checks
    state.sourceImage = img;
    state.mode = "image";
    state.sourceName = file.name;

    els.sourceCanvas.width = width;
    els.sourceCanvas.height = height;

    sourceCtx.clearRect(
      0,
      0,
      width,
      height
    );

    sourceCtx.drawImage(img, 0, 0);

    els.sourceCanvas.style.display = "block";
    els.video.style.display = "none";
    els.emptyPreview.style.display = "none";

    setStatus(
      "Image Loaded",
      `${file.name} • ${formatFileSize(file.size)}`,
      `Processing ${width} × ${height}px image.`
    );

    processCurrentFrame();
  };

  img.onerror = () => {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = "";
    }

    state.sourceImage = null;
    state.mode = "empty";

    els.sourceCanvas.style.display = "none";
    els.video.style.display = "none";
    els.emptyPreview.style.display = "flex";

    rejectUpload(
      "Image Rejected",
      "Unable to load image",
      "The selected image could not be loaded. Please choose another image."
    );
  };

  img.src = state.objectUrl;
}

  function loadSample() {
    stopCamera();

    state.mode = "sample";
    state.asciiText = sampleArt;
    state.lines = sampleArt.split("\n");

    els.asciiOutput.textContent = sampleArt;
    els.sourceCanvas.style.display = "none";
    els.video.style.display = "none";
    els.emptyPreview.style.display = "none";

    if (els.renderStats) {
      els.renderStats.textContent =
        "Sample ASCII rendered.";
    }

    setStatus(
      "Sample Loaded",
      "Sample Art",
      "Sample logo rendered."
    );
  }

  function setupEvents() {
    if (els.cameraBtn) {
      els.cameraBtn.addEventListener(
        "click",
        startCamera
      );
    }

    if (els.stopCameraBtn) {
      els.stopCameraBtn.addEventListener(
        "click",
        setEmptyState
      );
    }

    if (els.imageUpload) {
      els.imageUpload.addEventListener(
        "change",
        (event) => {
          const file =
            event.target.files &&
            event.target.files[0];

          if (file) {
            loadUploadedImage(file);
          }
        }
      );
    }

    const controls = [
      els.densitySelect,
      els.columnRange,
      els.contrastRange,
      els.brightnessRange,
      els.invertToggle,
      els.edgeToggle
    ];

    controls.forEach((control) => {
      if (!control) {
        return;
      }

      control.addEventListener("input", () => {
        updateControlLabels();

        if (state.mode !== "camera") {
          processCurrentFrame();
        }
      });
    });

    if (els.copyBtn) {
      els.copyBtn.addEventListener(
        "click",
        () => {
          if (!state.asciiText) {
            return;
          }

          if (
            !navigator.clipboard ||
            !navigator.clipboard.writeText
          ) {
            alert(
              "Copying is not supported by this browser."
            );
            return;
          }

          navigator.clipboard
            .writeText(state.asciiText)
            .then(() => {
              els.copyBtn.textContent = "Copied!";

              setTimeout(() => {
                els.copyBtn.textContent = "Copy Text";
              }, 2000);
            })
            .catch(() => {
              alert(
                "Unable to copy the ASCII art. Please try again."
              );
            });
        }
      );
    }

    if (els.downloadTxtBtn) {
      els.downloadTxtBtn.addEventListener(
        "click",
        () => {
          if (!state.asciiText || !exporter) {
            return;
          }

          const payload = exporter.toPlainText(
            state.lines
          );

          exporter.downloadFile(
            "ascii-art.txt",
            payload,
            "text/plain"
          );
        }
      );
    }

    if (els.downloadHtmlBtn) {
      els.downloadHtmlBtn.addEventListener(
        "click",
        () => {
          if (!state.lines.length || !exporter) {
            return;
          }

          const html = exporter.toHTML(
            state.lines
          );

          exporter.downloadFile(
            "ascii-art.html",
            html,
            "text/html"
          );
        }
      );
    }

    if (els.downloadSvgBtn) {
      els.downloadSvgBtn.addEventListener(
        "click",
        () => {
          if (!state.lines.length || !exporter) {
            return;
          }

          const svg = exporter.toSVG(
            state.lines
          );

          exporter.downloadFile(
            "ascii-art.svg",
            svg,
            "image/svg+xml"
          );
        }
      );
    }

    if (els.sampleBtn) {
      els.sampleBtn.addEventListener(
        "click",
        loadSample
      );
    }
  }

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      updateControlLabels();
      setupEvents();
      setEmptyState();
    }
  );
})();
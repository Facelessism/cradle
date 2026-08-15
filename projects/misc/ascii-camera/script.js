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

  const sourceCtx = els.sourceCanvas.getContext("2d", { willReadFrequently: true });
  const analysisCtx = els.analysisCanvas.getContext("2d", { willReadFrequently: true });

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

  function updateControlLabels() {
    if (els.columnValue) els.columnValue.textContent = els.columnRange.value;
    if (els.contrastValue) els.contrastValue.textContent = `${els.contrastRange.value}%`;
    if (els.brightnessValue) els.brightnessValue.textContent = els.brightnessRange.value;
    if (els.fpsValue) els.fpsValue.textContent = els.fpsRange.value;
    if (els.frameMeta) els.frameMeta.textContent = `${els.columnRange.value} cols`;
  }

  function setStatus(source, detail, help) {
    if (els.sourceStatus) els.sourceStatus.textContent = source;
    if (els.exportMeta) els.exportMeta.textContent = detail;
    if (els.sourceHelp) els.sourceHelp.textContent = help;
  }

  function setEmptyState() {
    stopCamera();
    state.mode = "empty";
    state.sourceImage = null;
    els.sourceCanvas.style.display = "none";
    els.video.style.display = "none";
    els.emptyPreview.style.display = "flex";
    els.asciiOutput.textContent = "";
    if (els.renderStats) els.renderStats.textContent = "Waiting for a source.";
    setStatus("Idle", "Ready to render", "Upload an image or start camera.");
  }

  async function startCamera() {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
      });
      state.stream = stream;
      state.mode = "camera";
      els.video.srcObject = stream;
      await els.video.play();

      els.video.style.display = "block";
      els.sourceCanvas.style.display = "none";
      els.emptyPreview.style.display = "none";

      els.cameraBtn.disabled = true;
      els.stopCameraBtn.disabled = false;

      setStatus("Camera Active", "Live Streaming", "Streaming live webcam feed.");
      scheduleNextFrame();
    } catch (err) {
      setStatus("Camera Error", "Access Denied", "Camera access denied or unavailable: " + err.message);
      setEmptyState();
    }
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
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
    if (state.mode !== "camera") return;
    const now = performance.now();
    const targetInterval = 1000 / numberValue(els.fpsRange);
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
      if (!sourceWidth || !sourceHeight) return;
    } else if (state.mode === "image" && state.sourceImage) {
      sourceWidth = state.sourceImage.naturalWidth || state.sourceImage.width;
      sourceHeight = state.sourceImage.naturalHeight || state.sourceImage.height;
    } else {
      return;
    }

    const cols = numberValue(els.columnRange);
    const aspect = sourceHeight / sourceWidth;
    const rows = Math.max(12, Math.round(cols * aspect * 0.5));

    els.analysisCanvas.width = cols;
    els.analysisCanvas.height = rows;

    if (state.mode === "camera") {
      analysisCtx.drawImage(els.video, 0, 0, cols, rows);
    } else {
      analysisCtx.drawImage(state.sourceImage, 0, 0, cols, rows);
    }

    const imageData = analysisCtx.getImageData(0, 0, cols, rows);

    const rendered = engine ? engine.renderImageDataToASCII(imageData, {
      paletteKey: els.densitySelect ? els.densitySelect.value : "standard",
      invert: els.invertToggle ? els.invertToggle.checked : false,
      contrast: numberValue(els.contrastRange) / 100,
      brightness: numberValue(els.brightnessRange),
      edgeDetection: els.edgeToggle ? els.edgeToggle.checked : false
    }) : { lines: [], rawText: "" };

    state.lines = rendered.lines;
    state.asciiText = rendered.rawText;

    els.asciiOutput.textContent = state.asciiText;

    if (els.renderStats) {
      els.renderStats.textContent = `Rendered ${cols}×${rows} grid (${rendered.lines.length} lines).`;
    }
  }

  function loadUploadedImage(file) {
    if (!file) return;
    stopCamera();

    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.sourceImage = img;
      state.mode = "image";
      state.sourceName = file.name;

      els.sourceCanvas.width = img.naturalWidth;
      els.sourceCanvas.height = img.naturalHeight;
      sourceCtx.drawImage(img, 0, 0);

      els.sourceCanvas.style.display = "block";
      els.video.style.display = "none";
      els.emptyPreview.style.display = "none";

      setStatus("Image Loaded", file.name, `Processing image: ${file.name}`);
      processCurrentFrame();
    };
    img.src = state.objectUrl;
  }

  function loadSample() {
    stopCamera();
    state.mode = "sample";
    state.asciiText = sampleArt;
    state.lines = sampleArt.split("\n");
    els.asciiOutput.textContent = sampleArt;
    els.emptyPreview.style.display = "none";
    if (els.renderStats) els.renderStats.textContent = "Sample ASCII rendered.";
    setStatus("Sample Loaded", "Sample Art", "Sample logo rendered.");
  }

  function setupEvents() {
    if (els.cameraBtn) els.cameraBtn.addEventListener("click", startCamera);
    if (els.stopCameraBtn) els.stopCameraBtn.addEventListener("click", () => setEmptyState());

    if (els.imageUpload) {
      els.imageUpload.addEventListener("change", e => {
        if (e.target.files && e.target.files[0]) {
          loadUploadedImage(e.target.files[0]);
        }
      });
    }

    const controls = [
      els.densitySelect, els.columnRange, els.contrastRange,
      els.brightnessRange, els.invertToggle, els.edgeToggle
    ];

    controls.forEach(control => {
      if (control) {
        control.addEventListener("input", () => {
          updateControlLabels();
          if (state.mode !== "camera") processCurrentFrame();
        });
      }
    });

    if (els.copyBtn) {
      els.copyBtn.addEventListener("click", () => {
        if (!state.asciiText) return;
        navigator.clipboard.writeText(state.asciiText).then(() => {
          els.copyBtn.textContent = "Copied!";
          setTimeout(() => { els.copyBtn.textContent = "Copy Text"; }, 2000);
        });
      });
    }

    if (els.downloadTxtBtn) {
      els.downloadTxtBtn.addEventListener("click", () => {
        if (!state.asciiText) return;
        const payload = exporter ? exporter.toPlainText(state.lines) : state.asciiText;
        if (exporter) exporter.downloadFile("ascii-art.txt", payload, "text/plain");
      });
    }

    if (els.downloadHtmlBtn) {
      els.downloadHtmlBtn.addEventListener("click", () => {
        if (!state.lines.length) return;
        const html = exporter ? exporter.toHTML(state.lines) : "";
        if (exporter) exporter.downloadFile("ascii-art.html", html, "text/html");
      });
    }

    if (els.downloadSvgBtn) {
      els.downloadSvgBtn.addEventListener("click", () => {
        if (!state.lines.length) return;
        const svg = exporter ? exporter.toSVG(state.lines) : "";
        if (exporter) exporter.downloadFile("ascii-art.svg", svg, "image/svg+xml");
      });
    }

    if (els.sampleBtn) els.sampleBtn.addEventListener("click", loadSample);
  }

  document.addEventListener("DOMContentLoaded", () => {
    updateControlLabels();
    setupEvents();
    setEmptyState();
  });
})();

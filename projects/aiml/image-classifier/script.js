const {
  MAX_IMAGE_DIMENSION,
  calculateClampedDimensions,
  validateAndClampImage,
  resizeImage,
  formatCustomPredictions,
  canPredictCustom,
  hasLowConfidence,
  validateClassName,
  countTrainedClasses,
  getTrainedClasses,
  formatConfidence,
} = ClassifierEngine;
const imageUpload = document.getElementById("imageUpload");
const preview = document.getElementById("preview");
const uploadContent = document.getElementById("uploadContent");
const classifyBtn = document.getElementById("classifyBtn");
const resultDiv = document.getElementById("result");
const predictionPanel = document.getElementById("predictionPanel");
const mainLayout = document.querySelector(".main-layout");

// Custom Mode UI Elements
const standardModeBtn = document.getElementById("standardModeBtn");
const customModeBtn = document.getElementById("customModeBtn");
const standardContent = document.getElementById("standardContent");
const customContent = document.getElementById("customContent");
const newClassNameInput = document.getElementById("newClassName");
const addClassBtn = document.getElementById("addClassBtn");
const classesContainer = document.getElementById("classesContainer");
const customImageUpload = document.getElementById("customImageUpload");
const customClassifyBtn = document.getElementById("customClassifyBtn");

let model;
let knn;

let toastTimeout;
function showToast(message) {
  const toast = document.getElementById("statusToast");
  const msgEl = document.getElementById("statusToastMessage");
  if (!toast || !msgEl) return;
  msgEl.textContent = message;
  toast.style.display = "flex";
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.display = "none";
  }, 4000);
}
let isModelLoaded = false;
let isCustomMode = false;
let customClasses = []; // { id, name, count }
let customTestImage = null; // img element
let previewObjectURL = null;
let customTestImageURL = null;
let Engine = null;

async function loadModel() {
  resultDiv.innerHTML = `<p class="loading">Loading AI Model...</p>`;
  try {
    model = await mobilenet.load();
    knn = knnClassifier.create();
    isModelLoaded = true;
    resultDiv.innerHTML = `<p class="loading">AI Model Ready</p>`;
  } catch (error) {
    console.error("Failed to load MobileNet model:", error);
    resultDiv.innerHTML = `<p class="loading">Failed to load AI Model</p>`;
  }
}
loadModel();

function resetPredictions() {
  predictionPanel.classList.remove("active");
  mainLayout.classList.remove("shifted");
  resultDiv.innerHTML = "";
}

document.querySelectorAll(".upload-btn").forEach(btn => {
  btn.addEventListener("click", resetPredictions);
});

// Mode Switching
standardModeBtn.addEventListener("click", () => {
  isCustomMode = false;
  standardModeBtn.classList.add("active");
  customModeBtn.classList.remove("active");
  standardContent.style.display = "block";
  customContent.style.display = "none";
  resetPredictions();
});

customModeBtn.addEventListener("click", () => {
  isCustomMode = true;
  customModeBtn.classList.add("active");
  standardModeBtn.classList.remove("active");
  standardContent.style.display = "none";
  customContent.style.display = "block";
  resetPredictions();
});

// Standard Image Upload
imageUpload.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) {
    if (previewObjectURL) {
      URL.revokeObjectURL(previewObjectURL);
    }
    previewObjectURL = URL.createObjectURL(file);
    preview.src = previewObjectURL;
    preview.style.display = "block";
    uploadContent.style.display = "none";
  }
});

// Custom Test Image Upload
customImageUpload.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) {
    if (customTestImageURL) {
      URL.revokeObjectURL(customTestImageURL);
    }
    customTestImageURL = URL.createObjectURL(file);
    customTestImage = new Image();
    customTestImage.src = customTestImageURL;
    // Check if we can enable predict button
    updateCustomPredictState();
  }
});

function updateCustomPredictState() {
  if (canPredictCustom(customClasses, customTestImage)) {
    customClassifyBtn.removeAttribute("disabled");
  } else {
    customClassifyBtn.setAttribute("disabled", "true");
  }
}

// Add Class
addClassBtn.addEventListener("click", () => {
  const className = newClassNameInput.value;

  const validation = validateClassName(className, customClasses);

  if (!validation.valid) {
    showToast(validation.error);
    return;
  }

  const classObj = {
    id: Date.now().toString(),
    name: className.trim(),
    count: 0,
    urls: [],
  };

  customClasses.push(classObj);
  newClassNameInput.value = "";
  renderClasses();
  updateCustomPredictState();
});

function createElementWithText(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  return element;
}

function renderClasses() {
  classesContainer.innerHTML = "";

  customClasses.forEach(c => {
    const card = document.createElement("div");
    card.className = "class-card";

    const header = document.createElement("div");
    header.className = "class-header";

    const title = document.createElement("div");
    title.className = "class-title";
    title.appendChild(document.createTextNode(`${c.name} `));

    const count = createElementWithText(
      "span",
      "class-count",
      `${c.count} images`
    );
    count.id = `count-${c.id}`;
    title.appendChild(count);

    const removeButton = createElementWithText(
      "button",
      "remove-class-btn",
      "✕"
    );
    removeButton.type = "button";

    header.appendChild(title);
    header.appendChild(removeButton);

    const imagesContainer = document.createElement("div");
    imagesContainer.className = "class-images";
    imagesContainer.id = `images-${c.id}`;

    const addImageLabel = createElementWithText("label", "add-image-btn", "+");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.hidden = true;
    addImageLabel.appendChild(input);
    imagesContainer.appendChild(addImageLabel);

    card.appendChild(header);
    card.appendChild(imagesContainer);

    removeButton.addEventListener("click", () => {
      removeClass(c.id);
    });

    input.addEventListener("change", event => {
      addImageToClass(event, c.id);
    });

    classesContainer.appendChild(card);
  });
}

function removeClass(id) {
  const classObj = customClasses.find(c => c.id === id);
  if (classObj) {
    classObj.urls.forEach(url => URL.revokeObjectURL(url));
  }
  customClasses = customClasses.filter(c => c.id !== id);
  if (knn.getNumClasses() > 0) {
    try {
      knn.clearClass(id);
    } catch (e) { }
  }
  renderClasses();
  updateCustomPredictState();
}

async function addImageToClass(event, id) {
  if (!isModelLoaded) {
    showToast("AI Model still loading...");
    return;
  }
  const files = event.target.files;
  if (!files.length) return;

  const classObj = customClasses.find(c => c.id === id);
  const imagesContainer = document.getElementById(`images-${id}`);
  const addBtn = imagesContainer.querySelector(".add-image-btn");

  for (let file of files) {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    classObj.urls.push(objectUrl);

    await new Promise(resolve => {
      img.addEventListener("load", () => {
        const resizeResult = resizeImage(img, MAX_IMAGE_DIMENSION);
        if (!resizeResult.valid) {
          showToast("Invalid training image.");
          resolve();
          return;
        }
        if (resizeResult.resized && resizeResult.warning) {
          showToast(resizeResult.warning);
        }
        const activation = model.infer(resizeResult.element, true);
        knn.addExample(activation, id);

        classObj.count++;
        document.getElementById(`count-${id}`).textContent =
          `${classObj.count} images`;

        const wrapper = document.createElement("div");
        wrapper.className = "thumb-wrapper";

        const thumbnail = document.createElement("img");
        thumbnail.src = objectUrl;
        thumbnail.alt = `Training image for ${classObj.name}`;
        wrapper.appendChild(thumbnail);

        // Add before the "+" button.
        imagesContainer.insertBefore(wrapper, addBtn);
        resolve();
      });
      img.addEventListener("error", () => {
        showToast("Failed to load training image.");
        resolve();
      });
    });
  }

  event.target.value = ""; // Reset input
  updateCustomPredictState();
};

// Prediction Logic
async function performPrediction() {
  if (!isModelLoaded) {
    showToast("AI Model is still loading...");
    return;
  }

  predictionPanel.classList.add("active");
  mainLayout.classList.add("shifted");
  resultDiv.innerHTML = `<p class="loading">🔍 Analyzing...</p>`;

  try {
    if (!isCustomMode) {
      // Standard Inference
      if (!preview.src || preview.src.includes("data:image/gif")) {
        showToast("Please upload an image first!");
        resetPredictions();
        return;
      }
      const resizeResult = resizeImage(preview, MAX_IMAGE_DIMENSION);
      if (!resizeResult.valid) {
        showToast("Invalid image provided!");
        resetPredictions();
        return;
      }
      if (resizeResult.resized && resizeResult.warning) {
        showToast(resizeResult.warning);
      }
      const predictions = await model.classify(resizeResult.element);
      renderPredictions(
        predictions.map(p => ({
          className: p.className,
          probability: p.probability,
        }))
      );
    } else {
      // Custom Inference
      if (!customTestImage) {
        showToast("Please upload a test image first!");
        resetPredictions();
        return;
      }
      const resizeResult = resizeImage(customTestImage, MAX_IMAGE_DIMENSION);
      if (!resizeResult.valid) {
        showToast("Invalid test image provided!");
        resetPredictions();
        return;
      }
      if (resizeResult.resized && resizeResult.warning) {
        showToast(resizeResult.warning);
      }
      const activation = model.infer(resizeResult.element, true);
      const result = await knn.predictClass(activation);

      // Format for rendering
      const formatted = formatCustomPredictions(
        result.confidences,
        customClasses
      );


      renderPredictions(formatted);
    }
  } catch (error) {
    resultDiv.innerHTML = `<p class="loading">❌ Error analyzing image</p>`;
    console.error(error);
  }
}

function renderPredictions(predictions) {
  resultDiv.innerHTML = "";

  if (predictions.length > 0 && predictions[0].probability < 0.1) {
    resultDiv.appendChild(
      createElementWithText(
        "p",
        "loading",
        "Low confidence prediction. Try providing more training data or a clearer image."
      )
    );
  }

  predictions.forEach((prediction, index) => {
    if (prediction.probability === 0) return; // Hide 0% in custom mode

    const confidence = formatConfidence(prediction.probability);
    const predictionCard = document.createElement("div");
    predictionCard.className = "prediction";
    predictionCard.style.animationDelay = `${index * 0.08}s`;

    const predictionTop = document.createElement("div");
    predictionTop.className = "prediction-top";
    predictionTop.appendChild(
      createElementWithText("div", "class-name", prediction.className)
    );
    predictionTop.appendChild(
      createElementWithText("div", "confidence", `${confidence}%`)
    );

    const bar = document.createElement("div");
    bar.className = "bar";

    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = `${confidence}%`;
    bar.appendChild(fill);

    predictionCard.appendChild(predictionTop);
    predictionCard.appendChild(bar);
    resultDiv.appendChild(predictionCard);
  });
}

classifyBtn.addEventListener("click", performPrediction);
customClassifyBtn.addEventListener("click", performPrediction);

function cleanupObjectUrls() {
  if (previewObjectURL) {
    URL.revokeObjectURL(previewObjectURL);
    previewObjectURL = null;
  }
  if (customTestImageURL) {
    URL.revokeObjectURL(customTestImageURL);
    customTestImageURL = null;
  }
  if (customClasses) {
    customClasses.forEach(c => {
      if (c.urls) {
        c.urls.forEach(url => URL.revokeObjectURL(url));
        c.urls = [];
      }
    });
  }
}

window.addEventListener("beforeunload", cleanupObjectUrls);


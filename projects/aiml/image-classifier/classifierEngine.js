/**
 * @fileoverview Pure logic for the AI Image Classifier.
 * @description Contains testable classification and custom-model utilities.
 */

/**
 * Maximum allowed image dimensions and file size.
 */
const IMAGE_SIZE_LIMITS = {
  maxDimension: 1024,       // Max width or height in pixels
  maxFileSize: 10 * 1024 * 1024, // 10 MB
};

/**
 * Validates image dimensions against size limits.
 *
 * @param {number} width  - Image width in pixels.
 * @param {number} height - Image height in pixels.
 * @returns {{ valid: boolean, warning: string|null }}
 */
function validateImageSize(width, height) {
  const { maxDimension } = IMAGE_SIZE_LIMITS;
  if (width > maxDimension || height > maxDimension) {
    return {
      valid: true,
      warning: `Image is ${width}×${height}px. It will be resized to fit within ${maxDimension}px for faster inference.`,
    };
  }
  return { valid: true, warning: null };
}

/**
 * Checks whether a file exceeds the size limit.
 *
 * @param {File} file - The uploaded file object.
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateFileSize(file) {
  if (file.size > IMAGE_SIZE_LIMITS.maxFileSize) {
    const maxMB = IMAGE_SIZE_LIMITS.maxFileSize / (1024 * 1024);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is ${fileMB}MB, which exceeds the ${maxMB}MB limit.`,
    };
  }
  return { valid: true, error: null };
}

/**
 * Clamps an image to the maximum dimensions by resizing via an offscreen canvas.
 * Returns the original image if no resize is needed.
 *
 * @param {HTMLImageElement} img - The loaded image element.
 * @returns {HTMLImageElement} The (possibly resized) image.
 */
function clampImageToLimits(img) {
  const { maxDimension } = IMAGE_SIZE_LIMITS;
  if (img.naturalWidth <= maxDimension && img.naturalHeight <= maxDimension) {
    return img;
  }

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > h) {
    h = Math.round((h / w) * maxDimension);
    w = maxDimension;
  } else {
    w = Math.round((w / h) * maxDimension);
    h = maxDimension;
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const resized = new Image();
  resized.src = canvas.toDataURL("image/png");
  return resized;
}

/**
 * Formats KNN confidence results into prediction objects.
 *
 * @param {Object} confidences - Map of class IDs to confidence values.
 * @param {Array} customClasses - Custom class definitions.
 * @returns {Array<{className: string, probability: number}>}
 */
function formatCustomPredictions(confidences, customClasses) {
  return Object.entries(confidences)
    .map(([classId, probability]) => {
      const classObj = customClasses.find(c => c.id === classId);

      return {
        className: classObj ? classObj.name : "Unknown",
        probability,
      };
    })
    .sort((a, b) => b.probability - a.probability);
}

/**
 * Checks whether custom prediction can be performed.
 *
 * Prediction requires:
 * - At least two classes containing training images.
 * - A test image.
 *
 * @param {Array} customClasses - Custom class definitions.
 * @param {Object|null} testImage - Uploaded test image.
 * @returns {boolean}
 */
function canPredictCustom(customClasses, testImage) {
  const validClassesCount = customClasses.filter(
    classObj => classObj.count > 0
  ).length;

  return validClassesCount >= 2 && !!testImage;
}

/**
 * Checks whether a prediction has low confidence.
 *
 * @param {Array} predictions - Prediction objects.
 * @param {number} threshold - Confidence threshold.
 * @returns {boolean}
 */
function hasLowConfidence(predictions, threshold = 0.1) {
  if (!predictions || predictions.length === 0) {
    return false;
  }

  return predictions[0].probability < threshold;
}

/**
 * Validates a new custom class name.
 *
 * @param {string} className - Class name entered by the user.
 * @param {Array} customClasses - Existing custom classes.
 * @returns {{valid: boolean, error: string|null}}
 */
function validateClassName(className, customClasses) {
  const name = className.trim();

  if (!name) {
    return {
      valid: false,
      error: "Class name cannot be empty.",
    };
  }

  if (customClasses.some(c => c.name === name)) {
    return {
      valid: false,
      error: "Class name already exists.",
    };
  }

  return {
    valid: true,
    error: null,
  };
}

/**
 * Counts custom classes that contain training images.
 *
 * @param {Array} customClasses - Custom class definitions.
 * @returns {number}
 */
function countTrainedClasses(customClasses) {
  return customClasses.filter(classObj => classObj.count > 0).length;
}

/**
 * Removes classes with zero training images.
 *
 * @param {Array} customClasses - Custom class definitions.
 * @returns {Array}
 */
function getTrainedClasses(customClasses) {
  return customClasses.filter(classObj => classObj.count > 0);
}

/**
 * Converts prediction probabilities to percentage values.
 *
 * @param {number} probability - Probability between 0 and 1.
 * @returns {string}
 */
function formatConfidence(probability) {
  return (probability * 100).toFixed(2);
}

(function (root) {
  const api = {
    IMAGE_SIZE_LIMITS,
    validateImageSize,
    validateFileSize,
    clampImageToLimits,
    formatCustomPredictions,
    canPredictCustom,
    hasLowConfidence,
    validateClassName,
    countTrainedClasses,
    getTrainedClasses,
    formatConfidence,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ClassifierEngine = api;
})(typeof self !== "undefined" ? self : this);

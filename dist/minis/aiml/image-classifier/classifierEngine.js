/**
 * @fileoverview Pure logic for the AI Image Classifier.
 * @description Contains testable classification and custom-model utilities.
 */

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

/**
 * Maximum allowed dimension (width or height) for input images.
 */
const MAX_IMAGE_DIMENSION = 1024;

/**
 * Calculates new dimensions for an image clamped to maxDimension while preserving aspect ratio.
 *
 * @param {number} width - Original image width.
 * @param {number} height - Original image height.
 * @param {number} [maxDimension=MAX_IMAGE_DIMENSION] - Maximum allowed dimension.
 * @returns {{width: number, height: number, resized: boolean}}
 */
function calculateClampedDimensions(width, height, maxDimension = MAX_IMAGE_DIMENSION) {
  const w = Number(width);
  const h = Number(height);
  const max = Number(maxDimension);

  if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
    return { width: 0, height: 0, resized: false };
  }

  if (w <= max && h <= max) {
    return { width: w, height: h, resized: false };
  }

  let newWidth;
  let newHeight;
  if (w >= h) {
    newWidth = max;
    newHeight = Math.round((h * max) / w);
  } else {
    newHeight = max;
    newWidth = Math.round((w * max) / h);
  }

  return {
    width: newWidth,
    height: newHeight,
    resized: true,
  };
}

/**
 * Validates and checks whether image dimensions exceed the maximum dimension limit.
 *
 * @param {Object} imageInput - Object with width and height or naturalWidth and naturalHeight properties.
 * @param {number} [maxDimension=MAX_IMAGE_DIMENSION]
 * @returns {{valid: boolean, resized: boolean, width: number, height: number, originalWidth: number, originalHeight: number, warning: string|null, error: string|null}}
 */
function validateAndClampImage(imageInput, maxDimension = MAX_IMAGE_DIMENSION) {
  if (!imageInput) {
    return {
      valid: false,
      resized: false,
      width: 0,
      height: 0,
      originalWidth: 0,
      originalHeight: 0,
      warning: null,
      error: "No image input provided.",
    };
  }

  const origWidth = imageInput.naturalWidth || imageInput.width || 0;
  const origHeight = imageInput.naturalHeight || imageInput.height || 0;

  if (!origWidth || !origHeight || origWidth <= 0 || origHeight <= 0) {
    return {
      valid: false,
      resized: false,
      width: 0,
      height: 0,
      originalWidth: origWidth,
      originalHeight: origHeight,
      warning: null,
      error: "Invalid or zero-sized image input.",
    };
  }

  const clamped = calculateClampedDimensions(origWidth, origHeight, maxDimension);

  if (clamped.resized) {
    return {
      valid: true,
      resized: true,
      width: clamped.width,
      height: clamped.height,
      originalWidth: origWidth,
      originalHeight: origHeight,
      warning: `Image dimensions (${origWidth}x${origHeight}) exceeded the maximum limit of ${maxDimension}px and were resized to ${clamped.width}x${clamped.height}.`,
      error: null,
    };
  }

  return {
    valid: true,
    resized: false,
    width: origWidth,
    height: origHeight,
    originalWidth: origWidth,
    originalHeight: origHeight,
    warning: null,
    error: null,
  };
}

/**
 * Resizes an image element using HTMLCanvasElement if it exceeds maxDimension.
 *
 * @param {Object} imageElement - Image element or object.
 * @param {number} [maxDimension=MAX_IMAGE_DIMENSION]
 * @returns {{element: Object, resized: boolean, warning: string|null, valid: boolean, error: string|null}}
 */
function resizeImage(imageElement, maxDimension = MAX_IMAGE_DIMENSION) {
  const check = validateAndClampImage(imageElement, maxDimension);
  if (!check.valid) {
    return {
      element: imageElement,
      resized: false,
      warning: null,
      valid: false,
      error: check.error,
    };
  }

  if (!check.resized) {
    return {
      element: imageElement,
      resized: false,
      warning: null,
      valid: true,
      error: null,
    };
  }

  if (typeof document !== "undefined" && document.createElement) {
    const canvas = document.createElement("canvas");
    canvas.width = check.width;
    canvas.height = check.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(imageElement, 0, 0, check.width, check.height);
      return {
        element: canvas,
        resized: true,
        warning: check.warning,
        valid: true,
        error: null,
      };
    }
  }

  return {
    element: imageElement,
    resized: true,
    warning: check.warning,
    valid: true,
    error: null,
  };
}

(function (root) {
  const api = {
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
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  root.ClassifierEngine = api;
})(typeof self !== "undefined" ? self : this);

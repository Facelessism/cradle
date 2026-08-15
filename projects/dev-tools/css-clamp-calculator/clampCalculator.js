(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ClampCalculator = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const PRESETS = [
    {
      id: "font-size",
      name: "Font Size",
      property: "font-size",
      minViewport: 320,
      maxViewport: 1280,
      minValue: 1,
      maxValue: 2.25,
      unit: "rem",
    },
    {
      id: "padding",
      name: "Section Padding",
      property: "padding-block",
      minViewport: 360,
      maxViewport: 1440,
      minValue: 1.5,
      maxValue: 6,
      unit: "rem",
    },
    {
      id: "gap",
      name: "Grid Gap",
      property: "gap",
      minViewport: 360,
      maxViewport: 1200,
      minValue: 0.75,
      maxValue: 2,
      unit: "rem",
    },
    {
      id: "container-width",
      name: "Container Width",
      property: "max-width",
      minViewport: 768,
      maxViewport: 1440,
      minValue: 42,
      maxValue: 72,
      unit: "rem",
    },
  ];

  function toNumber(value, name) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(`${name} must be a valid number.`);
    }
    return number;
  }

  function round(value, places = 4) {
    const factor = 10 ** places;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function formatNumber(value) {
    const rounded = round(value);
    return Number.isInteger(rounded)
      ? String(rounded)
      : String(rounded).replace(/0+$/, "").replace(/\.$/, "");
  }

  function validateInput(input) {
    const minViewport = toNumber(input.minViewport, "Minimum viewport");
    const maxViewport = toNumber(input.maxViewport, "Maximum viewport");
    const minValue = toNumber(input.minValue, "Minimum value");
    const maxValue = toNumber(input.maxValue, "Maximum value");
    const unit = input.unit || "rem";
    const property = input.property || "font-size";

    if (minViewport <= 0 || maxViewport <= 0) {
      throw new Error("Viewport values must be greater than zero.");
    }

    if (maxViewport <= minViewport) {
      throw new Error("Maximum viewport must be greater than minimum viewport.");
    }

    if (maxValue < minValue) {
      throw new Error("Maximum value must be greater than or equal to minimum value.");
    }

    if (!["px", "rem"].includes(unit)) {
      throw new Error("Unit must be px or rem.");
    }

    return {
      minViewport,
      maxViewport,
      minValue,
      maxValue,
      unit,
      property,
    };
  }

  function calculatePreferredValue(input) {
    const values = validateInput(input);
    const base = values.unit === "rem" ? 16 : 1;
    const minVp = values.minViewport / base;
    const maxVp = values.maxViewport / base;
    const slope = ((values.maxValue - values.minValue) / (maxVp - minVp)) * 100;
    const intercept = values.minValue - (slope * minVp) / 100;

    return {
      ...values,
      slope: round(slope),
      intercept: round(intercept),
    };
  }

  function generateClamp(input) {
    const result = calculatePreferredValue(input);
    const min = `${formatNumber(result.minValue)}${result.unit}`;
    const max = `${formatNumber(result.maxValue)}${result.unit}`;
    const intercept = `${formatNumber(result.intercept)}${result.unit}`;
    const slope = `${formatNumber(result.slope)}vw`;
    const operator = result.intercept < 0 ? "-" : "+";
    const preferred = result.intercept < 0
      ? `calc(${slope} - ${formatNumber(Math.abs(result.intercept))}${result.unit})`
      : `calc(${intercept} ${operator} ${slope})`;

    return {
      ...result,
      min,
      max,
      preferred,
      clamp: `clamp(${min}, ${preferred}, ${max})`,
      cssRule: `${result.property}: clamp(${min}, ${preferred}, ${max});`,
      explanation: `The preferred value changes by ${formatNumber(result.slope)}${result.unit} for every 100px of viewport width, starting from an intercept of ${formatNumber(result.intercept)}${result.unit}.`,
    };
  }

  function pxToRem(px, baseFontSize = 16) {
    const pixels = toNumber(px, "Pixels");
    const base = toNumber(baseFontSize, "Base font size");
    if (base <= 0) {
      throw new Error("Base font size must be greater than zero.");
    }
    return round(pixels / base);
  }

  function remToPx(rem, baseFontSize = 16) {
    const remValue = toNumber(rem, "REM value");
    const base = toNumber(baseFontSize, "Base font size");
    if (base <= 0) {
      throw new Error("Base font size must be greater than zero.");
    }
    return round(remValue * base);
  }

  function convertValue(value, fromUnit, toUnit, baseFontSize = 16) {
    if (fromUnit === toUnit) return toNumber(value, "Value");
    if (fromUnit === "px" && toUnit === "rem") return pxToRem(value, baseFontSize);
    if (fromUnit === "rem" && toUnit === "px") return remToPx(value, baseFontSize);
    throw new Error("Unsupported unit conversion.");
  }

  return {
    PRESETS,
    calculatePreferredValue,
    convertValue,
    formatNumber,
    generateClamp,
    pxToRem,
    remToPx,
    validateInput,
  };
});

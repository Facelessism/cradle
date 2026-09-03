const presetSelect = document.getElementById("presetSelect");
const propertyInput = document.getElementById("propertyInput");
const unitSelect = document.getElementById("unitSelect");
const minViewport = document.getElementById("minViewport");
const maxViewport = document.getElementById("maxViewport");
const minValue = document.getElementById("minValue");
const maxValue = document.getElementById("maxValue");
const copyCssBtn = document.getElementById("copyCssBtn");
const swapUnitBtn = document.getElementById("swapUnitBtn");
const clampOutput = document.getElementById("clampOutput");
const cssOutput = document.getElementById("cssOutput");
const explanation = document.getElementById("explanation");
const message = document.getElementById("message");
const previewBox = document.getElementById("previewBox");
const previewMeta = document.getElementById("previewMeta");

let currentResult = null;

function setMessage(text, type = "info") {
  message.textContent = text;
  message.dataset.type = type;
}

function readInput() {
  return {
    property: propertyInput.value.trim() || "font-size",
    unit: unitSelect.value,
    minViewport: minViewport.value,
    maxViewport: maxViewport.value,
    minValue: minValue.value,
    maxValue: maxValue.value,
  };
}

function updatePreview(result) {
  previewBox.style.removeProperty("font-size");
  previewBox.style.removeProperty("padding");
  previewBox.style.removeProperty("gap");
  previewBox.style.removeProperty("max-width");
  // Defensive: only set allowed properties (validate again even though
  // ClampCalculator already sanitizes the property)
  const isAllowed =
    typeof window !== "undefined" &&
    window.CradleSanitizeCss &&
    window.CradleSanitizeCss.isAllowedCssProperty
      ? window.CradleSanitizeCss.isAllowedCssProperty(result.property)
      : /^[a-z][a-z0-9-]*$/.test(result.property);
  if (isAllowed) {
    previewBox.style.setProperty(result.property, result.clamp);
  }

  if (result.property === "max-width") {
    previewBox.style.width = "100%";
    previewBox.style.marginInline = "auto";
  }

  previewMeta.textContent = `${result.property} scales from ${result.min} at ${result.minViewport}px to ${result.max} at ${result.maxViewport}px.`;
}

function render() {
  try {
    const result = ClampCalculator.generateClamp(readInput());
    currentResult = result;
    clampOutput.textContent = result.clamp;
    cssOutput.textContent = result.cssRule;
    explanation.textContent = result.explanation;
    updatePreview(result);
    setMessage("Clamp formula updated.", "success");
  } catch (error) {
    currentResult = null;
    setMessage(error.message, "error");
  }
}

function applyPreset(preset) {
  propertyInput.value = preset.property;
  unitSelect.value = preset.unit;
  minViewport.value = preset.minViewport;
  maxViewport.value = preset.maxViewport;
  minValue.value = preset.minValue;
  maxValue.value = preset.maxValue;
  render();
}

function renderPresets() {
  presetSelect.innerHTML = ClampCalculator.PRESETS.map(
    preset => `<option value="${preset.id}">${preset.name}</option>`
  ).join("");

  presetSelect.addEventListener("change", () => {
    const preset = ClampCalculator.PRESETS.find(
      item => item.id === presetSelect.value
    );
    if (preset) applyPreset(preset);
  });
}

async function copyCss() {
  if (!currentResult) {
    render();
  }
  if (!currentResult) return;

  await navigator.clipboard.writeText(currentResult.cssRule);
  const original = copyCssBtn.textContent;
  copyCssBtn.textContent = "Copied";
  setTimeout(() => {
    copyCssBtn.textContent = original;
  }, 1200);
}

function convertUnit() {
  const fromUnit = unitSelect.value;
  const toUnit = fromUnit === "rem" ? "px" : "rem";

  try {
    minValue.value = ClampCalculator.formatNumber(
      ClampCalculator.convertValue(minValue.value, fromUnit, toUnit)
    );
    maxValue.value = ClampCalculator.formatNumber(
      ClampCalculator.convertValue(maxValue.value, fromUnit, toUnit)
    );
    unitSelect.value = toUnit;
    render();
  } catch (error) {
    setMessage(error.message, "error");
  }
}

[
  propertyInput,
  unitSelect,
  minViewport,
  maxViewport,
  minValue,
  maxValue,
].forEach(input => {
  input.addEventListener("input", render);
  input.addEventListener("change", render);
});

copyCssBtn.addEventListener("click", copyCss);
swapUnitBtn.addEventListener("click", convertUnit);

renderPresets();
applyPreset(ClampCalculator.PRESETS[0]);

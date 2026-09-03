const formatSelect = document.getElementById("formatSelect");
const encodeModeBtn = document.getElementById("encodeModeBtn");
const decodeModeBtn = document.getElementById("decodeModeBtn");
const swapBtn = document.getElementById("swapBtn");

const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const inputCount = document.getElementById("inputCount");
const outputCount = document.getElementById("outputCount");
const errorMessage = document.getElementById("errorMessage");

const copyBtn = document.getElementById("copyBtn");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");

// Maps each format to its {encode, decode} pair from logic.js.
const CONVERTERS = {
  base64: { encode: encodeBase64, decode: decodeBase64 },
  url: { encode: encodeURLText, decode: decodeURLText },
  html: { encode: encodeHTML, decode: decodeHTML },
  unicode: { encode: encodeUnicode, decode: decodeUnicode },
  hex: { encode: encodeHex, decode: decodeHex },
  binary: { encode: encodeBinary, decode: decodeBinary },
};

let mode = "encode";
let debounceTimer = null;

function setMode(newMode) {
  mode = newMode;

  encodeModeBtn.classList.toggle("active", mode === "encode");
  encodeModeBtn.setAttribute("aria-checked", String(mode === "encode"));

  decodeModeBtn.classList.toggle("active", mode === "decode");
  decodeModeBtn.setAttribute("aria-checked", String(mode === "decode"));

  convert();
}

function convert() {
  const format = formatSelect.value;
  const converter = CONVERTERS[format];
  const raw = inputText.value;

  inputCount.textContent = `${raw.length} chars`;

  if (raw === "") {
    outputText.value = "";
    outputCount.textContent = "0 chars";
    hideError();
    return;
  }

  try {
    const fn = mode === "encode" ? converter.encode : converter.decode;
    const result = fn(raw);

    outputText.value = result;
    outputCount.textContent = `${result.length} chars`;
    hideError();
  } catch (err) {
    outputText.value = "";
    outputCount.textContent = "0 chars";
    showError(err.message);
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

function hideError() {
  errorMessage.hidden = true;
}

// Debounce only large inputs; anything typing-speed sized converts instantly.
function handleInput() {
  if (inputText.value.length > 5000) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(convert, 150);
  } else {
    convert();
  }
}

function swapInputOutput() {
  const currentOutput = outputText.value;

  if (errorMessage.hidden === false) return; // don't swap in a broken conversion

  inputText.value = currentOutput;
  setMode(mode === "encode" ? "decode" : "encode");
}

function copyOutput() {
  if (!outputText.value) return;

  navigator.clipboard.writeText(outputText.value).then(() => {
    copyBtn.textContent = "Copied!";
    copyBtn.classList.add("copied");

    setTimeout(() => {
      copyBtn.textContent = "Copy Output";
      copyBtn.classList.remove("copied");
    }, 1200);
  });
}

function exportOutput() {
  if (!outputText.value) return;

  const format = formatSelect.value;
  const blob = new Blob([outputText.value], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${format}-${mode}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function clearFields() {
  inputText.value = "";
  outputText.value = "";
  inputCount.textContent = "0 chars";
  outputCount.textContent = "0 chars";
  hideError();
  inputText.focus();
}

formatSelect.addEventListener("change", convert);
encodeModeBtn.addEventListener("click", () => setMode("encode"));
decodeModeBtn.addEventListener("click", () => setMode("decode"));
swapBtn.addEventListener("click", swapInputOutput);

inputText.addEventListener("input", handleInput);

copyBtn.addEventListener("click", copyOutput);
exportBtn.addEventListener("click", exportOutput);
clearBtn.addEventListener("click", clearFields);
const { escapeHtml } = window.CradleEscape;
const {
  buildRequestOptions,
  formatResponseHeaders,
  formatBytes,
  formatDuration,
  formatResponseBody,
  statusTone,
  fetchWithTimeout,
  parseCurlCommand,
  generateCurlSnippet,
  generateFetchSnippet,
  generatePythonSnippet,
  computeTimingBreakdown,
} = window.APIEngine;

const methodSelect = document.getElementById("methodSelect");
const urlInput = document.getElementById("urlInput");
const headersInput = document.getElementById("headersInput");
const bodyInput = document.getElementById("bodyInput");
const sendBtn = document.getElementById("sendBtn");
const copyBodyBtn = document.getElementById("copyBodyBtn");

const errorBox = document.getElementById("errorBox");
const resultPanel = document.getElementById("resultPanel");
const emptyState = document.getElementById("emptyState");
const headersList = document.getElementById("headersList");
const bodyCode = document.getElementById("bodyCode");

const summaryStatus = document.getElementById("summaryStatus");
const summaryTime = document.getElementById("summaryTime");
const summarySize = document.getElementById("summarySize");
const summaryHeaders = document.getElementById("summaryHeaders");

// cURL Import Elements
const importCurlBtn = document.getElementById("importCurlBtn");
const curlImportBox = document.getElementById("curlImportBox");
const curlCommandInput = document.getElementById("curlCommandInput");
const applyCurlBtn = document.getElementById("applyCurlBtn");
const closeCurlBtn = document.getElementById("closeCurlBtn");
const sampleChips = document.querySelectorAll("[data-curl-sample]");

// Request Replay & Timing Elements
const replayBtn = document.getElementById("replayBtn");
const timingSourcePill = document.getElementById("timingSourcePill");
const segDns = document.getElementById("segDns");
const segTcp = document.getElementById("segTcp");
const segTtfb = document.getElementById("segTtfb");
const segDownload = document.getElementById("segDownload");
const timingDnsVal = document.getElementById("timingDnsVal");
const timingTcpVal = document.getElementById("timingTcpVal");
const timingTtfbVal = document.getElementById("timingTtfbVal");
const timingDownloadVal = document.getElementById("timingDownloadVal");
const timingTotalVal = document.getElementById("timingTotalVal");

// Code Snippet Elements
const snippetCode = document.getElementById("snippetCode");
const copySnippetBtn = document.getElementById("copySnippetBtn");
const snippetTabs = document.querySelectorAll(".snippet-tab");

let lastBodyText = "";
let currentSnippetLanguage = "curl";

// Event Listeners
sendBtn.addEventListener("click", sendRequest);
urlInput.addEventListener("keydown", e => {
  if (e.key === "Enter") sendRequest();
});

if (replayBtn) {
  replayBtn.addEventListener("click", sendRequest);
}

copyBodyBtn.addEventListener("click", () => {
  if (!lastBodyText) return;
  navigator.clipboard.writeText(lastBodyText);
  copyBodyBtn.textContent = "Copied!";
  setTimeout(() => (copyBodyBtn.textContent = "Copy body"), 1200);
});

// cURL Import Wiring
if (importCurlBtn) {
  importCurlBtn.addEventListener("click", () => {
    curlImportBox.hidden = !curlImportBox.hidden;
    if (!curlImportBox.hidden) {
      curlCommandInput.focus();
    }
  });
}

if (closeCurlBtn) {
  closeCurlBtn.addEventListener("click", () => {
    curlImportBox.hidden = true;
  });
}

if (applyCurlBtn) {
  applyCurlBtn.addEventListener("click", handleApplyCurl);
}

sampleChips.forEach(chip => {
  chip.addEventListener("click", () => {
    const sampleType = chip.dataset.curlSample;
    if (sampleType === "get") {
      curlCommandInput.value =
        'curl -X GET "https://jsonplaceholder.typicode.com/todos/1" -H "Accept: application/json"';
    } else if (sampleType === "post") {
      curlCommandInput.value =
        'curl -X POST "https://jsonplaceholder.typicode.com/posts" \\\n  -H "Content-Type: application/json" \\\n  -d \'{"title": "foo", "body": "bar", "userId": 1}\'';
    } else if (sampleType === "auth") {
      curlCommandInput.value =
        'curl -X GET "https://api.github.com/user" \\\n  -H "Authorization: Bearer sample_ghp_token123" \\\n  -H "User-Agent: Cradle-Inspector"';
    }
  });
});

// Snippet Tabs Wiring
snippetTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    snippetTabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentSnippetLanguage = tab.dataset.snippet;
    updateCodeSnippets();
  });
});

if (copySnippetBtn) {
  copySnippetBtn.addEventListener("click", () => {
    const code = snippetCode.textContent;
    if (!code) return;
    navigator.clipboard.writeText(code);
    copySnippetBtn.textContent = "Copied!";
    setTimeout(() => (copySnippetBtn.textContent = "Copy Snippet"), 1200);
  });
}

// Live update snippets when inputs change
[methodSelect, urlInput, headersInput, bodyInput].forEach(el => {
  if (el) el.addEventListener("input", updateCodeSnippets);
});

function handleApplyCurl() {
  const curlText = curlCommandInput.value.trim();
  if (!curlText) return;

  const parsed = parseCurlCommand(curlText);

  if (parsed.method) {
    methodSelect.value = parsed.method;
  }
  if (parsed.url) {
    urlInput.value = parsed.url;
  }
  if (parsed.headersText) {
    headersInput.value = parsed.headersText;
  }
  if (parsed.body) {
    bodyInput.value = parsed.body;
  }

  // Auto-expand advanced headers/body details if present
  const advancedDetails = document.querySelector(".advanced");
  if (advancedDetails && (parsed.headersText || parsed.body)) {
    advancedDetails.open = true;
  }

  curlImportBox.hidden = true;
  updateCodeSnippets();
}

function updateCodeSnippets() {
  if (!snippetCode) return;

  const requestData = {
    method: methodSelect.value,
    url: urlInput.value.trim() || "https://api.example.com",
    headers: headersInput.value,
    body: bodyInput.value,
  };

  let code = "";
  if (currentSnippetLanguage === "curl") {
    code = generateCurlSnippet(requestData);
  } else if (currentSnippetLanguage === "fetch") {
    code = generateFetchSnippet(requestData);
  } else if (currentSnippetLanguage === "python") {
    code = generatePythonSnippet(requestData);
  }

  snippetCode.textContent = code;
}

async function sendRequest() {
  const rawUrl = urlInput.value.trim();
  if (!rawUrl) {
    showError("Enter a URL first.");
    return;
  }

  let url;
  try {
    url = new URL(
      /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rawUrl)
        ? rawUrl
        : `https://${rawUrl}`
    );
  } catch {
    showError("That doesn't look like a valid URL.");
    return;
  }

  const method = methodSelect.value;
  const { options } = buildRequestOptions(
    method,
    headersInput.value,
    bodyInput.value
  );

  setLoading(true);
  const startedAt = performance.now();

  try {
    const response = await fetchWithTimeout(url.toString(), options, 10000);
    const elapsed = performance.now() - startedAt;
    const text = await response.text();

    // Query Performance API for resource timing
    let resourceEntry = null;
    if (typeof performance !== "undefined" && performance.getEntriesByName) {
      const entries = performance.getEntriesByName(url.toString());
      if (entries.length > 0) {
        resourceEntry = entries[entries.length - 1];
      }
    }

    renderResult(response, text, elapsed, resourceEntry);
  } catch (err) {
    if (err.message && err.message.includes("timed out")) {
      showError(
        "Request timed out. The server took too long to respond (timeout limit: 10s)."
      );
    } else {
      showError(
        "Request failed. This is often caused by the API not allowing " +
          "cross-origin requests (CORS), an invalid URL, or a network issue.\n\n" +
          `Details: ${err.message}`
      );
    }
  } finally {
    setLoading(false);
  }
}

function renderResult(response, text, elapsed, resourceEntry = null) {
  hideError();
  resultPanel.hidden = false;
  emptyState.hidden = true;

  const tone = statusTone(response.status);
  summaryStatus.textContent = `${response.status} ${response.statusText}`;
  summaryStatus.className = `tone-${tone}`;
  summaryTime.textContent = formatDuration(elapsed);

  const sizeHeader = response.headers.get("content-length");
  const size = sizeHeader ? Number(sizeHeader) : new Blob([text]).size;
  summarySize.textContent = formatBytes(size);

  const headerRows = formatResponseHeaders(response.headers);
  summaryHeaders.textContent = String(headerRows.length);

  // Render timing breakdown
  renderTimingBreakdown(elapsed, resourceEntry);

  headersList.innerHTML = headerRows.length
    ? headerRows
        .map(
          ({ key, value }) => `
        <div class="header-row">
          <strong>${escapeHtml(key)}</strong>
          <span>${escapeHtml(value)}</span>
        </div>`
        )
        .join("")
    : `<p class="muted">No headers exposed by this response (the server may not send Access-Control-Expose-Headers).</p>`;

  const { formatted, isJson } = formatResponseBody(text);
  lastBodyText = formatted;
  bodyCode.textContent = formatted || "(empty body)";
  bodyCode.className = isJson ? "lang-json" : "lang-text";

  // Render code snippets
  updateCodeSnippets();
}

function renderTimingBreakdown(totalElapsed, resourceEntry) {
  const breakdown = computeTimingBreakdown(totalElapsed, resourceEntry);

  if (timingSourcePill) {
    timingSourcePill.textContent = breakdown.isResourceTiming
      ? "Resource Timing (High-Res)"
      : "Measured (Client-Side)";
  }

  if (timingDnsVal) timingDnsVal.textContent = breakdown.formatted.dns;
  if (timingTcpVal) timingTcpVal.textContent = breakdown.formatted.tcp;
  if (timingTtfbVal) timingTtfbVal.textContent = breakdown.formatted.ttfb;
  if (timingDownloadVal)
    timingDownloadVal.textContent = breakdown.formatted.download;
  if (timingTotalVal) timingTotalVal.textContent = breakdown.formatted.total;

  // Calculate percentages for the waterfall bar
  const total = Math.max(1, breakdown.total);
  const dnsPct = Math.min(100, (breakdown.dns / total) * 100);
  const tcpPct = Math.min(100, (breakdown.tcp / total) * 100);
  const ttfbPct = Math.min(100, (breakdown.ttfb / total) * 100);
  const downloadPct = Math.min(100, (breakdown.download / total) * 100);

  if (segDns) segDns.style.width = `${dnsPct}%`;
  if (segTcp) segTcp.style.width = `${tcpPct}%`;
  if (segTtfb) segTtfb.style.width = `${ttfbPct}%`;
  if (segDownload) segDownload.style.width = `${downloadPct}%`;
}

function showError(message) {
  resultPanel.hidden = true;
  emptyState.hidden = true;
  errorBox.hidden = false;
  errorBox.textContent = message;
}

function hideError() {
  errorBox.hidden = true;
  errorBox.textContent = "";
}

function setLoading(isLoading) {
  sendBtn.disabled = isLoading;
  sendBtn.textContent = isLoading ? "Sending..." : "Send";
  if (replayBtn) replayBtn.disabled = isLoading;
}

// Initial code snippet generation
updateCodeSnippets();

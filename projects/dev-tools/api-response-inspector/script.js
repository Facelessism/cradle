const { escapeHtml } = window.CradleEscape;
const {
    buildRequestOptions,
    formatResponseHeaders,
    formatBytes,
    formatDuration,
    formatResponseBody,
    statusTone,
    fetchWithTimeout,
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

let lastBodyText = "";

sendBtn.addEventListener("click", sendRequest);
urlInput.addEventListener("keydown", e => {
    if (e.key === "Enter") sendRequest();
});
copyBodyBtn.addEventListener("click", () => {
    if (!lastBodyText) return;
    navigator.clipboard.writeText(lastBodyText);
    copyBodyBtn.textContent = "Copied";
    setTimeout(() => (copyBodyBtn.textContent = "Copy body"), 1200);
});

async function sendRequest() {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
        showError("Enter a URL first.");
        return;
    }

    let url;
    try {
        url = new URL(
            /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`
        );
    } catch (err) {
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

        renderResult(response, text, elapsed);
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

function renderResult(response, text, elapsed) {
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
}
const input = document.getElementById("urlInput");
const button = document.getElementById("parseBtn");
const result = document.getElementById("result");

// Pure helpers live in urlEngine.js (loaded first) so they can be unit-tested.
const { detectURLType, detectFileType, escapeHTML, encodeURLComponentSafe } = URLEngine;

button.addEventListener("click", parseURL);

function parseURL() {
  try {
    let value = input.value.trim();

    if (!value) {
      throw new Error("Empty URL");
    }

    if (typeof URLEngine !== "undefined" && typeof URLEngine.parseURLComponents === "function") {
      const { components, error } = URLEngine.parseURLComponents(value);
      if (error || !components) {
        throw new Error(error || "Invalid URL");
      }
    }

    // Add protocol if user enters example.com
    if (
      !value.startsWith("http://") &&
      !value.startsWith("https://") &&
      !value.startsWith("ftp://") &&
      !value.startsWith("mailto:") &&
      !value.startsWith("tel:")
    ) {
      value = "https://" + value;
    }

    const url = new URL(value);
    const pathname = url.pathname;
    const filename = pathname.split("/").filter(Boolean).pop() || "None";

    const extension = filename.includes(".")
      ? filename.split(".").pop().toLowerCase()
      : "None";

    const directory = pathname.substring(0, pathname.lastIndexOf("/")) || "/";

    const queryParams = [];

    url.searchParams.forEach((value, key) => {
      queryParams.push({
        key,
        value,
      });
    });

    const data = {
      // General

      Type: detectURLType(url, extension),
      FullURL: url.href,
      URLLength: `${url.href.length} characters`,
      Secure: url.protocol === "https:" ? "Yes" : "No",
      Protocol: url.protocol.replace(":", ""),
      Origin: url.origin,
      Host: url.host,
      Hostname: url.hostname,
      Port: url.port || "Default",
      Username: url.username || "None",
      Password: url.password ? "******" : "None",
      Path: encodeURLComponentSafe(pathname),
      Directory: encodeURLComponentSafe(directory),
      Filename: encodeURLComponentSafe(filename),
      Extension: extension,
      FileType: detectFileType(extension),
      Search: url.search ? encodeURLComponentSafe(url.search) : "None",
      Fragment: url.hash ? encodeURLComponentSafe(url.hash.replace("#", "")) : "None",
    };

    result.innerHTML = "";

    Object.entries(data).forEach(([key, value]) => {
      createRow(key, value);
    });

    // Query parameters section

    if (queryParams.length) {
      result.innerHTML += `
      <h3 class="section-title">
        Query Parameters
      </h3>
      `;

      queryParams.forEach(param => {
        createRow(encodeURLComponentSafe(param.key), encodeURLComponentSafe(param.value));
      });
    }
  } catch (error) {
    result.innerHTML = `
    <p class="error">
       Invalid URL
    </p>
    `;
  }
}

function createRow(label, value) {
  const div = document.createElement("div");
  div.className = "item";
  div.innerHTML = `
    <strong>${escapeHTML(label)}</strong>

    <input
      class="value"
      value="${escapeHTML(value)}"
    />

    <button class="copy">
       Copy
    </button>

  `;

  const copyButton = div.querySelector(".copy");

  const inputField = div.querySelector(".value");

  copyButton.addEventListener("click", () => {
    navigator.clipboard.writeText(inputField.value);

    copyButton.innerText = " Copied";

    setTimeout(() => {
      copyButton.innerText = " Copy";
    }, 1000);
  });

  result.appendChild(div);
}


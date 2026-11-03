/**
 * Cradle — Service Worker Registration & Lifecycle Management
 * ───────────────────────────────────────────────────────────
 * Manages service worker lifecycle, installation detection,
 * and user prompt for new deploys.
 */

const UPDATE_TOAST_ID = "cradle-update-toast";

/**
 * Creates and displays an accessible prompt asking the user to refresh
 * when a newly deployed service worker is installed and waiting.
 *
 * @param {ServiceWorker} waitingWorker
 */
export function showUpdatePrompt(waitingWorker) {
  if (typeof document === "undefined") return null;
  if (document.getElementById(UPDATE_TOAST_ID)) {
    return document.getElementById(UPDATE_TOAST_ID);
  }

  const toast = document.createElement("div");
  toast.id = UPDATE_TOAST_ID;
  toast.className = "cradle-update-toast";
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "polite");

  toast.innerHTML = `
    <div class="cradle-update-content">
      <span class="cradle-update-icon" aria-hidden="true">🚀</span>
      <span class="cradle-update-message">A new update is available!</span>
    </div>
    <div class="cradle-update-actions">
      <button id="cradle-update-refresh-btn" class="cradle-update-btn cradle-update-btn--primary">
        Refresh
      </button>
      <button id="cradle-update-dismiss-btn" class="cradle-update-btn cradle-update-btn--dismiss" aria-label="Dismiss update notification">
        ✕
      </button>
    </div>
  `;

  document.body.appendChild(toast);

  const refreshBtn = toast.querySelector("#cradle-update-refresh-btn");
  const dismissBtn = toast.querySelector("#cradle-update-dismiss-btn");

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      if (waitingWorker && typeof waitingWorker.postMessage === "function") {
        waitingWorker.postMessage({ type: "SKIP_WAITING" });
      }
      toast.remove();
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      toast.remove();
    });
  }

  return toast;
}

/**
 * Registers the service worker and hooks into update events.
 *
 * @param {string} [swUrl="./sw.js"]
 * @returns {Promise<ServiceWorkerRegistration|undefined>}
 */
export async function registerServiceWorker(swUrl = "./sw.js") {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof navigator.serviceWorker.register !== "function"
  ) {
    return;
  }

  // Reload the client when the newly installed service worker takes control
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  try {
    const registration = await navigator.serviceWorker.register(swUrl);

    // If an updated worker is already waiting, prompt immediately
    if (registration.waiting) {
      showUpdatePrompt(registration.waiting);
      return registration;
    }

    // Listen for new worker updates
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener("statechange", () => {
        // Only prompt if there is already an active controller running
        if (
          newWorker.state === "installed" &&
          navigator.serviceWorker.controller
        ) {
          showUpdatePrompt(newWorker);
        }
      });
    });

    return registration;
  } catch (error) {
    console.warn("[SW] Registration failed:", error);
  }
}

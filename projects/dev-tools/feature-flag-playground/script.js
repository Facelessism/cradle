(function () {
    "use strict";

    const els = {
        localCount: document.getElementById("totalCount"),
        devCount: document.getElementById("devCount"),
        stagingCount: document.getElementById("stagingCount"),
        prodCount: document.getElementById("prodCount"),
        searchInput: document.getElementById("searchInput"),
        newFlagBtn: document.getElementById("newFlagBtn"),
        exportBtn: document.getElementById("exportBtn"),
        importInput: document.getElementById("importInput"),
        resetBtn: document.getElementById("resetBtn"),
        flagForm: document.getElementById("flagForm"),
        flagFormWrap: document.getElementById("flagFormWrap"),
        cancelFormBtn: document.getElementById("cancelFormBtn"),
        tabs: document.querySelectorAll(".tab"),
        panels: document.querySelectorAll(".panel"),
        statusMessage: document.getElementById("statusMessage"),
        evalUserId: document.getElementById("evalUserId"),
        evalRandomBtn: document.getElementById("evalRandomBtn"),
        evalRunBtn: document.getElementById("evalRunBtn"),
        evalResults: document.getElementById("evalResults"),
    };

    let activeEnv = "development";
    let searchTerm = "";

    function escape(str) {
        return window.CradleEscape && window.CradleEscape.escapeHtml
            ? window.CradleEscape.escapeHtml(str)
            : String(str).replace(
                /[&<>"']/g,
                (c) =>
                    ({
                        "&": "&amp;",
                        "<": "&lt;",
                        ">": "&gt;",
                        '"': "&quot;",
                        "'": "&#39;",
                    })[c],
            );
    }

    function showStatus(message, tone) {
        if (!els.statusMessage) return;
        els.statusMessage.textContent = message;
        els.statusMessage.dataset.tone = tone || "info";
        if (message) {
            clearTimeout(showStatus._t);
            showStatus._t = setTimeout(() => {
                els.statusMessage.textContent = "";
            }, 3200);
        }
    }

    function updateSummary(flags) {
        els.localCount.textContent = flags.length;
        els.devCount.textContent = flags.filter(
            (f) => f.environments.development.enabled,
        ).length;
        els.stagingCount.textContent = flags.filter(
            (f) => f.environments.staging.enabled,
        ).length;
        els.prodCount.textContent = flags.filter(
            (f) => f.environments.production.enabled,
        ).length;
    }

    function rowTemplate(flag, env) {
        const state = flag.environments[env];
        return `
      <tr data-id="${flag.id}">
        <td>
          <strong>${escape(flag.name)}</strong>
          <div class="flag-key">${escape(flag.key)}</div>
          ${flag.description ? `<p class="flag-desc">${escape(flag.description)}</p>` : ""}
        </td>
        <td>
          <label class="switch">
            <input type="checkbox" class="toggle-enabled" ${state.enabled ? "checked" : ""} />
            <span class="switch-track"><span class="switch-thumb"></span></span>
          </label>
        </td>
        <td>
          <div class="rollout-control">
            <input type="range" class="rollout-range" min="0" max="100" step="5" value="${state.rollout}" ${state.enabled ? "" : "disabled"} />
            <span class="rollout-value">${state.rollout}%</span>
          </div>
        </td>
        <td>
          <button type="button" data-cradle-btn data-variant="danger" data-size="sm" class="delete-flag">Delete</button>
        </td>
      </tr>`;
    }

    function render() {
        const flags = FlagEngine.getFlags();
        updateSummary(flags);

        const filtered = flags.filter((f) => {
            if (!searchTerm) return true;
            const haystack = `${f.name} ${f.key} ${f.description}`.toLowerCase();
            return haystack.includes(searchTerm);
        });

        FlagEngine.ENVIRONMENTS.forEach((env) => {
            const tbody = document.getElementById(`${env}Rows`);
            if (!tbody) return;
            tbody.innerHTML = filtered.length
                ? filtered.map((f) => rowTemplate(f, env)).join("")
                : `<tr><td colspan="4" class="empty-row">No flags match your search.</td></tr>`;
        });

        if (window.CradleButton && window.CradleButton.upgradeAll) {
            window.CradleButton.upgradeAll();
        }
    }

    function setActiveEnv(env) {
        activeEnv = env;
        els.tabs.forEach((tab) => {
            tab.classList.toggle("active", tab.dataset.panel === env);
        });
        els.panels.forEach((panel) => {
            panel.classList.toggle("active", panel.id === env);
        });
    }

    function toggleForm(show) {
        els.flagFormWrap.classList.toggle("open", show);
        if (show) {
            els.flagForm.querySelector('input[name="name"]').focus();
        }
    }

    function bindTabs() {
        els.tabs.forEach((tab) => {
            tab.addEventListener("click", () => setActiveEnv(tab.dataset.panel));
        });
    }

    function bindForm() {
        els.newFlagBtn.addEventListener("click", () => toggleForm(true));
        els.cancelFormBtn.addEventListener("click", () => toggleForm(false));

        els.flagForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const data = new FormData(els.flagForm);
            const name = String(data.get("name") || "").trim();
            const description = String(data.get("description") || "").trim();
            if (!name) return;
            FlagEngine.createFlag(name, description);
            els.flagForm.reset();
            toggleForm(false);
            showStatus(`Flag "${name}" created.`, "success");
            render();
        });
    }

    function bindTableEvents() {
        document.querySelectorAll(".panel").forEach((panel) => {
            panel.addEventListener("change", (e) => {
                const row = e.target.closest("tr[data-id]");
                if (!row) return;
                const id = row.dataset.id;
                const env = panel.id;

                if (e.target.classList.contains("toggle-enabled")) {
                    const enabled = e.target.checked;
                    FlagEngine.updateEnvState(id, env, { enabled });
                    render();
                }

                if (e.target.classList.contains("rollout-range")) {
                    const rollout = Number(e.target.value);
                    FlagEngine.updateEnvState(id, env, { rollout });
                    render();
                }
            });

            panel.addEventListener("input", (e) => {
                if (e.target.classList.contains("rollout-range")) {
                    const row = e.target.closest("tr[data-id]");
                    const valueEl = row.querySelector(".rollout-value");
                    if (valueEl) valueEl.textContent = `${e.target.value}%`;
                }
            });

            panel.addEventListener("click", (e) => {
                if (e.target.classList.contains("delete-flag")) {
                    const row = e.target.closest("tr[data-id]");
                    if (!row) return;
                    FlagEngine.deleteFlag(row.dataset.id);
                    showStatus("Flag deleted.", "danger");
                    render();
                }
            });
        });
    }

    function bindToolbar() {
        els.searchInput.addEventListener("input", (e) => {
            searchTerm = e.target.value.trim().toLowerCase();
            render();
        });

        els.exportBtn.addEventListener("click", () => {
            const json = FlagEngine.exportJson();
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "feature-flags.json";
            a.click();
            URL.revokeObjectURL(url);
            showStatus("Flags exported.", "success");
        });

        els.importInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                FlagEngine.importJson(text);
                showStatus("Flags imported.", "success");
                render();
            } catch (err) {
                showStatus(`Import failed: ${err.message}`, "danger");
            } finally {
                e.target.value = "";
            }
        });

        els.resetBtn.addEventListener("click", () => {
            FlagEngine.resetAll();
            showStatus("Reset to demo data.", "success");
            render();
        });
    }

    function bindEvaluate() {
        els.evalRandomBtn.addEventListener("click", () => {
            els.evalUserId.value = `user-${Math.floor(Math.random() * 100000)}`;
        });

        els.evalRunBtn.addEventListener("click", () => {
            const userId = els.evalUserId.value.trim() || "anonymous";
            const flags = FlagEngine.getFlags();
            if (!flags.length) {
                els.evalResults.innerHTML = `<p class="empty-row">No flags to evaluate.</p>`;
                return;
            }
            els.evalResults.innerHTML = flags
                .map((flag) => {
                    const result = FlagEngine.evaluate(flag, activeEnv, userId);
                    return `
          <div class="eval-row ${result.on ? "on" : "off"}">
            <span class="eval-name">${escape(flag.name)}</span>
            <span class="eval-state">${result.on ? "ON" : "OFF"}</span>
            <span class="eval-bucket">${result.bucket === null ? "flag disabled" : `bucket ${result.bucket}`}</span>
          </div>`;
                })
                .join("");
        });
    }

    function init() {
        bindTabs();
        bindForm();
        bindTableEvents();
        bindToolbar();
        bindEvaluate();
        setActiveEnv(activeEnv);
        render();
    }

    document.addEventListener("DOMContentLoaded", init);
})();
/**
 * Feature Flag Playground — Engine
 * ---------------------------------
 * Pure data/logic layer. No DOM access here.
 * Flags are persisted to localStorage and evaluated with a
 * deterministic hash so the same user always gets the same
 * result for a given flag + rollout percentage.
 */

const FlagEngine = (function () {
    "use strict";

    const STORAGE_KEY = "cradle-feature-flags";
    const ENVIRONMENTS = ["development", "staging", "production"];

    function defaultEnvState(enabled) {
        return { enabled: !!enabled, rollout: enabled ? 100 : 0 };
    }

    function slugify(name) {
        return name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
    }

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function loadFlags() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : null;
        } catch (err) {
            console.error("FlagEngine: failed to read storage", err);
            return null;
        }
    }

    function saveFlags(flags) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
        return flags;
    }

    function seedDemoData() {
        const demo = [
            {
                id: uid(),
                key: "new-dashboard",
                name: "New Dashboard",
                description: "Redesigned analytics dashboard with live charts.",
                createdAt: Date.now(),
                environments: {
                    development: defaultEnvState(true),
                    staging: { enabled: true, rollout: 50 },
                    production: { enabled: false, rollout: 0 },
                },
            },
            {
                id: uid(),
                key: "checkout-v2",
                name: "Checkout V2",
                description: "Single-page checkout flow to reduce cart drop-off.",
                createdAt: Date.now(),
                environments: {
                    development: defaultEnvState(true),
                    staging: { enabled: true, rollout: 100 },
                    production: { enabled: true, rollout: 10 },
                },
            },
            {
                id: uid(),
                key: "dark-mode",
                name: "Dark Mode",
                description: "System-aware dark theme across the app.",
                createdAt: Date.now(),
                environments: {
                    development: defaultEnvState(true),
                    staging: defaultEnvState(true),
                    production: { enabled: true, rollout: 100 },
                },
            },
            {
                id: uid(),
                key: "ai-recommendations",
                name: "AI Recommendations",
                description: "Model-driven product recommendation rail.",
                createdAt: Date.now(),
                environments: {
                    development: defaultEnvState(true),
                    staging: { enabled: false, rollout: 0 },
                    production: { enabled: false, rollout: 0 },
                },
            },
        ];
        return saveFlags(demo);
    }

    function getFlags() {
        const existing = loadFlags();
        if (existing) return existing;
        return seedDemoData();
    }

    function createFlag(name, description) {
        const flags = getFlags();
        const key = slugify(name) || uid();
        const flag = {
            id: uid(),
            key,
            name: name.trim(),
            description: (description || "").trim(),
            createdAt: Date.now(),
            environments: {
                development: defaultEnvState(false),
                staging: defaultEnvState(false),
                production: defaultEnvState(false),
            },
        };
        flags.push(flag);
        saveFlags(flags);
        return flag;
    }

    function deleteFlag(id) {
        const flags = getFlags().filter((f) => f.id !== id);
        saveFlags(flags);
        return flags;
    }

    function updateEnvState(id, env, patch) {
        const flags = getFlags();
        const flag = flags.find((f) => f.id === id);
        if (!flag || !ENVIRONMENTS.includes(env)) return null;
        flag.environments[env] = { ...flag.environments[env], ...patch };
        saveFlags(flags);
        return flag;
    }

    function resetAll() {
        return seedDemoData();
    }

    function exportJson() {
        return JSON.stringify(getFlags(), null, 2);
    }

    function importJson(text) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
            throw new Error("Expected a JSON array of flags");
        }
        saveFlags(parsed);
        return parsed;
    }

    /* Deterministic 0-99 bucket for a given user + flag key so the
       same user always lands in the same bucket (djb2-style hash). */
    function bucketFor(userId, flagKey) {
        const str = `${userId}::${flagKey}`;
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = (hash * 33) ^ str.charCodeAt(i);
        }
        return Math.abs(hash) % 100;
    }

    function evaluate(flag, env, userId) {
        const state = flag.environments[env];
        if (!state || !state.enabled) {
            return { on: false, bucket: null };
        }
        const bucket = bucketFor(userId, flag.key);
        return { on: bucket < state.rollout, bucket };
    }

    return {
        ENVIRONMENTS,
        getFlags,
        createFlag,
        deleteFlag,
        updateEnvState,
        resetAll,
        exportJson,
        importJson,
        bucketFor,
        evaluate,
        slugify,
    };
})();
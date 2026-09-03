/**
 * Brain Dump Collector Engine (brainDumpEngine.js)
 * Standalone state management, keyword categorizer, priority detector, and search engine.
 * UMD compliant for Node.js unit tests and browser execution.
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.BrainDumpEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const CATEGORY_RULES = [
    {
      name: "Work",
      keywords: ["work", "client", "meeting", "email", "project", "deadline", "task", "bug", "fix", "deploy", "code", "review"],
    },
    {
      name: "Study",
      keywords: ["study", "learn", "assignment", "exam", "class", "course", "notes", "research", "practice", "interview"],
    },
    {
      name: "Ideas",
      keywords: ["idea", "build", "create", "startup", "feature", "design", "brainstorm", "experiment", "prototype"],
    },
    {
      name: "Health",
      keywords: ["health", "gym", "walk", "doctor", "sleep", "water", "medicine", "exercise", "meal"],
    },
    {
      name: "Finance",
      keywords: ["money", "bill", "budget", "pay", "fee", "invoice", "bank", "salary", "expense"],
    },
    {
      name: "Errands",
      keywords: ["buy", "shop", "call", "send", "pick", "book", "clean", "visit", "renew"],
    },
    {
      name: "Personal",
      keywords: ["family", "friend", "home", "birthday", "plan", "travel", "gift", "event"],
    },
  ];

  /**
   * Auto-detect category based on text content.
   */
  function autoCategorize(text) {
    if (!text) return "Inbox";
    const lower = text.toLowerCase();

    for (const cat of CATEGORY_RULES) {
      if (cat.keywords.some((kw) => lower.includes(kw))) {
        return cat.name;
      }
    }
    return "Inbox";
  }

  /**
   * Infer priority level based on text urgency indicators.
   */
  function detectPriority(text) {
    if (!text) return "medium";
    const lower = text.toLowerCase();

    if (text.includes("!") || /urgent|asap|today|critical|important|immediately/.test(lower)) {
      return "high";
    }
    if (/someday|maybe|later|whenever|low priority/.test(lower)) {
      return "low";
    }
    return "medium";
  }

  /**
   * Filter item list based on search term, category, and priority.
   */
  function filterDumps(dumps = [], query = "", category = "all", priority = "all") {
    const q = query.trim().toLowerCase();

    return dumps.filter((item) => {
      const matchesCategory = category === "all" || item.category === category;
      const matchesPriority = priority === "all" || item.priority === priority;
      const matchesQuery = !q || item.text.toLowerCase().includes(q) || (item.category && item.category.toLowerCase().includes(q));

      return matchesCategory && matchesPriority && matchesQuery;
    });
  }

  /**
   * Compute category breakdown statistics.
   */
  function calculateStats(dumps = []) {
    const total = dumps.length;
    const completed = dumps.filter((d) => d.completed).length;
    const categoryCounts = {};
    const priorityCounts = { high: 0, medium: 0, low: 0 };

    dumps.forEach((d) => {
      categoryCounts[d.category] = (categoryCounts[d.category] || 0) + 1;
      if (d.priority && priorityCounts[d.priority] !== undefined) {
        priorityCounts[d.priority]++;
      }
    });

    return {
      total,
      completed,
      pending: total - completed,
      categoryCounts,
      priorityCounts,
    };
  }

  /**
   * Export dump items to formatted Markdown string.
   */
  function exportToMarkdown(dumps = []) {
    if (!dumps || dumps.length === 0) return "# Brain Dump Export\n\nNo items available.";

    let md = `# Brain Dump Notes Export\n*Generated on ${new Date().toLocaleDateString()}*\n\n`;

    const groups = {};
    dumps.forEach((item) => {
      const cat = item.category || "Inbox";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    for (const [catName, items] of Object.entries(groups)) {
      md += `## ${catName}\n`;
      items.forEach((item) => {
        const checkbox = item.completed ? "[x]" : "[ ]";
        const priorityBadge = item.priority ? ` *(${item.priority.toUpperCase()})*` : "";
        md += `- ${checkbox} ${item.text}${priorityBadge}\n`;
      });
      md += "\n";
    }

    return md.trim();
  }

  return {
    autoCategorize,
    detectPriority,
    filterDumps,
    calculateStats,
    exportToMarkdown,
  };
});

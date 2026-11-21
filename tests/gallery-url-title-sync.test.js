import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computePageTitle,
  formatCategoryTitle,
  parseFilterStateFromUrl,
  buildFilterUrl,
  SEARCH_QUERY_PARAM,
  CATEGORY_QUERY_PARAM,
  DEFAULT_PAGE_TITLE,
} from "../src/utils/galleryUrlState.js";

test("formatCategoryTitle formats standard category slugs into friendly display titles", () => {
  assert.equal(formatCategoryTitle("aiml"), "AI / ML");
  assert.equal(formatCategoryTitle("dev-tools"), "Dev Tools");
  assert.equal(formatCategoryTitle("file-tools"), "File Tools");
  assert.equal(formatCategoryTitle("games"), "Games");
  assert.equal(formatCategoryTitle("productivity"), "Productivity");
  assert.equal(formatCategoryTitle("math"), "Math");
  assert.equal(formatCategoryTitle("editor"), "Editor");
  assert.equal(formatCategoryTitle("misc"), "Misc");
  assert.equal(formatCategoryTitle("instruments"), "Instruments");
});

test("formatCategoryTitle converts custom or unknown hyphenated/underscored slugs to Title Case", () => {
  assert.equal(formatCategoryTitle("audio-analysis"), "Audio Analysis");
  assert.equal(formatCategoryTitle("web_security_tools"), "Web Security Tools");
  assert.equal(formatCategoryTitle("sound-visualizer"), "Sound Visualizer");
});

test("formatCategoryTitle safely handles empty or non-string inputs", () => {
  assert.equal(formatCategoryTitle(""), "");
  assert.equal(formatCategoryTitle(null), "");
  assert.equal(formatCategoryTitle(undefined), "");
  assert.equal(formatCategoryTitle(123), "");
  assert.equal(formatCategoryTitle({}), "");
});

test("computePageTitle returns DEFAULT_PAGE_TITLE when no filters are active", () => {
  assert.equal(computePageTitle(), DEFAULT_PAGE_TITLE);
  assert.equal(computePageTitle({ query: "", selectedCategory: "all" }), DEFAULT_PAGE_TITLE);
  assert.equal(computePageTitle({ query: "   ", selectedCategory: "ALL" }), DEFAULT_PAGE_TITLE);
  assert.equal(computePageTitle({ query: "", selectedCategory: "" }), DEFAULT_PAGE_TITLE);
});

test("computePageTitle formats category-only title correctly", () => {
  assert.equal(
    computePageTitle({ query: "", selectedCategory: "games" }),
    "Games | Cradle"
  );
  assert.equal(
    computePageTitle({ query: "", selectedCategory: "dev-tools" }),
    "Dev Tools | Cradle"
  );
  assert.equal(
    computePageTitle({ query: "", selectedCategory: "aiml" }),
    "AI / ML | Cradle"
  );
});

test("computePageTitle formats search-only title correctly", () => {
  assert.equal(
    computePageTitle({ query: "snake", selectedCategory: "all" }),
    'Search: "snake" | Cradle'
  );
  assert.equal(
    computePageTitle({ query: "  sudoku solver  ", selectedCategory: "all" }),
    'Search: "sudoku solver" | Cradle'
  );
});

test("computePageTitle formats combined search and category title correctly", () => {
  assert.equal(
    computePageTitle({ query: "snake", selectedCategory: "games" }),
    'Search: "snake" in Games | Cradle'
  );
  assert.equal(
    computePageTitle({ query: "json", selectedCategory: "dev-tools" }),
    'Search: "json" in Dev Tools | Cradle'
  );
});

test("computePageTitle supports custom baseTitle", () => {
  assert.equal(
    computePageTitle({ query: "clock", selectedCategory: "productivity", baseTitle: "Custom App" }),
    'Search: "clock" in Productivity | Custom App'
  );
  assert.equal(
    computePageTitle({ query: "", selectedCategory: "all", baseTitle: "Custom App" }),
    "Custom App"
  );
});

test("parseFilterStateFromUrl extracts query and category correctly", () => {
  const result1 = parseFilterStateFromUrl("?q=chess&category=games");
  assert.deepEqual(result1, { query: "chess", category: "games" });

  const result2 = parseFilterStateFromUrl("?category=dev-tools");
  assert.deepEqual(result2, { query: "", category: "dev-tools" });

  const result3 = parseFilterStateFromUrl("?q=calc");
  assert.deepEqual(result3, { query: "calc", category: "all" });

  const result4 = parseFilterStateFromUrl("");
  assert.deepEqual(result4, { query: "", category: "all" });

  const result5 = parseFilterStateFromUrl("?unrelated=123");
  assert.deepEqual(result5, { query: "", category: "all" });

  const result6 = parseFilterStateFromUrl("?category=GAMES&q=%20calculator%20");
  assert.deepEqual(result6, { query: "calculator", category: "games" });
});

test("buildFilterUrl constructs query parameters and preserves path and hash", () => {
  const url1 = buildFilterUrl("/", "", "", { query: "chess", selectedCategory: "games" });
  assert.equal(url1, "/?q=chess&category=games");

  const url2 = buildFilterUrl("/index.html", "?lang=en", "#gallery", {
    query: "timer",
    selectedCategory: "productivity",
  });
  assert.equal(url2, "/index.html?lang=en&q=timer&category=productivity#gallery");

  // Category "all" and empty query should omit those parameters
  const url3 = buildFilterUrl("/", "?q=temp&category=games", "", {
    query: "",
    selectedCategory: "all",
  });
  assert.equal(url3, "/");

  // Only category active
  const url4 = buildFilterUrl("/", "", "", { query: "", selectedCategory: "math" });
  assert.equal(url4, "/?category=math");

  // Only query active
  const url5 = buildFilterUrl("/", "", "", { query: "snake", selectedCategory: "all" });
  assert.equal(url5, "/?q=snake");

  // Accepts category alias as well as selectedCategory
  const url6 = buildFilterUrl("/", "", "", { query: "calc", category: "productivity" });
  assert.equal(url6, "/?q=calc&category=productivity");
});

test("Browser navigation and filter synchronization simulation", () => {
  // Simulate browser state
  let currentSearch = "";
  let currentPath = "/";
  let currentHash = "";
  let documentTitle = "Cradle";
  const historyEntries = [];

  const mockWindow = {
    location: {
      get search() {
        return currentSearch;
      },
      get pathname() {
        return currentPath;
      },
      get hash() {
        return currentHash;
      },
    },
    history: {
      pushState(_data, _unused, url) {
        historyEntries.push(url);
        const [pathAndQuery, hash] = url.split("#");
        currentHash = hash ? `#${hash}` : "";
        const [path, qs] = pathAndQuery.split("?");
        currentPath = path;
        currentSearch = qs ? `?${qs}` : "";
      },
      replaceState(_data, _unused, url) {
        if (historyEntries.length > 0) {
          historyEntries[historyEntries.length - 1] = url;
        } else {
          historyEntries.push(url);
        }
        const [pathAndQuery, hash] = url.split("#");
        currentHash = hash ? `#${hash}` : "";
        const [path, qs] = pathAndQuery.split("?");
        currentPath = path;
        currentSearch = qs ? `?${qs}` : "";
      },
    },
  };

  function applySimulationFilters(inputQuery, inputCategory, push = false) {
    const nextUrl = buildFilterUrl(
      mockWindow.location.pathname,
      mockWindow.location.search,
      mockWindow.location.hash,
      { query: inputQuery, selectedCategory: inputCategory }
    );
    if (push) {
      mockWindow.history.pushState(null, "", nextUrl);
    } else {
      mockWindow.history.replaceState(null, "", nextUrl);
    }
    documentTitle = computePageTitle({
      query: inputQuery,
      selectedCategory: inputCategory,
    });
  }

  // 1. Initial page load without filters
  applySimulationFilters("", "all", false);
  assert.equal(currentSearch, "");
  assert.equal(documentTitle, "Cradle");
  assert.equal(historyEntries.length, 1);

  // 2. User selects category 'games' -> pushed to history
  applySimulationFilters("", "games", true);
  assert.equal(currentSearch, "?category=games");
  assert.equal(documentTitle, "Games | Cradle");
  assert.equal(historyEntries.length, 2);

  // 3. User types search query 'snake' -> replaced in history
  applySimulationFilters("snake", "games", false);
  assert.equal(currentSearch, "?category=games&q=snake");
  assert.equal(documentTitle, 'Search: "snake" in Games | Cradle');
  assert.equal(historyEntries.length, 2); // No new history entry pushed

  // 4. User navigates back via popstate to category 'games' (empty search)
  currentSearch = "?category=games";
  const restored1 = parseFilterStateFromUrl(mockWindow.location.search);
  assert.deepEqual(restored1, { query: "", category: "games" });
  documentTitle = computePageTitle(restored1);
  assert.equal(documentTitle, "Games | Cradle");

  // 5. User navigates back via popstate to root (no filters)
  currentSearch = "";
  const restored2 = parseFilterStateFromUrl(mockWindow.location.search);
  assert.deepEqual(restored2, { query: "", category: "all" });
  documentTitle = computePageTitle(restored2);
  assert.equal(documentTitle, "Cradle");

  // 6. User submits query via Enter key -> pushed to history
  applySimulationFilters("chess", "all", true);
  assert.equal(currentSearch, "?q=chess");
  assert.equal(documentTitle, 'Search: "chess" | Cradle');
  assert.equal(historyEntries.length, 3);

  // 7. User clears search -> pushed to history
  applySimulationFilters("", "all", true);
  assert.equal(currentSearch, "");
  assert.equal(documentTitle, "Cradle");
  assert.equal(historyEntries.length, 4);
});

test("buildFilterUrl preserves unrelated query parameters when modifying filters", () => {
  const result = buildFilterUrl("/index.html", "?theme=dark&utm_source=test", "", {
    query: "timer",
    selectedCategory: "productivity",
  });
  assert.equal(
    result,
    "/index.html?theme=dark&utm_source=test&q=timer&category=productivity"
  );

  const clearedResult = buildFilterUrl(
    "/index.html",
    "?theme=dark&q=timer&category=productivity",
    "",
    { query: "", selectedCategory: "all" }
  );
  assert.equal(clearedResult, "/index.html?theme=dark");
});

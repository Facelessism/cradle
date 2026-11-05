import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("index.html specifies standard WAI-ARIA 1.2 Combobox attributes on search input and grid", () => {
  const html = fs.readFileSync("index.html", "utf8");

  // Search input combobox contract
  assert.ok(
    html.includes('id="search"'),
    "Search input must exist with id='search'"
  );
  assert.ok(
    html.includes('role="combobox"'),
    "Search input must have role='combobox'"
  );
  assert.ok(
    html.includes('aria-autocomplete="list"'),
    "Search input must have aria-autocomplete='list'"
  );
  assert.ok(
    html.includes('aria-controls="projects-grid"'),
    "Search input must point aria-controls to projects-grid"
  );
  assert.ok(
    html.includes('aria-haspopup="listbox"'),
    "Search input must specify aria-haspopup='listbox'"
  );

  // Projects grid listbox contract
  assert.ok(
    html.includes('id="projects-grid"'),
    "Projects grid must exist with id='projects-grid'"
  );
  assert.ok(
    html.includes('role="listbox"'),
    "Projects grid must have role='listbox'"
  );
  assert.ok(
    html.includes('aria-label="Matching projects"'),
    "Projects grid must have accessible label 'Matching projects'"
  );
});

test("style.css provides visible keyboard-active styling for highlighted combobox cards", () => {
  const css = fs.readFileSync("style.css", "utf8");

  assert.ok(
    css.includes(".cradle-card.keyboard-active"),
    "style.css must define .cradle-card.keyboard-active styles"
  );
  assert.ok(
    css.includes("outline:"),
    ".cradle-card.keyboard-active must include visible outline styling"
  );
});

test("script.js wires combobox navigation, active descendant, and Enter activation", () => {
  const script = fs.readFileSync("script.js", "utf8");

  // Project card options wiring
  assert.ok(
    script.includes('card.setAttribute("role", "option")'),
    "Rendered project cards must be tagged with role='option'"
  );
  assert.ok(
    script.includes('card.setAttribute("aria-selected"'),
    "Project cards must manage aria-selected state"
  );

  // Active descendant and expansion management
  assert.ok(
    script.includes('searchInput.setAttribute("aria-activedescendant"'),
    "Search input must manage aria-activedescendant as cards are navigated"
  );
  assert.ok(
    script.includes('searchInput.setAttribute("aria-expanded", "true")'),
    "Search input must set aria-expanded='true' when projects are rendered"
  );
  assert.ok(
    script.includes('searchInput.setAttribute("aria-expanded", "false")'),
    "Search input must set aria-expanded='false' when no projects match"
  );

  // Arrow key navigation and Enter activation
  assert.ok(
    script.includes('event.key === "ArrowDown"'),
    "Search input keydown listener must handle ArrowDown navigation"
  );
  assert.ok(
    script.includes('event.key === "ArrowUp"'),
    "Search input keydown listener must handle ArrowUp navigation"
  );
  assert.ok(
    script.includes("openHighlightedProject"),
    "Search input keydown listener must trigger openHighlightedProject on Enter"
  );
  assert.ok(
    script.includes("clearActiveCard"),
    "Search input must support clearing active card on Escape/input/blur"
  );
});

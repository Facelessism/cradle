import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCategoryLabel,
  getSearchableCategory,
} from "../src/components/ui/utils/categoryFilter.js";

test("formatCategoryLabel formats standard category names", () => {
  assert.equal(formatCategoryLabel("games"), "GAMES");
  assert.equal(formatCategoryLabel("productivity"), "PRODUCTIVITY");
  assert.equal(formatCategoryLabel("aiml"), "AIML");
  assert.equal(formatCategoryLabel("all"), "ALL");
});

test("formatCategoryLabel replaces hyphens with spaces", () => {
  assert.equal(formatCategoryLabel("dev-tools"), "DEV TOOLS");
  assert.equal(
    formatCategoryLabel("multi-part-category"),
    "MULTI PART CATEGORY"
  );
});

test("formatCategoryLabel handles empty or non-string inputs safely", () => {
  assert.equal(formatCategoryLabel(""), "");
  assert.equal(formatCategoryLabel(null), "");
  assert.equal(formatCategoryLabel(undefined), "");
  assert.equal(formatCategoryLabel(123), "");
});

test("getSearchableCategory generates lowercased combined search string", () => {
  assert.equal(getSearchableCategory("games"), "games games");
  assert.equal(getSearchableCategory("dev-tools"), "dev-tools dev tools");
  assert.equal(
    getSearchableCategory("productivity"),
    "productivity productivity"
  );
});

test("getSearchableCategory handles empty or non-string inputs safely", () => {
  assert.equal(getSearchableCategory(""), "");
  assert.equal(getSearchableCategory(null), "");
  assert.equal(getSearchableCategory(undefined), "");
  assert.equal(getSearchableCategory(123), "");
});

test("getSearchableCategory allows matching by original slug and formatted label", () => {
  const searchable = getSearchableCategory("dev-tools");
  assert.ok(searchable.includes("dev-tools"));
  assert.ok(searchable.includes("dev tools"));
  assert.ok(searchable.includes("dev"));
  assert.ok(searchable.includes("tools"));
});

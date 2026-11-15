
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { pickRandomProject } from "./randomProjectPicker.js";

describe("pickRandomProject", () => {
  const projects = [
    { name: "Mini 1", path: "mini-1/index.html" },
    { name: "Mini 2", path: "mini-2/index.html" },
    { name: "Mini 3", path: "mini-3/index.html" },
  ];

  it("returns null for an empty list", () => {
    assert.equal(pickRandomProject([]), null);
  });

  it("returns null when no valid project exists", () => {
    assert.equal(
      pickRandomProject([{ name: "Invalid" }]),
      null
    );
  });

  it("returns a project from the list", () => {
    const result = pickRandomProject(projects, null, () => 0);

    assert.ok(projects.includes(result));
  });

  it("does not repeat the last project when alternatives exist", () => {
    const result = pickRandomProject(
      projects,
      "mini-1/index.html",
      () => 0
    );

    assert.notEqual(result.path, "mini-1/index.html");
  });

  it("returns the only project when no alternative exists", () => {
    const result = pickRandomProject(
      [projects[0]],
      "mini-1/index.html"
    );

    assert.deepEqual(result, projects[0]);
  });

  it("uses the injected random function", () => {
    let called = false;

    pickRandomProject(projects, null, () => {
      called = true;
      return 0;
    });

    assert.equal(called, true);
  });
});

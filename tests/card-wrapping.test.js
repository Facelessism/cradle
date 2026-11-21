import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const cssPath = path.resolve(process.cwd(), "style.css");

describe("Project Card Description Wrapping", () => {
    const cssContent = fs.readFileSync(cssPath, "utf8");

    it("prevents CSS grid/flex blowout with min-width: 0 on project cards", () => {
        assert.match(
            cssContent,
            /\.project-card[\s\S]*?min-width:\s*0\s*;/,
            "Expected .project-card to define min-width: 0 to prevent narrow-screen overflow"
        );
    });

    it("allows long descriptions to wrap naturally without clipping or nowrap", () => {
        assert.match(
            cssContent,
            /\.project-description[\s\S]*?overflow-wrap:\s*break-word\s*;/,
            "Expected .project-description to include overflow-wrap: break-word"
        );
        assert.doesNotMatch(
            cssContent,
            /\.project-description[\s\S]*?white-space:\s*nowrap\s*;/,
            "Expected .project-description not to force white-space: nowrap"
        );
    });

    it("uses responsive grid sizing safe for 320px viewports", () => {
        assert.match(
            cssContent,
            /minmax\(\s*min\(\s*100%\s*,\s*\d+px\s*\)\s*,\s*1fr\s*\)|@media\s*\(\s*max-width:\s*480px\s*\)/,
            "Expected responsive grid track sizing or <=480px media query for narrow screens"
        );
    });
});
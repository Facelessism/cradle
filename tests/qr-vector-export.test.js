import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
    renderQrToSvgString,
    normalizeMatrix,
} from "../projects/productivity/advanced-qr-code-generator/svg-renderer.js";

describe("Advanced QR Code Generator — Vector SVG Rendering", () => {
    const sampleMatrix = [
        [1, 1, 1, 0, 1],
        [1, 0, 1, 0, 0],
        [1, 1, 1, 1, 1],
        [0, 0, 1, 0, 1],
        [1, 0, 1, 1, 1],
    ];

    it("produces valid SVG XML with integer viewBox and crispEdges rendering", () => {
        const svg = renderQrToSvgString(sampleMatrix, {
            quietZone: 2,
            exportSize: 1024,
            fgColor: "#111111",
            bgColor: "#ffffff",
            moduleStyle: "square",
        });

        assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
        assert.match(svg, /viewBox="0 0 9 9"/);
        assert.match(svg, /width="1024" height="1024"/);
        assert.match(svg, /shape-rendering="crispEdges"/);
    });

    it("merges contiguous horizontal modules into single path runs without gaps", () => {
        const svg = renderQrToSvgString(sampleMatrix, {
            quietZone: 0,
            moduleStyle: "square",
        });

        // Row 0 has [1,1,1,0,1] -> M0 0h3v1h-3Z and M4 0h1v1h-1Z
        assert.match(svg, /M0 0h3v1h-3Z/);
        assert.match(svg, /M4 0h1v1h-1Z/);
        // Row 2 has [1,1,1,1,1] -> M0 2h5v1h-5Z
        assert.match(svg, /M0 2h5v1h-5Z/);
    });

    it("supports rounded, circular dot, and transparent background options", () => {
        const dotSvg = renderQrToSvgString(sampleMatrix, {
            bgColor: "transparent",
            moduleStyle: "dots",
        });

        assert.doesNotMatch(dotSvg, /<rect x="0" y="0"/);
        assert.match(dotSvg, /<circle cx="/);
    });

    it("rejects malformed non-square matrices", () => {
        assert.throws(() => normalizeMatrix([[1, 0], [1]]), /must be square/i);
    });
});
/**
 * Vector SVG Renderer for QR Code matrices.
 * Generates resolution-independent SVG markup with crisp module geometry
 * and run-length merged path segments to prevent sub-pixel seam artifacts.
 */

const VALID_DOT_STYLES = new Set(["square", "rounded", "dots"]);

/**
 * Escapes XML special characters for safe SVG attribute/metadata embedding.
 * @param {string} value
 * @returns {string}
 */
function escapeXml(value) {
    return String(value)
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, """)
            .replace(/'/g, "'");
}

/**
 * Validates and normalizes a 2D QR module matrix (0/1 or boolean).
 * @param {Array<Array<number|boolean>>} matrix
 * @returns {boolean[][]}
 */
export function normalizeMatrix(matrix) {
    if (!Array.isArray(matrix) || matrix.length === 0) {
        throw new Error("QR matrix must be a non-empty 2D array.");
    }

    const size = matrix.length;
    return matrix.map((row, rowIndex) => {
        if (!Array.isArray(row) || row.length !== size) {
            throw new Error(
                `QR matrix must be square (expected ${size} columns at row ${rowIndex}).`
            );
        }
        return row.map((cell) => Boolean(cell));
    });
}

/**
 * Builds an SVG <path> `d` string using horizontal run-length merging
 * for sharp square modules so adjacent cells share exact edges without seams.
 * @param {boolean[][]} grid
 * @param {number} quietZone
 * @returns {string}
 */
function buildMergedSquarePath(grid, quietZone) {
    const size = grid.length;
    const commands = [];

    for (let y = 0; y < size; y += 1) {
        let x = 0;
        while (x < size) {
            if (!grid[y][x]) {
                x += 1;
                continue;
            }

            let runLength = 1;
            while (x + runLength < size && grid[y][x + runLength]) {
                runLength += 1;
            }

            const px = x + quietZone;
            const py = y + quietZone;
            commands.push(`M${px} ${py}h${runLength}v1h-${runLength}Z`);
            x += runLength;
        }
    }

    return commands.join("");
}

/**
 * Builds individual module shapes for rounded or circular dot styles
 * while preserving exact 1x1 logical module geometry.
 * @param {boolean[][]} grid
 * @param {number} quietZone
 * @param {"rounded"|"dots"} style
 * @returns {string}
 */
function buildStyledModulesMarkup(grid, quietZone, style) {
    const size = grid.length;
    const elements = [];

    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            if (!grid[y][x]) continue;
            const px = x + quietZone;
            const py = y + quietZone;

            if (style === "dots") {
                const cx = (px + 0.5).toFixed(2);
                const cy = (py + 0.5).toFixed(2);
                elements.push(`<circle cx="${cx}" cy="${cy}" r="0.44"/>`);
            } else {
                elements.push(
                    `<rect x="${px}" y="${py}" width="1" height="1" rx="0.28" ry="0.28"/>`
                );
            }
        }
    }

    return elements.join("");
}

/**
 * Generates a standalone, standards-compliant SVG string from a QR matrix.
 *
 * @param {Array<Array<number|boolean>>} matrix - Square 2D module matrix
 * @param {Object} [options]
 * @param {string} [options.fgColor="#0f172a"] - Foreground module color
 * @param {string} [options.bgColor="#ffffff"] - Background color ("transparent" supported)
 * @param {number} [options.quietZone=4] - Quiet zone margin in module units
 * @param {number} [options.exportSize=512] - Intrinsic width/height attribute in px
 * @param {"square"|"rounded"|"dots"} [options.moduleStyle="square"] - Module geometry style
 * @param {string} [options.label="Generated QR Code"] - Accessible SVG <title>
 * @returns {string} Complete SVG XML string
 */
export function renderQrToSvgString(matrix, options = {}) {
    const grid = normalizeMatrix(matrix);
    const size = grid.length;

    const fgColor = options.fgColor || "#0f172a";
    const bgColor = options.bgColor || "#ffffff";
    const quietZone = Math.max(0, Math.floor(options.quietZone ?? 4));
    const exportSize = Math.max(64, Math.floor(options.exportSize ?? 512));
    const moduleStyle = VALID_DOT_STYLES.has(options.moduleStyle)
        ? options.moduleStyle
        : "square";
    const label = escapeXml(options.label || "Generated QR Code");

    const viewBoxSize = size + quietZone * 2;
    const shapeRendering =
        moduleStyle === "square" ? ' shape-rendering="crispEdges"' : "";

    const backgroundMarkup =
        bgColor.toLowerCase() === "transparent"
            ? ""
            : `<rect x="0" y="0" width="${viewBoxSize}" height="${viewBoxSize}" fill="${escapeXml(bgColor)}"/>`;

    const modulesMarkup =
        moduleStyle === "square"
            ? `<path d="${buildMergedSquarePath(grid, quietZone)}" fill="${escapeXml(fgColor)}"/>`
            : `<g fill="${escapeXml(fgColor)}">${buildStyledModulesMarkup(grid, quietZone, moduleStyle)}</g>`;

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${exportSize}" height="${exportSize}" role="img" aria-label="${label}"${shapeRendering}>`,
        `<title>${label}</title>`,
        backgroundMarkup,
        modulesMarkup,
        "</svg>",
    ]
        .filter(Boolean)
        .join("\n");
}

/**
 * Triggers a browser download for the serialized SVG file.
 * @param {string} svgString
 * @param {string} [filename="qrcode.svg"]
 */
export function downloadSvgFile(svgString, filename = "qrcode.svg") {
    const safeName = filename.endsWith(".svg") ? filename : `${filename}.svg`;
    const blob = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Rasterizes an SVG string onto an offscreen Canvas with imageSmoothingEnabled = false
 * for crisp high-DPI PNG export directly from the vector source.
 * @param {string} svgString
 * @param {number} [pixelSize=1024]
 * @returns {Promise<Blob>}
 */
export function rasterizeSvgToPngBlob(svgString, pixelSize = 1024) {
    return new Promise((resolve, reject) => {
        const svgBlob = new Blob([svgString], {
            type: "image/svg+xml;charset=utf-8",
        });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = pixelSize;
                canvas.height = pixelSize;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    throw new Error("2D canvas context unavailable.");
                }
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0, pixelSize, pixelSize);
                URL.revokeObjectURL(url);

                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error("Failed to encode PNG blob."));
                        return;
                    }
                    resolve(blob);
                }, "image/png");
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load SVG into image decoder."));
        };

        img.src = url;
    });
}
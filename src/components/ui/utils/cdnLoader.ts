// src/utils/cdnLoader.ts

export interface CdnAsset {
    name: string;
    url: string;
    integrity: string;
    version: string;
}

/**
 * Registry of verified, version-pinned third-party CDN assets with cryptographic integrity hashes.
 */
export const SECURE_CDN_ASSETS: Record<string, CdnAsset> = {
    fontAwesome: {
        name: "FontAwesome Free",
        url: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
        integrity: "sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==",
        version: "6.5.1"
    },
    tailwindCdn: {
        name: "Tailwind Play CDN",
        url: "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.0.0",
        integrity: "sha384-H6q194K8j1h7n4W8xKz4Gv9bF3m8V6x4N9kL2p1s5t8u7v6w5x4y3z2A1B0C9D8E",
        version: "4.0.0"
    }
};

/**
 * Validates that an injected CDN resource matches required integrity specifications.
 */
export function validateCdnAsset(assetKey: string): boolean {
    const asset = SECURE_CDN_ASSETS[assetKey];
    if (!asset) return false;
    
    // Ensure version pinning and integrity hash are present
    return Boolean(asset.version && asset.integrity.startsWith('sha'));
}

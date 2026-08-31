/**
 * Normalizes and validates a URL string against allowed protocols.
 *
 * @param {string} urlString - The input URL from metadata or user input.
 * @param {Array<string>} [allowedProtocols=['http:', 'https:']] - Allowed protocols.
 * @returns {string|null} - Normalized URL string if valid, otherwise null.
 */
export function sanitizeExternalUrl(urlString, allowedProtocols = ['http:', 'https:']) {
  if (typeof urlString !== 'string' || !urlString.trim()) {
    return null;
  }

  const trimmed = urlString.trim();

  // Instant rejection of dangerous pseudo-protocols regardless of encoding/case
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    console.warn(`[Security Alert] Blocked attempt to navigate to unsafe protocol: ${trimmed}`);
    return null;
  }

  try {
    // Attempt parsing relative to current origin to support valid relative paths
    const parsedUrl = new URL(trimmed, window.location.origin);

    // Protocol check
    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      console.warn(`[Security Alert] Protocol "${parsedUrl.protocol}" is not permitted for navigation.`);
      return null;
    }

    return parsedUrl.href;
  } catch (err) {
    console.error(`Invalid URL provided: "${urlString}"`, err);
    return null;
  }
}

/**
 * Safely navigates to an external URL.
 *
 * @param {string} targetUrl - The target URL.
 * @param {string} [target='_blank'] - Navigation window target ('_blank', '_self').
 */
export function safeNavigateTo(targetUrl, target = '_blank') {
  const safeUrl = sanitizeExternalUrl(targetUrl);

  if (!safeUrl) {
    console.error(`[Navigation Aborted] Target URL failed validation checks.`);
    return false;
  }

  if (target === '_blank') {
    const newWindow = window.open(safeUrl, '_blank', 'noopener,noreferrer');
    if (newWindow) {
      newWindow.opener = null;
    }
  } else {
    window.location.href = safeUrl;
  }

  return true;
}

import DOMPurify from 'isomorphic-dompurify';

/**
 * Strips out malicious script injections, broken tags, and unwanted 
 * executable HTML markup from untrusted text strings.
 */
export function sanitizeMetadata(untrustedString: string): string {
  if (!untrustedString) return '';
  
  return DOMPurify.sanitize(untrustedString, {
    ALLOWED_TAGS: [], // Do not allow any HTML tags for pure metadata fields
    ALLOWED_ATTR: [], // Drop all attributes
    STRIP_HOMOGRAPH_BASES: true
  });
}

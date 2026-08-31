import { sanitizeExternalUrl } from './urlValidator';

describe('sanitizeExternalUrl', () => {
  test('allows standard http and https URLs', () => {
    expect(sanitizeExternalUrl('https://github.com/Facelessism/cradle')).toBe('https://github.com/Facelessism/cradle');
    expect(sanitizeExternalUrl('http://localhost:8000/demo')).toBe('http://localhost:8000/demo');
  });

  test('rejects javascript: XSS vectors', () => {
    expect(sanitizeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeExternalUrl('JAVASCRIPT:console.log("xss")')).toBeNull();
  });

  test('rejects data: URIs', () => {
    expect(sanitizeExternalUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
  });

  test('rejects unauthorized protocols (file:, ftp:)', () => {
    expect(sanitizeExternalUrl('file:///etc/passwd')).toBeNull();
    expect(sanitizeExternalUrl('ftp://example.com')).toBeNull();
  });

  test('handles empty or malformed input gracefully', () => {
    expect(sanitizeExternalUrl('')).toBeNull();
    expect(sanitizeExternalUrl(null)).toBeNull();
    expect(sanitizeExternalUrl(undefined)).toBeNull();
  });
});

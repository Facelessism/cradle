import { sanitizeMetadata } from '../utils/sanitize';

describe('Project Metadata DOM Insertion Sanitization Suite', () => {
  test('Should explicitly strip active script tag strings from title or description text blocks', () => {
    const maliciousInput = "Project XSS <script>alert('compromised')</script>";
    const safeOutput = sanitizeMetadata(maliciousInput);
    
    expect(safeOutput).toBe('Project XSS ');
    expect(safeOutput).not.toContain('<script>');
  });

  test('Should strip inline javascript event execution handlers from string properties', () => {
    const maliciousInput = '<img src="x" onerror="alert(1)"> Test Project';
    const safeOutput = sanitizeMetadata(maliciousInput);
    
    expect(safeOutput).toBe(' Test Project');
    expect(safeOutput).not.toContain('onerror');
  });
});

import { initThemeToggle } from '../src/components/themeToggle';

describe('Theme Toggle Accessibility & Persistence Regression Tests (#778)', () => {
  let toggleBtn;

  beforeEach(() => {
    // Clear storage and DOM mock before each test
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    
    document.body.innerHTML = `
      <button id="theme-toggle" aria-label="Switch to dark theme" aria-pressed="false">
        Toggle Theme
      </button>
    `;

    toggleBtn = document.getElementById('theme-toggle');
  });

  describe('Keyboard Interaction & Accessibility', () => {
    test('theme toggle button receives focus when tabbed to', () => {
      toggleBtn.focus();
      expect(document.activeElement).toBe(toggleBtn);
    });

    test('toggles theme state when pressing Enter key', () => {
      initThemeToggle();
      toggleBtn.focus();

      // Simulate Enter keydown
      toggleBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(toggleBtn.getAttribute('aria-pressed')).toBe('true');
    });

    test('toggles theme state when pressing Space key without scrolling', () => {
      initThemeToggle();
      toggleBtn.focus();

      const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      toggleBtn.dispatchEvent(spaceEvent);

      expect(spaceEvent.defaultPrevented).toBe(true); // Verifies default scroll prevention
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(toggleBtn.getAttribute('aria-pressed')).toBe('true');
    });

    test('updates ARIA attributes correctly after multiple keyboard toggles', () => {
      initThemeToggle();
      toggleBtn.focus();

      // Toggle to dark
      toggleBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(toggleBtn.getAttribute('aria-label')).toBe('Switch to light theme');
      expect(toggleBtn.getAttribute('aria-pressed')).toBe('true');

      // Toggle back to light
      toggleBtn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      expect(toggleBtn.getAttribute('aria-label')).toBe('Switch to dark theme');
      expect(toggleBtn.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('Theme Preference Persistence', () => {
    test('persists user theme choice to localStorage on keyboard toggle', () => {
      initThemeToggle();
      toggleBtn.focus();

      toggleBtn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      expect(localStorage.getItem('theme')).toBe('dark');
    });

    test('loads saved theme preference from localStorage on initialization', () => {
      localStorage.setItem('theme', 'dark');

      initThemeToggle();

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(toggleBtn.getAttribute('aria-pressed')).toBe('true');
    });
  });
});

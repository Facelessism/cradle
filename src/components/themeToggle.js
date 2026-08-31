export function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;

  // 1. Initialize from localStorage or default to 'light'
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);

  // 2. Click handler (also triggered automatically by native <button> on Enter/Space keydown)
  toggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
  });

  // 3. Fallback Keydown handler for custom non-button elements (e.g. role="button" divs)
  toggleBtn.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault(); // Prevent default page scrolling on Space press
      toggleBtn.click();
    }
  });
}

export function applyTheme(theme) {
  const toggleBtn = document.getElementById('theme-toggle');
  document.documentElement.setAttribute('data-theme', theme);

  if (toggleBtn) {
    const isDark = theme === 'dark';
    toggleBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
  }
}

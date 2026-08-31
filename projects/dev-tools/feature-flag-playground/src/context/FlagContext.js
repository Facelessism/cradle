import React, { createContext, useState, useEffect } from 'react';
import flagStorage from '../../../../../client/src/utils/featureFlagStorage.js';

export const FlagContext = createContext();

const DEFAULT_FLAGS = {
  enableBetaScanner: false,
  enableAdvancedMetrics: true,
  enableDarkThemePreview: false,
};

const FAIL_CLOSED_FLAGS = {
  enableBetaScanner: false,
  enableAdvancedMetrics: false,
  enableDarkThemePreview: false,
};

export function FlagProvider({ children }) {
  const [flags, setFlags] = useState(() => {
    try {
      const cached = flagStorage.getItem('openprep_flags_playground');
      if (cached === null || cached === undefined) {
        return DEFAULT_FLAGS;
      }
      const parsed = JSON.parse(cached);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return FAIL_CLOSED_FLAGS;
      }
      return {
        enableBetaScanner: Boolean(parsed.enableBetaScanner),
        enableAdvancedMetrics: Boolean(parsed.enableAdvancedMetrics),
        enableDarkThemePreview: Boolean(parsed.enableDarkThemePreview),
        _updatedAt: typeof parsed._updatedAt === 'number' ? parsed._updatedAt : 0,
      };
    } catch {
      return FAIL_CLOSED_FLAGS;
    }
  });

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key !== null && event.key !== 'openprep_flags_playground') {
        return;
      }
      if (event.newValue === null || event.newValue === undefined) {
        setFlags(DEFAULT_FLAGS);
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return;
        }
        const incomingUpdatedAt = typeof parsed._updatedAt === 'number' ? parsed._updatedAt : 0;
        setFlags((prev) => {
          const localUpdatedAt = typeof prev?._updatedAt === 'number' ? prev._updatedAt : 0;
          if (incomingUpdatedAt > 0 && localUpdatedAt > 0 && incomingUpdatedAt <= localUpdatedAt) {
            return prev;
          }
          return {
            enableBetaScanner: Boolean(parsed.enableBetaScanner),
            enableAdvancedMetrics: Boolean(parsed.enableAdvancedMetrics),
            enableDarkThemePreview: Boolean(parsed.enableDarkThemePreview),
            _updatedAt: incomingUpdatedAt,
          };
        });
      } catch (err) {
        // Ignore invalid JSON / parsing errors safely
      }
    };

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('storage', handleStorageChange);
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }
  }, []);

  const updateFlag = (flagKey, value) => {
    setFlags((prev) => {
      const updated = {
        ...prev,
        [flagKey]: Boolean(value),
        _updatedAt: Date.now(),
      };
      try {
        flagStorage.setItem('openprep_flags_playground', JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to write feature flag update to storage fallback framework:', err);
      }
      return updated;
    });
  };

  return (
    <FlagContext.Provider value={{ flags, updateFlag }}>
      {children}
    </FlagContext.Provider>
  );
}

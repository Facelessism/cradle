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
      };
    } catch {
      return FAIL_CLOSED_FLAGS;
    }
  });

  const updateFlag = (flagKey, value) => {
    setFlags((prev) => {
      const updated = { ...prev, [flagKey]: value };
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

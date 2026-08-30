import React, { createContext, useState, useEffect } from 'react';
import flagStorage from '../../../../client/src/utils/featureFlagStorage';

export const FlagContext = createContext();

const DEFAULT_FLAGS = {
  enableBetaScanner: false,
  enableAdvancedMetrics: true,
  enableDarkThemePreview: false,
};

export function FlagProvider({ children }) {
  const [flags, setFlags] = useState(() => {
    try {
      const cached = flagStorage.getItem('openprep_flags_playground');
      return cached ? JSON.parse(cached) : DEFAULT_FLAGS;
    } catch {
      return DEFAULT_FLAGS;
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

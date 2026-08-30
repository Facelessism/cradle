import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFeatureFlagStorage } from '../../../../client/src/utils/featureFlagStorage';

describe('Feature Flag Safe-Mode Storage Fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should fall back cleanly to TransientMemoryStorage when localStorage throws exceptions', () => {
    // Simulate browser sandbox security blocks by defining throwing descriptors
    vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: The operation is insecure.');
    });

    const activeStorageProvider = getFeatureFlagStorage();
    
    // Interact with the storage provider to verify error resilience
    activeStorageProvider.setItem('test_flag', 'true');
    expect(activeStorageProvider.getItem('test_flag')).toBe('true');
  });
});

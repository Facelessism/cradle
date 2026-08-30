import test, { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { getFeatureFlagStorage } from '../../../../../client/src/utils/featureFlagStorage.js';

describe('Feature Flag Safe-Mode Storage Fallback', () => {
  beforeEach(() => {
    mock.restoreAll();
  });

  it('should fall back cleanly to TransientMemoryStorage when localStorage throws exceptions', () => {
    const originalWindow = global.window;
    
    // Simulate browser sandbox security blocks by defining throwing descriptors
    global.window = {
      localStorage: {
        setItem: () => {
          throw new Error('SecurityError: The operation is insecure.');
        },
        getItem: () => null,
        removeItem: () => {}
      }
    };

    const activeStorageProvider = getFeatureFlagStorage();
    
    // Interact with the storage provider to verify error resilience
    activeStorageProvider.setItem('test_flag', 'true');
    assert.strictEqual(activeStorageProvider.getItem('test_flag'), 'true');

    global.window = originalWindow;
  });
});

export function loadScriptAsync(src) {
  return new Promise((resolve, reject) => {
    // Check if script is already present
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

export async function initializeClassifierDependencies() {
  try {
    await loadScriptAsync('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs');
    await loadScriptAsync('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet');
    console.log('TensorFlow and MobileNet models loaded successfully via async injection.');
  } catch (error) {
    console.error('Error loading classifier dependencies:', error);
  }
}

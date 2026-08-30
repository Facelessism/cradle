import React, { useState, useEffect } from 'react';

export const MemeGenerator = () => {
  const [meme, setMeme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMeme = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('https://api.imgflip.com/get_memes');
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      const data = await response.json();
      if (!data.success || !data.data?.memes?.length) {
        throw new Error('Invalid data structure received from meme API.');
      }
      // Pick a random meme from the list
      const randomMeme = data.data.memes[Math.floor(Math.random() * data.data.memes.length)];
      setMeme(randomMeme);
    } catch (err) {
      console.error('Failed to load meme resource:', err);
      setError(err.message || 'Unable to connect to meme service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeme();
  }, []);

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 text-center">
      <h2 className="text-2xl font-bold mb-4 text-slate-800 dark:text-slate-100">Meme Generator</h2>

      {loading && (
        <div className="py-12 text-slate-500 animate-pulse">Loading fresh meme...</div>
      )}

      {error && (
        <div className="my-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg text-red-800 dark:text-red-200">
          <svg className="w-8 h-8 mx-auto mb-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-semibold text-sm mb-1">Network Error / Resource Unavailable</p>
          <p className="text-xs text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchMeme}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && meme && (
        <div className="space-y-4">
          <div className="rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
            <img src={meme.url} alt={meme.name} className="w-full h-64 object-contain" />
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{meme.name}</p>
          <button
            onClick={fetchMeme}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            Generate Another
          </button>
        </div>
      )}
    </div>
  );
};

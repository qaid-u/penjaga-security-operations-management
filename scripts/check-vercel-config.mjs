const { VITE_API_URL, VITE_PREVIEW_ONLY } = process.env;

if (VITE_PREVIEW_ONLY !== 'true') {
  let api;
  try {
    api = new URL(VITE_API_URL);
  } catch {
    // Report the required configuration without printing its value.
  }
  if (api?.protocol !== 'https:' || api.pathname.replace(/\/$/, '') !== '/api' ||
      api.username || api.password || api.search || api.hash ||
      ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(api.hostname)) {
    console.error('Set VITE_API_URL to the hosted HTTPS Express API, for example https://api.example.com/api.');
    process.exitCode = 1;
  }
}

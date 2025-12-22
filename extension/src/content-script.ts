function getToken(): string | null {
  try {
    return window.localStorage.getItem('token');
  } catch {
    return null;
  }
}

async function syncTokenToExtension() {
  const token = getToken();
  if (!token) return;
  try {
    await chrome.runtime.sendMessage({ type: 'AUTH_SYNC', token });
    window.postMessage({ type: 'CLUESO_CLONE_TOKEN_SYNCED' }, '*');
  } catch {
    // ignore if extension not available
  }
}

// Initial attempt on page load
void syncTokenToExtension();

// Re-attempt shortly after load (helps when localStorage token is set after navigation)
setTimeout(() => void syncTokenToExtension(), 500);
setTimeout(() => void syncTokenToExtension(), 2000);

// Listen for explicit requests from the page
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== 'CLUESO_CLONE_REQUEST_TOKEN') return;
  void syncTokenToExtension();
});

// Listen for token changes in other tabs
window.addEventListener('storage', (e) => {
  if (e.key === 'token') void syncTokenToExtension();
});

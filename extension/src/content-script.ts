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
// Listen for token changes in other tabs
window.addEventListener('storage', (e) => {
  if (e.key === 'token') void syncTokenToExtension();
});

let uiContainer: HTMLElement | null = null;
let timerInterval: number | null = null;
let startTime: number = 0;

function createUI() {
  if (uiContainer) return;

  const host = document.createElement('div');
  host.id = 'clueso-recorder-host';
  host.style.position = 'fixed';
  host.style.bottom = '20px';
  host.style.left = '20px';
  host.style.zIndex = '2147483647';

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = `
    .container {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: white;
      border-radius: 999px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      color: #111;
    }
    .red-dot {
      width: 8px;
      height: 8px;
      background-color: #ef4444;
      border-radius: 50%;
    }
    .recording-text {
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .timer {
      color: #666;
      min-width: 24px;
      font-feature-settings: "tnum";
      font-variant-numeric: tabular-nums;
    }
    .separator {
      width: 1px;
      height: 24px;
      background-color: #e5e7eb;
    }
    button {
      cursor: pointer;
      border: none;
      font-size: 14px;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    button:hover {
      opacity: 0.9;
    }
    .btn-stop {
      background-color: #ef4444;
      color: white;
      padding: 6px 16px;
      border-radius: 6px;
    }
    .btn-discard {
      background-color: white;
      color: #111;
      border: 1px solid #e5e7eb;
      padding: 6px 12px;
      border-radius: 6px;
    }
    .btn-open {
      background: none;
      color: #111;
      padding: 6px 8px;
    }
  `;

  const wrapper = document.createElement('div');
  wrapper.className = 'container';
  wrapper.innerHTML = `
    <div class="recording-text">
      <div class="red-dot"></div>
      <span>Recording</span>
    </div>
    <div class="timer" id="timer">0s</div>
    <div class="separator"></div>
    <button class="btn-stop" id="stopBtn">Stop</button>
    <button class="btn-discard" id="discardBtn">Discard</button>
    <button class="btn-open" id="openBtn">Open</button>
  `;

  shadow.appendChild(style);
  shadow.appendChild(wrapper);
  document.body.appendChild(host);
  uiContainer = host;

  shadow.getElementById('stopBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
  });

  shadow.getElementById('discardBtn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING', discard: true });
  });

  shadow.getElementById('openBtn')?.addEventListener('click', () => {
    window.open('http://localhost:3000/dashboard', '_blank');
  });
}

function removeUI() {
  if (uiContainer) {
    uiContainer.remove();
    uiContainer = null;
  }
}

function startTimer() {
  startTime = Date.now();
  const update = () => {
    if (!uiContainer?.shadowRoot) return;
    const el = uiContainer.shadowRoot.getElementById('timer');
    if (el) {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      el.textContent = `${diff}s`;
    }
  };
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = window.setInterval(update, 1000);
  update();
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'SHOW_CLUESO_UI') {
    createUI();
    startTimer();
  }
  if (message.type === 'HIDE_CLUESO_UI') {
    stopTimer();
    removeUI();
  }
  if (message.type === 'UPDATE_UI') {
    if (message.status === 'uploading') {
      stopTimer();
      if (uiContainer?.shadowRoot) {
        const container = uiContainer.shadowRoot.querySelector('.container');
        if (container) {
          container.innerHTML = `
            <div class="recording-text" style="color:#666">
              <div class="red-dot" style="background-color:#fbbf24"></div>
              <span>Uploading to library...</span>
            </div>
          `;
        }
      }
    }
  }

  if (message.type === 'SHOW_ERROR') {
    stopTimer();
    if (uiContainer?.shadowRoot) {
      const container = uiContainer.shadowRoot.querySelector('.container');
      if (container) {
        container.innerHTML = `
            <div class="recording-text" style="color:#ef4444">
              <div class="red-dot"></div>
              <span>${message.error || 'Error'}</span>
            </div>
          `;
      }
    }
  }
});

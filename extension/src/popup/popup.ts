const APP_ORIGIN = 'http://localhost:3000';

async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');
  return tab.id;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function qs(id: string) {
  return document.getElementById(id) as HTMLElement | null;
}

function setStatus(text: string) {
  const el = qs('status');
  if (el) el.textContent = text;
}

function setAuth(text: string) {
  const el = qs('auth');
  if (el) el.textContent = text;
}

function setAuthHintVisible(visible: boolean) {
  const el = qs('authHint');
  if (el) (el as HTMLElement).style.display = visible ? 'block' : 'none';
}

async function refreshState() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  const recording = Boolean(state?.recording);

  (qs('start') as HTMLButtonElement).disabled = recording;
  (qs('stop') as HTMLButtonElement).disabled = !recording;
  setStatus(recording ? 'Recording…' : 'Idle');
}

async function start() {
  const tabId = await getActiveTabId();
  const withMic = (qs('mic') as HTMLInputElement).checked;

  setStatus('Starting…');
  const res = await chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId, withMic });
  if (!res?.ok) throw new Error(res?.error ?? 'Failed to start');

  await refreshState();
}

async function stop() {
  setStatus('Stopping…');
  const res = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
  if (!res?.ok) throw new Error(res?.error ?? 'Failed to stop');

  const result = res?.result?.result;
  if (result?.url && result?.filename) {
    await chrome.downloads.download({
      url: result.url,
      filename: result.filename,
      saveAs: true
    });
  }

  await refreshState();
}

async function openApp(path: string) {
  await chrome.tabs.create({ url: `${APP_ORIGIN}${path}` });
}

qs('start')?.addEventListener('click', () => {
  start().catch((e) => setStatus(String(e?.message ?? e)));
});

qs('stop')?.addEventListener('click', () => {
  stop().catch((e) => setStatus(String(e?.message ?? e)));
});

(async () => {
  await refreshState();
})();

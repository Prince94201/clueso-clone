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

function showRecordSection(show: boolean) {
  const record = qs('recordSection');
  if (record) record.classList.toggle('hidden', !show);
  const chooseRecord = qs('chooseRecord');
  const chooseUpload = qs('chooseUpload');
  if (chooseRecord) chooseRecord.classList.toggle('hidden', show);
  if (chooseUpload) chooseUpload.classList.toggle('hidden', show);
}

async function refreshAuth() {
  const res = await chrome.runtime.sendMessage({ type: 'AUTH_STATUS' });
  const signedIn = Boolean(res?.signedIn);
  setAuth(signedIn ? 'Connected' : 'Not connected');
  setAuthHintVisible(!signedIn);
}

async function requestTokenFromPageIfPossible() {
  const tab = await getActiveTab();
  const url = tab?.url ?? '';
  if (!url.startsWith(APP_ORIGIN)) return;
  if (!tab?.id) return;

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      window.postMessage({ type: 'CLUESO_CLONE_REQUEST_TOKEN' }, '*');
    }
  });
}

async function refreshState() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  const recording = Boolean(state?.recording);

  (qs('start') as HTMLButtonElement).disabled = recording;
  (qs('stop') as HTMLButtonElement).disabled = !recording;
  setStatus(recording ? 'Recording…' : 'Idle');

  // If recording is active, always show the record controls so Stop is available
  if (recording) showRecordSection(true);
}

async function start() {
  const tabId = await getActiveTabId();
  const withMic = (qs('mic') as HTMLInputElement).checked;

  setStatus('Starting…');
  const res = await chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId, withMic });
  if (!res?.ok) throw new Error(res?.error ?? 'Failed to start');

  // Ensure the record section stays visible after starting so Stop is shown
  showRecordSection(true);
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

qs('chooseRecord')?.addEventListener('click', () => {
  // Most suitable: use the web app recorder UI (more features, uploads to library)
  openApp('/dashboard?record=1').catch(() => void 0);
});

qs('chooseUpload')?.addEventListener('click', () => {
  openApp('/videos/upload').catch(() => void 0);
});

qs('back')?.addEventListener('click', () => {
  showRecordSection(false);
});

qs('start')?.addEventListener('click', () => {
  start().catch((e) => setStatus(String(e?.message ?? e)));
});

qs('stop')?.addEventListener('click', () => {
  stop().catch((e) => setStatus(String(e?.message ?? e)));
});

(async () => {
  // If the user is already recording and reopens the popup, show Stop immediately.
  showRecordSection(false);
  await refreshAuth();
  await requestTokenFromPageIfPossible();
  await refreshAuth();
  await refreshState();
})().catch(() => void 0);

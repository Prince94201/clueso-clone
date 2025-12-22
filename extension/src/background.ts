type RecorderState = {
  recording: boolean;
};

const state: RecorderState = {
  recording: false
};

const OFFSCREEN_URL = 'offscreen/offscreen.html';

async function ensureOffscreenDocument() {
  // @ts-ignore - MV3 offscreen types vary by @types/chrome version
  const existing = await chrome.offscreen.hasDocument?.();
  if (existing) return;

  // @ts-ignore - MV3 offscreen types vary by @types/chrome version
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: 'Record the current tab using MediaRecorder in an offscreen document.'
  });
}

async function setAuthToken(token: string | null) {
  if (token) {
    await chrome.storage.local.set({ authToken: token });
  } else {
    await chrome.storage.local.remove('authToken');
  }
}

async function getAuthToken(): Promise<string | null> {
  const res = await chrome.storage.local.get('authToken');
  return (res?.authToken as string | undefined) ?? null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'AUTH_SYNC') {
      const token = typeof message?.token === 'string' ? message.token : null;
      if (token) await setAuthToken(token);
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'AUTH_STATUS') {
      const token = await getAuthToken();
      sendResponse({ ok: true, signedIn: Boolean(token) });
      return;
    }

    if (message?.type === 'GET_STATE') {
      sendResponse({ recording: state.recording });
      return;
    }

    if (message?.type === 'START_RECORDING') {
      if (state.recording) {
        sendResponse({ ok: true, recording: true });
        return;
      }

      await ensureOffscreenDocument();

      const streamId = await chrome.tabCapture.getMediaStreamId({
        targetTabId: message?.tabId
      });

      await chrome.runtime.sendMessage({
        type: 'OFFSCREEN_START',
        streamId,
        withMic: Boolean(message?.withMic)
      });

      state.recording = true;
      sendResponse({ ok: true, recording: true });
      return;
    }

    if (message?.type === 'STOP_RECORDING') {
      if (!state.recording) {
        sendResponse({ ok: true, recording: false });
        return;
      }

      const result = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
      state.recording = false;
      sendResponse({ ok: true, recording: false, result });
      return;
    }

    sendResponse({ ok: false, error: 'Unknown message' });
  })().catch((err) => {
    sendResponse({ ok: false, error: String(err?.message ?? err) });
  });

  return true;
});

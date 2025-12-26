type RecorderState = {
  recording: boolean;
  recordingTabId: number | null;
};

const state: RecorderState = {
  recording: false,
  recordingTabId: null
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
      state.recordingTabId = message?.tabId;

      // Show the floating UI on the recording tab
      if (state.recordingTabId) {
        chrome.tabs.sendMessage(state.recordingTabId, { type: 'SHOW_CLUESO_UI' }).catch(() => { });
      }

      sendResponse({ ok: true, recording: true });
      return;
    }

    if (message?.type === 'STOP_RECORDING') {
      if (!state.recording) {
        sendResponse({ ok: true, recording: false });
        // Ensure UI is hidden even if we thought we weren't recording
        if (state.recordingTabId) {
          chrome.tabs.sendMessage(state.recordingTabId, { type: 'HIDE_CLUESO_UI' }).catch(() => { });
          state.recordingTabId = null;
        }
        return;
      }

      // If discard is requested, stop and cleanup without upload
      if (message.discard) {
        await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
        state.recording = false;
        if (state.recordingTabId) {
          chrome.tabs.sendMessage(state.recordingTabId, { type: 'HIDE_CLUESO_UI' }).catch(() => { });
          state.recordingTabId = null;
        }
        sendResponse({ ok: true, recording: false, discarded: true });
        return;
      }

      // 1. Notify UI: Uploading
      if (state.recordingTabId) {
        chrome.tabs.sendMessage(state.recordingTabId, { type: 'UPDATE_UI', status: 'uploading' }).catch(() => { });
      }

      // 2. Stop recording to get blob
      const result = await chrome.runtime.sendMessage({ type: 'OFFSCREEN_STOP' });
      state.recording = false;
      const resData = result?.result;

      if (!resData?.url) {
        // Error case
        if (state.recordingTabId) {
          chrome.tabs.sendMessage(state.recordingTabId, { type: 'HIDE_CLUESO_UI' }).catch(() => { });
          state.recordingTabId = null;
        }
        sendResponse({ ok: false, error: 'No recording data' });
        return;
      }

      // 3. Upload process
      (async () => {
        try {
          const token = await getAuthToken();
          if (!token) throw new Error('Not authenticated');

          const blob = await fetch(resData.url).then(r => r.blob());
          const file = new File([blob], resData.filename, { type: 'video/webm' });

          const formData = new FormData();
          formData.append('video', file);
          formData.append('title', 'Screen Recording ' + new Date().toLocaleString());

          // Server likely on 5001 to avoid AirPlay conflict (default in client lib)
          const uploadRes = await fetch('http://localhost:5001/api/videos', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`);

          const video = await uploadRes.json();

          // 4. Success: Redirect to video page
          if (video?.id) {
            chrome.tabs.create({ url: `http://localhost:3000/videos/${video.id}` });
          }
        } catch (err: any) {
          console.error('Upload error:', err);

          if (state.recordingTabId) {
            chrome.tabs.sendMessage(state.recordingTabId, {
              type: 'SHOW_ERROR',
              error: `Upload failed: ${err?.message?.slice(0, 40) || 'Unknown'}`
            }).catch(() => { });
          }

          // Wait a bit for user to see error
          await new Promise(r => setTimeout(r, 3000));

          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'assets/icon128.png',
            title: 'Upload Failed',
            message: `Error: ${err?.message || 'Unknown'}. Saving locally.`
          });

          // Fallback: download if upload fails so user doesn't lose data
          await chrome.downloads.download({
            url: resData.url,
            filename: resData.filename,
            saveAs: true
          });
        } finally {
          // 5. Cleanup UI
          if (state.recordingTabId) {
            chrome.tabs.sendMessage(state.recordingTabId, { type: 'HIDE_CLUESO_UI' }).catch(() => { });
            state.recordingTabId = null;
          }
        }
      })();

      sendResponse({ ok: true, recording: false, uploadStarted: true });
      return;
    }

    sendResponse({ ok: false, error: 'Unknown message' });
  })().catch((err) => {
    sendResponse({ ok: false, error: String(err?.message ?? err) });
  });

  return true;
});

let recorder: MediaRecorder | null = null;
let recordedChunks: BlobPart[] = [];
let activeStream: MediaStream | null = null;

function stopTracks(stream: MediaStream | null) {
  if (!stream) return;
  for (const t of stream.getTracks()) t.stop();
}

async function getTabStream(streamId: string): Promise<MediaStream> {
  // Important: use getUserMedia with chromeMediaSourceId (works with tabCapture.getMediaStreamId)
  return await navigator.mediaDevices.getUserMedia({
    video: {
      // @ts-ignore - Chrome-specific constraint
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    },
    audio: {
      // tab audio
      // @ts-ignore - Chrome-specific constraint
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId
      }
    }
  } as any);
}

async function getMicStream(): Promise<MediaStream> {
  return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
}

function mixAudioStreams(streams: MediaStream[]): MediaStreamTrack | null {
  const audioTracks = streams.flatMap((s) => s.getAudioTracks());
  if (audioTracks.length === 0) return null;

  const ctx = new AudioContext();
  const destination = ctx.createMediaStreamDestination();

  for (const track of audioTracks) {
    const src = ctx.createMediaStreamSource(new MediaStream([track]));
    src.connect(destination);
  }

  return destination.stream.getAudioTracks()[0] ?? null;
}

async function startRecording(streamId: string, withMic: boolean) {
  if (recorder) return;

  recordedChunks = [];

  const tabStream = await getTabStream(streamId);
  let micStream: MediaStream | null = null;

  if (withMic) {
    try {
      micStream = await getMicStream();
    } catch {
      micStream = null;
    }
  }

  const tracks: MediaStreamTrack[] = [];
  // video from tab
  const videoTrack = tabStream.getVideoTracks()[0];
  if (videoTrack) tracks.push(videoTrack);

  // mix tab audio + mic audio if present
  const mixedAudio = mixAudioStreams([tabStream, ...(micStream ? [micStream] : [])]);
  if (mixedAudio) tracks.push(mixedAudio);

  activeStream = new MediaStream(tracks);

  const mimeTypeCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];

  const mimeType = mimeTypeCandidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';

  recorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  recorder.start(1000);

  // cleanup mic stream tracks (video none) when tab ends too
  tabStream.getTracks().forEach((t) =>
    t.addEventListener('ended', () => {
      // tab capture ended by user
      void stopRecording();
    })
  );
}

async function stopRecording(): Promise<{ url: string; filename: string } | null> {
  if (!recorder) return null;

  const localRecorder = recorder;
  recorder = null;

  await new Promise<void>((resolve) => {
    localRecorder.onstop = () => resolve();
    localRecorder.stop();
  });

  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  recordedChunks = [];

  stopTracks(activeStream);
  activeStream = null;

  const url = URL.createObjectURL(blob);
  const filename = `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;

  return { url, filename };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message?.type === 'OFFSCREEN_START') {
      await startRecording(message.streamId, Boolean(message.withMic));
      sendResponse({ ok: true });
      return;
    }

    if (message?.type === 'OFFSCREEN_STOP') {
      const result = await stopRecording();
      sendResponse({ ok: true, result });
      return;
    }

    sendResponse({ ok: false, error: 'Unknown message' });
  })().catch((err) => sendResponse({ ok: false, error: String(err?.message ?? err) }));

  return true;
});

// OpenAI AI service wrappers with retries
// transcribeAudio(audioPath)
// improveScript(transcript)
// generateVoiceover(script, voice)
// generateDocumentation(transcript)

const fs = require('fs/promises');
const fsSync = require('fs');
const llm = require('../server/src/config/openai');
const { spawn } = require('child_process');
const path = require('path');

function assertFileExists(filePath, label) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error(`${label} path is not set`);
  }
  if (!fsSync.existsSync(filePath)) {
    throw new Error(
      `${label} not found at '${filePath}'. ` +
      `Set ${label === 'Whisper model' ? 'WHISPER_MODEL_PATH' : 'WHISPER_CLI_PATH'} or place it at the expected location.`
    );
  }
}

async function withRetry(fn, attempts = 5) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err?.status || err?.response?.status;
      const isRateLimit = status === 429;
      const delayMs = isRateLimit ? Math.min(1000 * Math.pow(2, i), 15000) : 500 * (i + 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

function shouldFallbackToLocalLLM(err) {
  const status = err?.status || err?.response?.status;
  const msg = String(err?.message || err?.response?.data?.error?.message || '');
  // Only used to decide whether to fallback; local fallback is disabled.
  // Keep to maintain behavior of throwing original error when OpenAI is unavailable.
  return status === 429 || !process.env.OPENAI_API_KEY || /quota|insufficient|exceeded/i.test(msg);
}

function getTextModel() {
  // Prefer Groq free-tier when configured.
  if (llm.getProvider && llm.getProvider() === 'groq') {
    // Common fast Groq models; user can override.
    return process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  }
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

async function transcribeAudio(audioPath) {
  // 1. Groq Cloud Transcription (Fast & Accurate)
  // Use distil-whisper-large-v3-en for high quality transcription
  if (process.env.GROQ_API_KEY) {
    try {
      console.log('[AI] Starting Groq transcription for:', audioPath);
      const Groq = require('groq-sdk');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const transcription = await groq.audio.transcriptions.create({
        file: fsSync.createReadStream(audioPath),
        model: 'whisper-large-v3',
        response_format: 'json',
        language: 'en',
        temperature: 0.0
      });
      const text = (transcription.text || '').trim();
      console.log('[AI] Groq transcription result length:', text.length);
      if (!text) console.warn('[AI] Groq returned empty text');
      return text;
    } catch (err) {
      console.warn('Groq transcription error, falling back to local:', err.message);
      console.error(err);
    }
  }

  // 2. Local transcription using whisper.cpp CLI to avoid OpenAI quota.
  // Requirements:
  // - whisper-cli available (Homebrew: /opt/homebrew/bin/whisper-cli)
  // - GGML model file available (default: server/models/ggml-base.en.bin)
  return withRetry(async () => {
    const whisperBin = process.env.WHISPER_CLI_PATH || 'whisper-cli';

    const candidateModelPaths = process.env.WHISPER_MODEL_PATH
      ? [process.env.WHISPER_MODEL_PATH]
      : [
        path.resolve(__dirname, '../../models/ggml-base.en.bin'), // server/models
        path.resolve(__dirname, '../../../models/ggml-base.en.bin'), // repo-root models
      ];

    // Prefer the first one that exists, but do not hard-fail if missing.
    // This matches the previous behavior where whisper-cli produced the error.
    const modelPath = candidateModelPaths.find((p) => fsSync.existsSync(p)) || candidateModelPaths[0];

    // If whisperBin is a concrete path, validate it. If it's a bare command, allow PATH resolution.
    if (process.env.WHISPER_CLI_PATH) assertFileExists(whisperBin, 'Whisper CLI');

    const outDir = path.dirname(audioPath); // temp dir
    const baseName = path.parse(audioPath).name;

    await new Promise((resolve, reject) => {
      const args = [
        '-m',
        modelPath,
        '-f',
        audioPath,
        '-of',
        path.join(outDir, baseName),
        '-otxt',
        '--language',
        'en',
      ];

      const proc = spawn(whisperBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(`whisper-cli failed (code ${code}): ${stderr || 'unknown error'}`));
      });
    });

    const txtPath = path.join(outDir, `${baseName}.txt`);
    const text = await fs.readFile(txtPath, 'utf8').catch(() => '');

    // Cleanup generated files (best-effort)
    await fs.unlink(txtPath).catch(() => { });

    return (text || '').trim();
  });
}

async function summarizeContent(rawText) {
  if (!rawText || rawText.trim().length < 10) {
    console.log('[AI] Content too short to summarize, returning raw:', rawText);
    return rawText || 'No significant content detected in video.';
  }

  return withRetry(async () => {
    const response = await llm.chatCompletionsCreate({
      model: getTextModel(),
      messages: [
        {
          role: 'system',
          content: 'You are an expert video summarizer. You will receive a "Hybrid Input" containing "Audio Transcript" (spoken words) and "Visual Actions" (screen descriptions). Synthesize them into a single, cohesive, concise summary. Correlate what is said with what is shown. Capture the main purpose, key actions, and outcomes.'
        },
        { role: 'user', content: rawText }
      ],
      temperature: 0.3
    });
    return response.choices[0]?.message?.content || '';
  });
}

async function improveScript(transcript) {
  if (!transcript || transcript.trim().length < 50) {
    return "Please generate a more detailed summary first before generating a voiceover script.";
  }

  return withRetry(async () => {
    const response = await llm.chatCompletionsCreate({
      model: getTextModel(),
      messages: [
        {
          role: 'system',
          content:
            'Create a professional, concise voiceover script based on this video summary. Write ONLY the spoken words. Make it engaging. Do not include "Voiceover:" prefixes or scene descriptions.'
        },
        { role: 'user', content: transcript }
      ],
      temperature: 0.4
    });
    return response.choices[0]?.message?.content || '';
  }).catch((err) => {
    // Local LLM fallback removed; propagate error so callers can handle/quota messaging.
    if (shouldFallbackToLocalLLM(err)) throw err;
    throw err;
  });
}

async function generateVoiceover(script, voice = 'alloy') {
  // Prefer local TTS to avoid OpenAI quota on deployment.
  // Priority:
  // 1) Piper (cross-platform, best for deployment)
  //    - set PIPER_BIN_PATH and PIPER_MODEL_PATH in env
  // 2) macOS `say` fallback (dev only)
  return withRetry(async () => {
    const piperBin = process.env.PIPER_BIN_PATH;
    const piperModel = process.env.PIPER_MODEL_PATH;

    if (piperBin && piperModel) {
      // Piper writes WAV to stdout; we convert to mp3 with ffmpeg for consistency
      // NOTE: If ffmpeg is not in PATH, fluent-ffmpeg config already sets binary path, but here we invoke via spawn.
      const { spawn } = require('child_process');
      const tmp = require('os').tmpdir();
      const fileBase = `voice-${Date.now()}`;
      const wavPath = path.join(tmp, `${fileBase}.wav`);

      await new Promise((resolve, reject) => {
        const proc = spawn(piperBin, ['-m', piperModel, '-f', wavPath], { stdio: ['pipe', 'pipe', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', (d) => (stderr += d.toString()));
        proc.on('error', reject);
        proc.stdin.write(script);
        proc.stdin.end();
        proc.on('close', (code) => {
          if (code === 0) return resolve();
          reject(new Error(`piper failed (code ${code}): ${stderr || 'unknown error'}`));
        });
      });

      // Convert WAV -> MP3
      const mp3Path = path.join(tmp, `${fileBase}.mp3`);
      await new Promise((resolve, reject) => {
        const ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';
        const proc = spawn(ffmpegBin, ['-y', '-i', wavPath, '-codec:a', 'libmp3lame', '-q:a', '4', mp3Path], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderr = '';
        proc.stderr.on('data', (d) => (stderr += d.toString()));
        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code === 0) return resolve();
          reject(new Error(`ffmpeg convert failed (code ${code}): ${stderr || 'unknown error'}`));
        });
      });

      const buf = await fs.readFile(mp3Path);
      await fs.unlink(wavPath).catch(() => { });
      await fs.unlink(mp3Path).catch(() => { });
      return buf;
    }

    // macOS dev fallback
    if (process.platform === 'darwin') {
      const { spawn } = require('child_process');
      const tmp = require('os').tmpdir();
      const fileBase = `voice-${Date.now()}`;
      const aiffPath = path.join(tmp, `${fileBase}.aiff`);
      const mp3Path = path.join(tmp, `${fileBase}.mp3`);

      // pick a reasonable macOS voice
      const macVoice = voice === 'alloy' ? 'Samantha' : 'Alex';

      await new Promise((resolve, reject) => {
        const proc = spawn('say', ['-v', macVoice, '-o', aiffPath, script], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        proc.stderr.on('data', (d) => (stderr += d.toString()));
        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code === 0) return resolve();
          reject(new Error(`say failed (code ${code}): ${stderr || 'unknown error'}`));
        });
      });

      // Convert AIFF -> MP3 for browser playback consistency
      await new Promise((resolve, reject) => {
        const ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';
        const proc = spawn(ffmpegBin, ['-y', '-i', aiffPath, '-codec:a', 'libmp3lame', '-q:a', '4', mp3Path], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderr = '';
        proc.stderr.on('data', (d) => (stderr += d.toString()));
        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code === 0) return resolve();
          reject(new Error(`ffmpeg convert failed (code ${code}): ${stderr || 'unknown error'}`));
        });
      });

      const buf = await fs.readFile(mp3Path);
      await fs.unlink(aiffPath).catch(() => { });
      await fs.unlink(mp3Path).catch(() => { });
      return buf;
    }

    // Last resort: OpenAI (may 429 if no credits)
    const openai = require('openai');
    const OpenAI = openai;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.audio.speech.create({
      model: 'tts-1',
      voice,
      input: script,
      format: 'mp3'
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  });
}

async function generateDocumentation(transcript) {
  return withRetry(async () => {
    const response = await llm.chatCompletionsCreate({
      model: getTextModel(),
      messages: [
        {
          role: 'system',
          content:
            'Create a step-by-step guide from this video transcript. Format as markdown with numbered steps. Include clear instructions for each step.'
        },
        { role: 'user', content: transcript }
      ],
      temperature: 0.4
    });
    return response.choices[0]?.message?.content || '';
  }).catch((err) => {
    // Local LLM fallback removed; propagate error.
    if (shouldFallbackToLocalLLM(err)) throw err;
    throw err;
  });
}

async function generateDocumentationFromFrames(frameDescriptions) {
  return withRetry(async () => {
    const joined = Array.isArray(frameDescriptions) ? frameDescriptions.filter(Boolean).join('\n') : String(frameDescriptions || '');
    const response = await llm.chatCompletionsCreate({
      model: getTextModel(),
      messages: [
        {
          role: 'system',
          content:
            'You are given visual descriptions of keyframes from a silent screen-recording. ' +
            'Write clear end-user documentation in markdown. ' +
            'Format as a numbered step-by-step guide. ' +
            'Infer UI actions (click, open menu, type) from what is visible. ' +
            'If something is unclear, state an assumption briefly.'
        },
        { role: 'user', content: joined }
      ],
      temperature: 0.4
    });
    return response.choices[0]?.message?.content || '';
  });
}

async function describeFramesWithVision(imageDataUrls) {
  return withRetry(async () => {
    // Llama 4 Maverick supports max 5 images.
    // Batch inputs into chunks of 5.
    const allImages = Array.isArray(imageDataUrls) ? imageDataUrls : [];
    if (!allImages.length) return [];

    const BATCH_SIZE = 5;
    const allDescriptions = [];

    for (let i = 0; i < allImages.length; i += BATCH_SIZE) {
      const batch = allImages.slice(i, i + BATCH_SIZE);
      console.log(`[AI] Processing batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} images...`);

      let client, model;

      if (process.env.GROQ_API_KEY) {
        const Groq = require('groq-sdk');
        client = new Groq({ apiKey: process.env.GROQ_API_KEY });
        model = 'meta-llama/llama-4-maverick-17b-128e-instruct';
      } else {
        const OpenAI = require('openai');
        client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
      }

      const response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Analyze these screenshots from a screen recording. ' +
              'CRITICAL: Be strictly factual. Describe ONLY what is clearly visible in the images. ' +
              'Do NOT hallucinate application names ("Silent Screen Recorder", etc) or steps that are not shown. ' +
              'If the images show a generic interface, describe it generally (e.g. "User clicked the settings icon"). ' +
              'If the screen is mostly empty or shows a recording overlay, note that effectively.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Screenshots (batch ${Math.floor(i / BATCH_SIZE) + 1}, in chronological order):` },
              ...batch.map((u) => ({ type: 'image_url', image_url: { url: u } }))
            ]
          }
        ],
        temperature: 0.1
      });

      const text = response.choices[0]?.message?.content || '';
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      allDescriptions.push(...lines);
    }

    return allDescriptions;
  });
}

module.exports = {
  transcribeAudio,
  improveScript,
  generateVoiceover,
  generateDocumentation,
  generateDocumentationFromFrames,
  describeFramesWithVision,
  summarizeContent
};
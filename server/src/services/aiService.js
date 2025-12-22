// OpenAI AI service wrappers with retries
// transcribeAudio(audioPath)
// improveScript(transcript)
// generateVoiceover(script, voice)
// generateDocumentation(transcript)

const fs = require('fs/promises');
const fsSync = require('fs');
const openai = require('../config/openai');
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

async function transcribeAudio(audioPath) {
  // Local transcription using whisper.cpp CLI to avoid OpenAI quota.
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
    await fs.unlink(txtPath).catch(() => {});

    return (text || '').trim();
  });
}

async function improveScript(transcript) {
  return withRetry(async () => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Clean this video transcript. Remove filler words (um, uh, like, you know). Improve grammar and clarity. Make it professional. Keep the same meaning.' },
        { role: 'user', content: transcript }
      ],
      temperature: 0.3
    });
    return response.choices[0]?.message?.content || '';
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
      await fs.unlink(wavPath).catch(() => {});
      await fs.unlink(mp3Path).catch(() => {});
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
      await fs.unlink(aiffPath).catch(() => {});
      await fs.unlink(mp3Path).catch(() => {});
      return buf;
    }

    // Last resort: OpenAI (may 429 if no credits)
    const response = await openai.audio.speech.create({
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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Create a step-by-step guide from this video transcript. Format as markdown with numbered steps. Include clear instructions for each step.' },
        { role: 'user', content: transcript }
      ],
      temperature: 0.4
    });
    return response.choices[0]?.message?.content || '';
  });
}

async function generateDocumentationFromFrames(frameDescriptions) {
  return withRetry(async () => {
    const joined = Array.isArray(frameDescriptions) ? frameDescriptions.filter(Boolean).join('\n') : String(frameDescriptions || '');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
    const images = Array.isArray(imageDataUrls) ? imageDataUrls.slice(0, 8) : [];
    if (!images.length) return [];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Describe what is happening in these screenshots from a screen recording. ' +
            'For each image, output 1-2 sentences describing visible UI and the likely user action. ' +
            'Return as a numbered list with the same order as provided.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Screenshots (in order):' },
            ...images.map((u) => ({ type: 'image_url', image_url: { url: u } }))
          ]
        }
      ],
      temperature: 0.2
    });

    const text = response.choices[0]?.message?.content || '';
    // Return as lines; caller can keep raw text if desired
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  });
}

module.exports = {
  transcribeAudio,
  improveScript,
  generateVoiceover,
  generateDocumentation,
  generateDocumentationFromFrames,
  describeFramesWithVision
};
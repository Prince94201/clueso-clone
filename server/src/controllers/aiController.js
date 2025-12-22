// AI processing controller per requirements

const path = require('path');
const { extractAudio, ensureDir, deleteFile, hasAudioTrack, extractFrames } = require('../services/fileService');
const videoService = require('../services/videoService');
const aiService = require('../services/aiService');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/db');
const fs = require('fs/promises');

// TRANSCRIBE
exports.transcribe = async (req, res, next) => {
  try {
    const video = await videoService.getVideoById(req.params.id);
    if (!video || video.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });

    const root = process.env.UPLOAD_PATH || './uploads';
    const tempDir = path.join(root, 'temp');
    await ensureDir(tempDir);

    const videoAbs = path.join(root, video.video_path);
    const hasAudio = await hasAudioTrack(videoAbs).catch(() => true);

    if (!hasAudio) {
      // Visual-only fallback: generate documentation from frames
      const framesDir = path.join(tempDir, `${video.id}-frames`);
      const framePaths = await extractFrames(videoAbs, framesDir, 6);
      const dataUrls = await Promise.all(
        framePaths.map(async (p) => {
          const buf = await fs.readFile(p);
          return `data:image/jpeg;base64,${buf.toString('base64')}`;
        })
      );

      const descriptions = await aiService.describeFramesWithVision(dataUrls);
      const md = await aiService.generateDocumentationFromFrames(descriptions);

      // Also store a transcript-like payload so the UI can show something in the Transcript tab.
      // This enables Improve Script / Voiceover flows even for silent videos.
      const transcriptText = Array.isArray(descriptions)
        ? descriptions.join('\n')
        : String(descriptions || '').trim();
      const transcriptId = uuidv4();
      await query('INSERT INTO transcripts (id, video_id, original_transcript, language) VALUES (?, ?, ?, ?)', [
        transcriptId,
        video.id,
        transcriptText,
        'en'
      ]);

      const docId = uuidv4();
      await query('INSERT INTO documentation (id, video_id, content, format) VALUES (?, ?, ?, ?)', [docId, video.id, md, 'markdown']);
      await videoService.updateVideoStatus(video.id, 'processing');

      // cleanup best-effort
      await Promise.all(framePaths.map((p) => deleteFile(p))).catch(() => {});
      res.json({
        ok: true,
        mode: 'visual',
        transcript: { id: transcriptId, video_id: video.id, original_transcript: transcriptText, language: 'en' },
        documentation: { id: docId, video_id: video.id, content: md, format: 'markdown' }
      });
      return;
    }

    const audioPath = path.join(tempDir, `${video.id}.mp3`);
    await extractAudio(videoAbs, audioPath);

    const text = await aiService.transcribeAudio(audioPath);

    const transcriptId = uuidv4();
    await query('INSERT INTO transcripts (id, video_id, original_transcript, language) VALUES (?, ?, ?, ?)', [transcriptId, video.id, text, 'en']);
    await videoService.updateVideoStatus(video.id, 'processing');

    await deleteFile(audioPath);
    res.json({ ok: true, mode: 'audio', transcript: { id: transcriptId, video_id: video.id, original_transcript: text, language: 'en' } });
  } catch (err) { next(err); }
};

// IMPROVE_SCRIPT
exports.improveScript = async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM transcripts WHERE video_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
    const tr = rows[0];
    if (!tr) return res.status(404).json({ error: 'Transcript not found' });

    const improved = await aiService.improveScript(tr.original_transcript);
    await query('UPDATE transcripts SET improved_script = ? WHERE id = ?', [improved, tr.id]);
    res.json({ id: tr.id, improved_script: improved });
  } catch (err) { next(err); }
};

// GENERATE_VOICEOVER
exports.generateVoice = async (req, res, next) => {
  try {
    // If documentation exists (typical for silent videos processed via visual pipeline),
    // prefer using it as the voiceover script.
    const docs = await query('SELECT * FROM documentation WHERE video_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
    const doc = docs[0];

    const rows = await query('SELECT * FROM transcripts WHERE video_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
    const tr = rows[0];
    if (!doc && !tr) return res.status(404).json({ error: 'Transcript/Documentation not found' });

    const scriptText = (doc?.content && String(doc.content).trim())
      ? String(doc.content).trim()
      : (tr?.improved_script || tr?.original_transcript || '');

    if (!scriptText) return res.status(400).json({ error: 'No script content available for voiceover' });
    const voice = req.body.voice || 'alloy';

    const buffer = await aiService.generateVoiceover(scriptText, voice);

    const root = process.env.UPLOAD_PATH || './uploads';
    const audioDir = path.join(root, 'audio');
    await ensureDir(audioDir);
    const audioRel = path.join('audio', `${req.params.id}.mp3`);
    const audioAbs = path.join(root, `${audioRel}`);
    await fsWriteFile(audioAbs, buffer);

    const id = uuidv4();
    await query('INSERT INTO voiceovers (id, video_id, audio_path, voice_type, script_text) VALUES (?, ?, ?, ?, ?)', [id, req.params.id, audioRel, voice, scriptText]);
    res.json({ id, video_id: req.params.id, audio_path: audioRel, voice_type: voice });
  } catch (err) { next(err); }
};

async function fsWriteFile(p, data) {
  const fs = require('fs/promises');
  await fs.writeFile(p, data);
}

// GENERATE_DOCUMENTATION
exports.generateDocs = async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM transcripts WHERE video_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
    const tr = rows[0];
    if (!tr) return res.status(404).json({ error: 'Transcript not found' });

    const md = await aiService.generateDocumentation(tr.original_transcript);
    const id = uuidv4();
    await query('INSERT INTO documentation (id, video_id, content, format) VALUES (?, ?, ?, ?)', [id, req.params.id, md, 'markdown']);
    res.json({ id, video_id: req.params.id, content: md, format: 'markdown' });
  } catch (err) { next(err); }
};
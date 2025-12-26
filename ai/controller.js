// AI processing controller per requirements

const path = require('path');
const { extractAudio, ensureDir, deleteFile, hasAudioTrack, extractFrames } = require('../server/src/services/fileService');
const videoService = require('../server/src/services/videoService');
const aiService = require('./service');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../server/src/config/db');
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

    // Try audio first
    let text = '';
    let mode = 'audio';
    const hasAudio = await hasAudioTrack(videoAbs).catch(() => false);

    if (hasAudio) {
      const audioPath = path.join(tempDir, `${video.id}.mp3`);
      try {
        await extractAudio(videoAbs, audioPath);
        text = await aiService.transcribeAudio(audioPath);
        await deleteFile(audioPath).catch(() => { });

        // Filter out common Whisper hallucinations on silent audio
        const HALLUCINATIONS = [
          'Thank you', 'Thanks for watching', 'Subtitle', 'Caption', 'Amara',
          'Copyright', 'All rights reserved', '[Silence]', 'Music', 'No audio',
          'You', 'Bye', 'MBC', 'SBS', 'KBS'
        ];

        const isGarbage = !text || text.length < 10 || (text.length < 60 && HALLUCINATIONS.some(h => text.toLowerCase().includes(h.toLowerCase())));

        if (isGarbage) {
          console.log(`[AI] Transcript rejected as hallucination/noise (length ${text?.length}): "${text}". Switching to visual.`);
          text = '';
        } else {
          // Summarize the raw text to create "AI Summary"
          text = await aiService.summarizeContent(text);
        }

      } catch (err) {
        console.warn('[AI] Audio processing failed:', err);
      }
    }

    let documentation = null;

    // If no text (silent or no audio), use visual fallback
    if (!text || text.trim().length === 0) {
      console.log('[AI] No audio transcript generated. Switching to visual processing.');
      mode = 'visual';

      const framesDir = path.join(tempDir, `${video.id}-frames`);
      const framePaths = await extractFrames(videoAbs, framesDir, { interval: 0.3 });
      console.log(`[AI] Extracted ${framePaths.length} frames for visual processing.`);

      try {
        if (framePaths.length === 0) {
          console.warn('[AI] No frames extracted! Visual description will be empty.');
        }

        const dataUrls = await Promise.all(
          framePaths.map(async (p) => {
            const buf = await fs.readFile(p);
            return `data:image/jpeg;base64,${buf.toString('base64')}`;
          })
        );

        const descriptions = await aiService.describeFramesWithVision(dataUrls);
        console.log(`[AI] Vision descriptions count: ${descriptions.length}`);

        const rawDescr = Array.isArray(descriptions) ? descriptions.join('\n') : String(descriptions || '');
        console.log(`[AI] Raw visual description length: ${rawDescr.length}`);

        // Generate Summary from visual descriptions
        text = await aiService.summarizeContent(rawDescr);

        // We can keep specific docs generation or just use text.
        // For backward compat, we might still insert into documentation table, or just skip it if frontend ignores it.
        // But let's generate "Documentation" from summary just in case.
        const md = await aiService.generateDocumentation(text);

        // Save documentation immediately as per original visual flow
        const docId = uuidv4();
        await query('INSERT INTO documentation (id, video_id, content, format) VALUES (?, ?, ?, ?)', [docId, video.id, md, 'markdown']);
        documentation = { id: docId, video_id: video.id, content: md, format: 'markdown' };
      } finally {
        await Promise.all(framePaths.map((p) => deleteFile(p))).catch(() => { });
        // remove frame dir
        await fs.rmdir(framesDir).catch(() => { });
      }
    }

    const transcriptId = uuidv4();
    await query('INSERT INTO transcripts (id, video_id, original_transcript, language) VALUES (?, ?, ?, ?)', [transcriptId, video.id, text, 'en']);
    await videoService.updateVideoStatus(video.id, 'processing');

    res.json({
      ok: true,
      mode,
      transcript: { id: transcriptId, video_id: video.id, original_transcript: text, language: 'en' },
      documentation // will be null for audio mode, populated for visual mode
    });

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
    const rows = await query('SELECT * FROM transcripts WHERE video_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
    const tr = rows[0];

    const docs = await query('SELECT * FROM documentation WHERE video_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.id]);
    const doc = docs[0];

    const source = req.body.source || 'summary';
    let scriptText = '';

    if (source === 'transcript') {
      if (!tr) return res.status(404).json({ error: 'Transcript not found' });
      scriptText = tr.improved_script || tr.original_transcript || '';
    } else {
      // summary
      if (!doc) return res.status(404).json({ error: 'Summary not found. Please generate it first.' });
      scriptText = doc.content || '';
    }

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
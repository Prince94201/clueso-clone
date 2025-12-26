// GraphQL resolvers mapping to services and controllers

const { query } = require('../config/db');
const videoService = require('../services/videoService');
const aiService = require('../../../ai/service');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { ensureDir } = require('../services/fileService');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const resolvers = {
  Date: {
    __parseValue: (value) => new Date(value),
    __serialize: (value) => (value instanceof Date ? value.toISOString() : value),
    __parseLiteral: (ast) => new Date(ast.value),
  },
  Query: {
    me: async (_, __, { user }) => user || null,
    videos: async (_, { page, limit, status }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      return videoService.getUserVideos(user.id, page, limit, { status });
    },
    video: async (_, { id }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      const v = await videoService.getVideoById(id);
      if (!v || v.user_id !== user.id) return null;
      return v;
    },
    shared: async (_, { token }) => {
      const rows = await query('SELECT * FROM share_links WHERE token = ?', [token]);
      const link = rows[0];
      if (!link) return null;
      if (link.expires_at && new Date(link.expires_at) < new Date()) return null;
      await query('UPDATE share_links SET view_count = view_count + 1 WHERE id = ?', [link.id]);
      const video = await videoService.getVideoById(link.video_id);
      if (!video) return null;
      delete video.user_id;
      return video;
    },
  },
  Mutation: {
    register: async (_, { email, password, name }) => {
      const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
      if (existing.length) throw new Error('Email already registered');
      const hash = await bcrypt.hash(password, 10);
      const id = uuidv4();
      await query('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)', [id, email, hash, name]);
      const token = signToken(id);
      return { token, user: { id, email, name } };
    },
    login: async (_, { email, password }) => {
      const users = await query('SELECT id, email, password_hash, name FROM users WHERE email = ?', [email]);
      const user = users[0];
      if (!user) throw new Error('Invalid credentials');
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) throw new Error('Invalid credentials');
      const token = signToken(user.id);
      return { token, user: { id: user.id, email: user.email, name: user.name } };
    },
    uploadVideo: async (_, { title, description, filePath }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      // filePath should be a path inside UPLOAD_PATH/videos/{userId}/ previously saved by client-side upload
      const root = process.env.UPLOAD_PATH || './uploads';
      const abs = path.join(root, filePath);
      const { generateThumbnail, getVideoDuration } = require('../services/fileService');
      const videoId = uuidv4();
      const thumbDir = path.join(root, 'thumbnails', user.id);
      await ensureDir(thumbDir);
      const thumbnailAbs = path.join(thumbDir, `${path.parse(abs).name}.jpg`);
      const duration = await getVideoDuration(abs);
      await generateThumbnail(abs, thumbnailAbs);
      const videoRel = path.relative(root, abs);
      const thumbRel = path.relative(root, thumbnailAbs);
      await query('INSERT INTO videos (id, user_id, title, description, video_path, thumbnail_path, duration, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [videoId, user.id, title || null, description || null, videoRel, thumbRel, duration, 'uploaded']);
      return videoService.getVideoById(videoId);
    },
    updateVideo: async (_, { id, input }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      const v = await videoService.getVideoById(id);
      if (!v || v.user_id !== user.id) throw new Error('Not found');
      return videoService.updateVideo(id, input);
    },
    deleteVideo: async (_, { id }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      const v = await videoService.getVideoById(id);
      if (!v || v.user_id !== user.id) throw new Error('Not found');
      const { deleteFile } = require('../services/fileService');
      const root = process.env.UPLOAD_PATH || './uploads';
      await deleteFile(path.join(root, v.video_path));
      await deleteFile(path.join(root, v.thumbnail_path));
      await videoService.deleteVideo(id);
      return true;
    },
    createShareLink: async (_, { videoId, expiresInHours }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      const v = await videoService.getVideoById(videoId);
      if (!v || v.user_id !== user.id) throw new Error('Not found');
      const crypto = require('crypto');
      const token = crypto.randomBytes(24).toString('hex');
      const id = uuidv4();
      let expires_at = null;
      if (expiresInHours && expiresInHours > 0) expires_at = new Date(Date.now() + expiresInHours * 3600 * 1000);
      await query('INSERT INTO share_links (id, video_id, token, expires_at) VALUES (?, ?, ?, ?)', [id, videoId, token, expires_at]);
      return { id, token, video_id: videoId, expires_at, view_count: 0 };
    },
    transcribe: async (_, { videoId }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      const v = await videoService.getVideoById(videoId);
      if (!v || v.user_id !== user.id) throw new Error('Not found');
      const root = process.env.UPLOAD_PATH || './uploads';
      const { extractAudio, ensureDir, deleteFile } = require('../services/fileService');
      const tempDir = path.join(root, 'temp');
      await ensureDir(tempDir);
      const audioPath = path.join(tempDir, `${v.id}.mp3`);
      await extractAudio(path.join(root, v.video_path), audioPath);
      const text = await aiService.transcribeAudio(audioPath);
      const transcriptId = uuidv4();
      await query('INSERT INTO transcripts (id, video_id, original_transcript, language) VALUES (?, ?, ?, ?)', [transcriptId, v.id, text, 'en']);
      await videoService.updateVideoStatus(v.id, 'processing');
      await deleteFile(audioPath);
      const rows = await query('SELECT * FROM transcripts WHERE id = ?', [transcriptId]);
      return rows[0];
    },
    improveScript: async (_, { videoId }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      const rows = await query('SELECT * FROM transcripts WHERE video_id = ? ORDER BY created_at DESC LIMIT 1', [videoId]);
      const tr = rows[0];
      if (!tr) throw new Error('Transcript not found');
      const improved = await aiService.improveScript(tr.original_transcript);
      await query('UPDATE transcripts SET improved_script = ? WHERE id = ?', [improved, tr.id]);
      const updated = await query('SELECT * FROM transcripts WHERE id = ?', [tr.id]);
      return updated[0];
    },
    generateVoice: async (_, { videoId, voice }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      const rows = await query('SELECT * FROM transcripts WHERE video_id = ? ORDER BY created_at DESC LIMIT 1', [videoId]);
      const tr = rows[0];
      if (!tr) throw new Error('Transcript not found');
      const scriptText = tr.improved_script || tr.original_transcript;
      const buffer = await aiService.generateVoiceover(scriptText, voice || 'alloy');
      const fs = require('fs/promises');
      const root = process.env.UPLOAD_PATH || './uploads';
      const audioDir = path.join(root, 'audio');
      await ensureDir(audioDir);
      const audioRel = path.join('audio', `${videoId}.mp3`);
      await fs.writeFile(path.join(root, audioRel), buffer);
      const id = uuidv4();
      await query('INSERT INTO voiceovers (id, video_id, audio_path, voice_type, script_text) VALUES (?, ?, ?, ?, ?)', [id, videoId, audioRel, voice || 'alloy', scriptText]);
      const vo = await query('SELECT * FROM voiceovers WHERE id = ?', [id]);
      return vo[0];
    },
    generateDocs: async (_, { videoId }, { user }) => {
      if (!user) throw new Error('Unauthorized');
      const rows = await query('SELECT * FROM transcripts WHERE video_id = ? ORDER BY created_at DESC LIMIT 1', [videoId]);
      const tr = rows[0];
      if (!tr) throw new Error('Transcript not found');
      const md = await aiService.generateDocumentation(tr.original_transcript);
      const id = uuidv4();
      await query('INSERT INTO documentation (id, video_id, content, format) VALUES (?, ?, ?, ?)', [id, videoId, md, 'markdown']);
      const doc = await query('SELECT * FROM documentation WHERE id = ?', [id]);
      return doc[0];
    },
  },
};

module.exports = resolvers;
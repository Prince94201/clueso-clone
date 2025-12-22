// Handle creating share links and resolving them

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { query } = require('../config/db');
const videoService = require('../services/videoService');

// POST /api/videos/:id/share
exports.createShareLink = async (req, res, next) => {
  try {
    const video = await videoService.getVideoById(req.params.id);
    if (!video || video.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });

    const token = crypto.randomBytes(24).toString('hex');
    const id = uuidv4();
    let expires_at = null;
    if (req.body.expiresInHours) {
      const hours = Number(req.body.expiresInHours);
      if (hours > 0) {
        expires_at = new Date(Date.now() + hours * 3600 * 1000);
      }
    }
    await query('INSERT INTO share_links (id, video_id, token, expires_at) VALUES (?, ?, ?, ?)', [id, req.params.id, token, expires_at]);
    res.status(201).json({ id, token, video_id: req.params.id, expires_at });
  } catch (err) { next(err); }
};

// GET /api/share/:token
exports.resolveShareToken = async (req, res, next) => {
  try {
    const rows = await query('SELECT * FROM share_links WHERE token = ?', [req.params.token]);
    const link = rows[0];
    if (!link) return res.status(404).json({ error: 'Invalid token' });
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Link expired' });
    }
    await query('UPDATE share_links SET view_count = view_count + 1 WHERE id = ?', [link.id]);
    const video = await videoService.getVideoById(link.video_id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    // Do not require auth and do not expose user_id
    delete video.user_id;
    res.json({ link: { id: link.id, token: link.token, expires_at: link.expires_at, view_count: link.view_count + 1 }, video });
  } catch (err) { next(err); }
};
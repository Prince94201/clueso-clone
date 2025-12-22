// Use parameterized queries for all operations
// Functions:
//   - createVideo(data)
//   - getVideoById(id)
//   - getUserVideos(userId, page, limit, filters)
//   - updateVideo(id, updates)
//   - deleteVideo(id)
//   - updateVideoStatus(id, status)
// All functions return promises
// Handle SQL errors appropriately

const { query } = require('../config/db');
const path = require('path');

function mapVideoRow(row) {
  if (!row) return row;
  const filepath = row.video_path ? `/uploads/${row.video_path}` : undefined;
  const thumbnail = row.thumbnail_path ? `/uploads/${row.thumbnail_path}` : undefined;
  return { ...row, filepath, thumbnail };
}

function mapVoiceoverRow(row) {
  if (!row) return row;
  const filepath = row.filepath || (row.audio_path ? `/uploads/${row.audio_path}` : undefined);
  return { ...row, filepath };
}

async function createVideo(data) {
  const sql = `INSERT INTO videos (id, user_id, title, description, video_path, thumbnail_path, duration, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  await query(sql, [data.id, data.user_id, data.title, data.description, data.video_path, data.thumbnail_path, data.duration, data.status]);
  return getVideoById(data.id);
}

async function getVideoById(id) {
  const videos = await query('SELECT * FROM videos WHERE id = ?', [id]);
  const video = mapVideoRow(videos[0]);
  if (!video) return null;
  const transcripts = await query('SELECT * FROM transcripts WHERE video_id = ?', [id]);
  const voiceovers = await query('SELECT * FROM voiceovers WHERE video_id = ?', [id]);
  const docs = await query('SELECT * FROM documentation WHERE video_id = ?', [id]);
  return { ...video, transcript: transcripts[0] || null, voiceover: mapVoiceoverRow(voiceovers[0]) || null, documentation: docs[0] || null };
}

async function getUserVideos(userId, page = 1, limit = 10, filters = {}) {
  const safePage = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Number(limit)) : 10;
  const offset = (safePage - 1) * safeLimit;

  const where = ['user_id = ?'];
  const params = [userId];
  if (filters.status) { where.push('status = ?'); params.push(filters.status); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRows = await query(`SELECT COUNT(*) as cnt FROM videos ${whereSql}`, params);
  const total = totalRows[0]?.cnt || 0;

  // MySQL can error on binding LIMIT/OFFSET; inject validated integers instead
  const videosSql = `SELECT * FROM videos ${whereSql} ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${offset}`;
  const rows = await query(videosSql, params);
  const videos = rows.map(mapVideoRow);

  return { videos, total, page: safePage, pages: Math.ceil(total / safeLimit) };
}

async function updateVideo(id, updates = {}) {
  const fields = [];
  const params = [];
  for (const [k, v] of Object.entries(updates)) {
    fields.push(`${k} = ?`);
    params.push(v);
  }
  if (!fields.length) return getVideoById(id);
  params.push(id);
  await query(`UPDATE videos SET ${fields.join(', ')} WHERE id = ?`, params);
  return getVideoById(id);
}

async function deleteVideo(id) {
  await query('DELETE FROM videos WHERE id = ?', [id]);
}

async function updateVideoStatus(id, status) {
  await query('UPDATE videos SET status = ? WHERE id = ?', [status, id]);
  return getVideoById(id);
}

module.exports = { createVideo, getVideoById, getUserVideos, updateVideo, deleteVideo, updateVideoStatus };
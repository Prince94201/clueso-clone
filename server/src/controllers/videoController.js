// Video CRUD operations per requirements

const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { generateThumbnail, getVideoDuration, deleteFile, ensureDir } = require('../services/fileService');
const videoService = require('../services/videoService');

// UPLOAD
exports.upload = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const userId = req.user.id;
    const videoId = uuidv4();

    const videoPath = path.relative(process.env.UPLOAD_PATH || './uploads', req.file.path);
    const thumbDir = path.join(process.env.UPLOAD_PATH || './uploads', 'thumbnails', userId);
    await ensureDir(thumbDir);
    const thumbnailAbs = path.join(thumbDir, `${path.parse(req.file.filename).name}.jpg`);
    const duration = await getVideoDuration(req.file.path);
    await generateThumbnail(req.file.path, thumbnailAbs);
    const thumbnailPath = path.relative(process.env.UPLOAD_PATH || './uploads', thumbnailAbs);

    const video = await videoService.createVideo({
      id: videoId,
      user_id: userId,
      title: req.body.title || null,
      description: req.body.description || null,
      video_path: videoPath,
      thumbnail_path: thumbnailPath,
      duration,
      status: 'uploaded',
    });

    res.status(201).json(video);
  } catch (err) {
    next(err);
  }
};

// LIST
exports.list = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const status = req.query.status || null;
    const result = await videoService.getUserVideos(req.user.id, page, limit, { status });
    const { videos, total, page: currentPage, pages } = result;
    res.json({ videos, total, page: currentPage, totalPages: pages });
  } catch (err) { next(err); }
};

// GET
exports.get = async (req, res, next) => {
  try {
    const video = await videoService.getVideoById(req.params.id);
    if (!video || video.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
    res.json(video);
  } catch (err) { next(err); }
};

// UPDATE
exports.update = async (req, res, next) => {
  try {
    const current = await videoService.getVideoById(req.params.id);
    if (!current || current.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
    const updated = await videoService.updateVideo(req.params.id, {
      title: req.body.title ?? current.title,
      description: req.body.description ?? current.description,
    });
    res.json(updated);
  } catch (err) { next(err); }
};

// DELETE
exports.remove = async (req, res, next) => {
  try {
    const video = await videoService.getVideoById(req.params.id);
    if (!video || video.user_id !== req.user.id) return res.status(404).json({ error: 'Not found' });

    const root = process.env.UPLOAD_PATH || './uploads';
    await deleteFile(path.join(root, video.video_path));
    await deleteFile(path.join(root, video.thumbnail_path));
    // delete associated audio files if present via service returns
    await videoService.deleteVideo(req.params.id);

    res.json({ success: true });
  } catch (err) { next(err); }
};
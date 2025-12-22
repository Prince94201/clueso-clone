// Configure multer with diskStorage:
//   - destination: uploads/videos/{userId}/
//   - filename: {uuid}.mp4
// File filter: accept only video/mp4, video/webm, video/quicktime
// File size limit: 500MB (from env)
// Create directory if it doesn't exist
// Export single('video') uploader

const multer = require('multer');
const path = require('path');
const { ensureDir } = require('../services/fileService');
const { v4: uuidv4 } = require('uuid');

const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 524288000); // 500MB
const UPLOAD_ROOT = process.env.UPLOAD_PATH || './uploads';

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const userId = req.user?.id || 'anonymous';
      const dir = path.join(UPLOAD_ROOT, 'videos', userId);
      await ensureDir(dir);
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (req, file, cb) => {
    const id = uuidv4();
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${id}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['video/mp4', 'video/webm', 'video/quicktime'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Invalid file type'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

module.exports = upload.single('video');
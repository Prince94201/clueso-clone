// Use fs/promises for async file operations
// generateThumbnail(videoPath, outputPath): use fluent-ffmpeg to extract frame at 1s
// extractAudio(videoPath, outputPath): extract to MP3
// getVideoDuration(videoPath): ffprobe
// deleteFile(filePath): safe unlink
// ensureDir(dirPath): mkdir -p

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
  return dirPath;
}

async function deleteFile(filePath) {
  try {
    if (!filePath) return false;
    await fs.access(filePath);
    await fs.unlink(filePath);
    return true;
  } catch (err) {
    return false;
  }
}

function generateThumbnail(videoPath, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDir(path.dirname(outputPath));
      ffmpeg(videoPath)
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .screenshots({
          timestamps: ['1'],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: '320x?' // small jpg
        });
    } catch (e) { reject(e); }
  });
}

function extractAudio(videoPath, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDir(path.dirname(outputPath));
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .format('mp3')
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .save(outputPath);
    } catch (e) { reject(e); }
  });
}

function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, data) => {
      if (err) return reject(err);
      const duration = Math.round(data.format.duration || 0);
      resolve(duration);
    });
  });
}

function hasAudioTrack(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, data) => {
      if (err) return reject(err);
      const streams = Array.isArray(data?.streams) ? data.streams : [];
      const audioStreams = streams.filter((s) => s?.codec_type === 'audio');
      resolve(audioStreams.length > 0);
    });
  });
}

function extractFrames(videoPath, outDir, frameCount = 6) {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDir(outDir);

      // Get duration, then spread timestamps across the video
      const duration = await getVideoDuration(videoPath).catch(() => 0);
      const safeDuration = Math.max(1, Number(duration) || 1);
      const count = Math.max(1, Math.min(12, Number(frameCount) || 6));

      const timestamps = [];
      for (let i = 0; i < count; i++) {
        const t = Math.round(((i + 1) / (count + 1)) * safeDuration);
        timestamps.push(String(Math.max(0, t)));
      }

      ffmpeg(videoPath)
        .on('end', async () => {
          try {
            const files = await fs.readdir(outDir);
            const frames = files
              .filter((f) => /^frame-\d+\.jpg$/i.test(f))
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
              .map((f) => path.join(outDir, f));
            resolve(frames);
          } catch (e) {
            reject(e);
          }
        })
        .on('error', reject)
        .screenshots({
          timestamps,
          filename: 'frame-%02d.jpg',
          folder: outDir,
          size: '1280x?'
        });
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  ensureDir,
  deleteFile,
  generateThumbnail,
  extractAudio,
  getVideoDuration,
  hasAudioTrack,
  extractFrames
};
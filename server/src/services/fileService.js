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
      // Handle "N/A" or missing duration by defaulting to 0
      const val = data?.format?.duration;
      const duration = (typeof val === 'number' || (typeof val === 'string' && !isNaN(val)))
        ? Math.round(Number(val))
        : 0;
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

function extractFrames(videoPath, outDir, strategy = 6) {
  return new Promise(async (resolve, reject) => {
    try {
      await ensureDir(outDir);
      console.log(`[FFMPEG] Extracting frames from: ${videoPath} to ${outDir}`);

      // Get duration, then spread timestamps across the video
      const duration = await getVideoDuration(videoPath).catch((e) => {
        console.error('[FFMPEG] Duration check failed:', e);
        return 0;
      });
      console.log(`[FFMPEG] Video duration (safe): ${duration}`);

      // If duration is 0, default to 10s fallback
      const safeDuration = duration > 0 ? duration : 10;

      let count = 6;
      let usedInterval = false;
      let intervalValue = 0;

      if (typeof strategy === 'object' && strategy.interval) {
        // Interval mode (e.g. 0.08s)
        count = Math.ceil(safeDuration / strategy.interval);
        usedInterval = true;
        intervalValue = strategy.interval;
        console.log(`[FFMPEG] Strategy: Interval ${intervalValue}s -> ${count} total frames`);
      } else {
        // Count mode - REMOVED upper limit of 12
        count = Math.max(1, Number(strategy) || 6);
        console.log(`[FFMPEG] Strategy: Fixed Count ${count}`);
      }

      const timestamps = [];
      if (usedInterval) {
        for (let i = 1; i <= count; i++) {
          const t = i * intervalValue;
          // Ensure we don't exceed duration significantly, but ffmpeg handles it anyway.
          if (t <= safeDuration + 0.1) {
            timestamps.push(t.toFixed(3));
          }
        }
      } else {
        const step = safeDuration / count;
        for (let i = 1; i <= count; i++) {
          const t = i * step;
          timestamps.push(t.toFixed(2));
        }
      }

      // Limit logging if too many
      const logTs = timestamps.length > 20 ? timestamps.slice(0, 20).join(', ') + '...' : timestamps.join(', ');
      console.log(`[FFMPEG] Target timestamps (${timestamps.length}): ${logTs}`);

      ffmpeg(videoPath)
        .on('end', async () => {
          try {
            const files = await fs.readdir(outDir);
            // console.log(`[FFMPEG] Files in outDir: ${files.join(', ')}`); // Too verbose for 300 files
            console.log(`[FFMPEG] Extracted file count: ${files.length}`);
            const frames = files
              .filter((f) => /^frame-\d+(?:_\d+)?\.jpg$/i.test(f))
              .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
              .map((f) => path.join(outDir, f));
            resolve(frames);
          } catch (e) {
            console.error('[FFMPEG] Error reading outDir:', e);
            reject(e);
          }
        })
        .on('error', (err) => {
          console.error('[FFMPEG] Extraction error:', err);
          reject(err);
        })
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
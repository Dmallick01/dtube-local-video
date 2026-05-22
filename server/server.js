const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const crypto = require('crypto');

// Set ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Helper to check if file is a video
const isVideo = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv'].includes(ext);
};

// Ensure directories exist
const THUMB_DIR = path.join(__dirname, 'thumbnails');
const PREVIEW_DIR = path.join(__dirname, 'previews');
if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR);
if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR);

// Helper to get video duration
const getDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return resolve(0); // fallback if probe fails
      resolve(metadata.format.duration || 0);
    });
  });
};

// 1. Scan directory recursively
const scanDir = (dir, depth = 0, maxDepth = 2) => {
  let results = [];
  if (depth > maxDepth) return results;

  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.startsWith('.') || file === 'node_modules') continue;
      
      const fullPath = path.join(dir, file);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          results = results.concat(scanDir(fullPath, depth + 1, maxDepth));
        } else if (isVideo(file)) {
          results.push({
            id: crypto.createHash('md5').update(fullPath).digest('hex'),
            name: file,
            path: fullPath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          });
        }
      } catch (e) {
        // Skip inaccessible files
      }
    }
  } catch (e) {
    // Skip inaccessible dirs
  }
  return results;
};

app.post('/api/scan', (req, res) => {
  const { directory } = req.body;
  if (!directory || !fs.existsSync(directory)) {
    return res.status(400).json({ error: 'Valid directory path required.' });
  }

  try {
    const videoFiles = scanDir(directory, 0, 2);
    res.json({ videos: videoFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Serve / Generate 10% Thumbnail (Fast Seek)
app.get('/api/thumbnail', async (req, res) => {
  const videoPath = req.query.videoPath;
  if (!videoPath || !fs.existsSync(videoPath)) {
    return res.status(404).send('Video not found');
  }

  const hash = crypto.createHash('md5').update(videoPath).digest('hex');
  const thumbPath = path.join(THUMB_DIR, `${hash}.png`);

  if (fs.existsSync(thumbPath)) {
    return res.sendFile(thumbPath);
  }

  try {
    const duration = await getDuration(videoPath);
    const targetTime = duration * 0.1; // 10% mark

    ffmpeg(videoPath)
      .seekInput(targetTime) // fast seek before decoding
      .frames(1)
      .size('320x?')
      .on('end', () => res.sendFile(thumbPath))
      .on('error', (err) => {
        console.error('Thumbnail generation error:', err.message);
        res.status(500).send('Thumbnail error');
      })
      .save(thumbPath);
  } catch (error) {
    res.status(500).send('Error');
  }
});

// 3. Serve / Generate 10% Preview Snippet
app.get('/api/preview', async (req, res) => {
  const videoPath = req.query.videoPath;
  if (!videoPath || !fs.existsSync(videoPath)) {
    return res.status(404).send('Video not found');
  }

  const hash = crypto.createHash('md5').update(videoPath).digest('hex');
  const previewPath = path.join(PREVIEW_DIR, `${hash}.mp4`);

  if (fs.existsSync(previewPath)) {
    return res.sendFile(previewPath);
  }

  try {
    const duration = await getDuration(videoPath);
    const targetTime = duration * 0.1;

    // Generate a 3-second ultrafast silent mp4
    ffmpeg(videoPath)
      .seekInput(targetTime)
      .duration(3)
      .noAudio()
      .size('320x?')
      .videoCodec('libx264')
      .outputOptions(['-preset ultrafast', '-pix_fmt yuv420p', '-movflags faststart'])
      .on('end', () => res.sendFile(previewPath))
      .on('error', (err) => {
        console.error('Preview generation error:', err.message);
        res.status(500).send('Preview error');
      })
      .save(previewPath);
  } catch (error) {
    res.status(500).send('Error');
  }
});

// 4. Stream Raw Video (for the Player)
app.get('/api/stream', (req, res) => {
  const videoPath = req.query.videoPath;
  if (!videoPath || !fs.existsSync(videoPath)) {
    return res.status(404).send('Video not found');
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(videoPath).toLowerCase();
  let mimeType = 'video/mp4';
  if (ext === '.webm') mimeType = 'video/webm';
  if (ext === '.ogg') mimeType = 'video/ogg';

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': mimeType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

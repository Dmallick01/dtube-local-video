import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const MAX_WIDTH = 320;
const MAX_FRAMES = 12;
const MAX_SPAN_SEC = 4;
const FRAME_TIMEOUT_MS = 12000;

function scaleSize(w, h, maxW) {
  if (w <= maxW) return { width: w, height: h };
  const scale = maxW / w;
  return { width: maxW, height: Math.round(h * scale) };
}

function captureRgba(video, canvas, ctx, outW, outH) {
  canvas.width = outW;
  canvas.height = outH;
  ctx.drawImage(video, 0, 0, outW, outH);
  const { data } = ctx.getImageData(0, 0, outW, outH);
  return new Uint8Array(data);
}

function seekTo(video, timeSec) {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = timeSec;
  });
}

function loadVideoMetadata(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({ video: null, url: null, duration: 0 });
    }, FRAME_TIMEOUT_MS);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      resolve({ video, url, duration: video.duration || 0 });
    };
    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve({ video: null, url: null, duration: 0 });
    };
  });
}

/**
 * Sample frames between startSec–endSec and encode a looping GIF (processed offline).
 */
export async function generatePreviewGif(file, startSec, endSec, { maxFrames = MAX_FRAMES } = {}) {
  const { video, url, duration } = await loadVideoMetadata(file);
  if (!video || !duration || endSec <= startSec) {
    if (url) URL.revokeObjectURL(url);
    return null;
  }

  const span = Math.min(endSec - startSec, MAX_SPAN_SEC);
  const end = startSec + span;
  const frameCount = Math.max(4, Math.min(maxFrames, Math.ceil(span * 3)));
  const delayCs = Math.max(4, Math.round((span / frameCount) * 100));

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 360;
  const { width: outW, height: outH } = scaleSize(vw, vh, MAX_WIDTH);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const frames = [];
  try {
    for (let i = 0; i < frameCount; i++) {
      const t = startSec + (span * i) / Math.max(1, frameCount - 1);
      await seekTo(video, Math.min(t, duration - 0.05));
      const rgba = captureRgba(video, canvas, ctx, outW, outH);
      frames.push({ width: outW, height: outH, rgba });
    }
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }

  if (frames.length < 2) return null;

  const gif = GIFEncoder();
  for (const frame of frames) {
    const palette = quantize(frame.rgba, 256);
    const index = applyPalette(frame.rgba, palette);
    gif.writeFrame(index, frame.width, frame.height, {
      palette,
      delay: delayCs,
      repeat: 0,
    });
  }
  gif.finish();

  return new Blob([gif.bytes()], { type: 'image/gif' });
}

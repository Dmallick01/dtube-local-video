import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const MAX_WIDTH = 320;
const MAX_FRAMES = 10;
const MAX_SPAN_SEC = 3;
const FRAME_TIMEOUT_MS = 20000;

function scaleSize(w, h, maxW) {
  const vw = w || 640;
  const vh = h || 360;
  if (vw <= maxW) return { width: vw, height: vh };
  const scale = maxW / vw;
  return { width: maxW, height: Math.max(1, Math.round(vh * scale)) };
}

function waitForData(video) {
  return new Promise((resolve) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    video.addEventListener('loadeddata', () => resolve(), { once: true });
    video.addEventListener('error', () => resolve(), { once: true });
  });
}

function captureRgba(video, canvas, ctx, outW, outH) {
  if (!video.videoWidth || !video.videoHeight) return null;
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
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = timeSec;
  });
}

function loadVideoForFrames(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({ video: null, url: null, duration: 0 });
    }, FRAME_TIMEOUT_MS);

    video.onloadedmetadata = async () => {
      clearTimeout(timeout);
      await waitForData(video);
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
 * Sample up to 3s between startSec–endSec; encode looping GIF for hover (no audio).
 */
export async function generatePreviewGif(file, startSec, endSec, { maxFrames = MAX_FRAMES } = {}) {
  const { video, url, duration } = await loadVideoForFrames(file);
  if (!video || !duration || endSec <= startSec) {
    if (url) URL.revokeObjectURL(url);
    return null;
  }

  const span = Math.min(endSec - startSec, MAX_SPAN_SEC);
  const frameCount = Math.max(6, Math.min(maxFrames, Math.round(span * 4)));
  const delayCs = Math.max(3, Math.round((span / frameCount) * 100));

  const { width: outW, height: outH } = scaleSize(video.videoWidth, video.videoHeight, MAX_WIDTH);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const frames = [];
  try {
    for (let i = 0; i < frameCount; i++) {
      const t = startSec + (span * i) / Math.max(1, frameCount - 1);
      await seekTo(video, Math.min(Math.max(0, t), duration - 0.05));
      const rgba = captureRgba(video, canvas, ctx, outW, outH);
      if (rgba?.length) frames.push({ width: outW, height: outH, rgba });
    }
  } catch (err) {
    console.warn('GIF frame capture failed', file.name, err);
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }

  if (frames.length < 2) return null;

  try {
    const gif = GIFEncoder();
    for (const frame of frames) {
      const palette = quantize(frame.rgba, 256);
      const index = applyPalette(frame.rgba, palette);
      gif.writeFrame(index, frame.width, frame.height, {
        palette,
        delay: delayCs,
      });
    }
    gif.finish();
    const bytes = gif.bytes();
    return new Blob([bytes], { type: 'image/gif' });
  } catch (err) {
    console.warn('GIF encode failed', file.name, err);
    return null;
  }
}

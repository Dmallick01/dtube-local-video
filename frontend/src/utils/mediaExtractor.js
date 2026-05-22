import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { previewGifRange } from './mediaProbe';

const GIF_MAX_W = 240;
const GIF_FRAMES = 5;
const GIF_MAX_SEC = 3;
const LOAD_TIMEOUT_MS = 15000;

function scaleSize(w, h, maxW) {
  const vw = w || 640;
  const vh = h || 360;
  if (vw <= maxW) return { width: vw, height: vh };
  const scale = maxW / vw;
  return { width: maxW, height: Math.max(1, Math.round(vh * scale)) };
}

function waitForData(video) {
  return new Promise((resolve) => {
    if (video.readyState >= 2) return resolve();
    video.addEventListener('loadeddata', () => resolve(), { once: true });
    video.addEventListener('error', () => resolve(), { once: true });
  });
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

function loadVideo(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(null);
    }, LOAD_TIMEOUT_MS);

    video.onloadedmetadata = async () => {
      clearTimeout(timeout);
      await waitForData(video);
      resolve({ video, url, duration: video.duration || 0 });
    };
    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}

function captureJpeg(video, canvas, ctx, outW, outH) {
  if (!video.videoWidth) return null;
  canvas.width = outW;
  canvas.height = outH;
  ctx.drawImage(video, 0, 0, outW, outH);
  try {
    return canvas.toDataURL('image/jpeg', 0.55);
  } catch {
    return null;
  }
}

function captureRgba(video, canvas, ctx, outW, outH) {
  if (!video.videoWidth) return null;
  canvas.width = outW;
  canvas.height = outH;
  ctx.drawImage(video, 0, 0, outW, outH);
  const { data } = ctx.getImageData(0, 0, outW, outH);
  return new Uint8Array(data);
}

function encodeGif(frames, delayCs) {
  if (frames.length < 2) return null;
  const gif = GIFEncoder();
  for (const frame of frames) {
    const palette = quantize(frame.rgba, 128, { format: 'rgb565' });
    const index = applyPalette(frame.rgba, palette, 'rgb565');
    gif.writeFrame(index, frame.width, frame.height, { palette, delay: delayCs });
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

/**
 * One video decode per file: metadata + optional thumbnail + optional GIF.
 */
export async function extractFileMedia(
  file,
  {
    previewStartPct = 15,
    previewEndPct = 25,
    needThumb = true,
    needGif = true,
  } = {},
) {
  const loaded = await loadVideo(file);
  if (!loaded?.video) {
    return {
      duration: 0,
      previewStart: 0,
      previewEnd: 0,
      thumbnail: null,
      previewGifBlob: null,
    };
  }

  const { video, url, duration } = loaded;
  const previewStart = duration ? (duration * previewStartPct) / 100 : 0;
  const previewEnd = duration ? Math.max(previewStart + 0.1, (duration * previewEndPct) / 100) : 0;
  const gifRange = previewGifRange(previewStart, previewEnd, GIF_MAX_SEC);

  const { width: outW, height: outH } = scaleSize(video.videoWidth, video.videoHeight, GIF_MAX_W);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let thumbnail = null;
  let previewGifBlob = null;

  try {
    if (needThumb && duration > 0) {
      const tThumb = (duration * previewStartPct) / 100;
      await seekTo(video, Math.min(tThumb, duration - 0.05));
      thumbnail = captureJpeg(video, canvas, ctx, outW, outH);
    }

    if (needGif && gifRange.end > gifRange.start) {
      const span = gifRange.end - gifRange.start;
      const frameCount = GIF_FRAMES;
      const delayCs = Math.max(4, Math.round((span / frameCount) * 100));
      const frames = [];

      for (let i = 0; i < frameCount; i++) {
        const t = gifRange.start + (span * i) / Math.max(1, frameCount - 1);
        await seekTo(video, Math.min(t, duration - 0.05));
        const rgba = captureRgba(video, canvas, ctx, outW, outH);
        if (rgba?.length) frames.push({ width: outW, height: outH, rgba });
      }

      previewGifBlob = encodeGif(frames, delayCs);
    }
  } finally {
    URL.revokeObjectURL(url);
  }

  return {
    duration,
    previewStart: gifRange.start,
    previewEnd: gifRange.end,
    previewStartPct,
    previewEndPct,
    thumbnail,
    previewGifBlob,
  };
}

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { previewGifRange } from './mediaProbe';

const GIF_MAX_W = 240;
const GIF_FRAMES = 5;
const GIF_MAX_SEC = 3;
const LOAD_TIMEOUT_MS = 8000;
const SEEK_TIMEOUT_MS = 3500;
const EXTRACT_TIMEOUT_MS = 12000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

function scaleSize(w, h, maxW) {
  const vw = w || 640;
  const vh = h || 360;
  if (vw <= maxW) return { width: vw, height: vh };
  const scale = maxW / vw;
  return { width: maxW, height: Math.max(1, Math.round(vh * scale)) };
}

function waitForData(video, ms = 5000) {
  return withTimeout(
    new Promise((resolve) => {
      if (video.readyState >= 2) return resolve(true);
      video.addEventListener('loadeddata', () => resolve(true), { once: true });
      video.addEventListener('error', () => resolve(false), { once: true });
    }),
    ms,
  );
}

function seekTo(video, timeSec) {
  return withTimeout(
    new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      const onSeeked = () => finish();
      video.addEventListener('seeked', onSeeked);
      try {
        const t = Math.max(0, timeSec);
        if (Math.abs(video.currentTime - t) < 0.02) finish();
        else video.currentTime = t;
      } catch {
        finish();
      }
    }),
    SEEK_TIMEOUT_MS,
  );
}

function loadVideo(file) {
  return withTimeout(
    new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      const url = URL.createObjectURL(file);
      video.src = url;

      const fail = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      video.onloadedmetadata = async () => {
        await waitForData(video, 4000);
        if (!video.duration || !Number.isFinite(video.duration)) {
          fail();
          return;
        }
        resolve({ video, url, duration: video.duration });
      };
      video.onerror = fail;
    }),
    LOAD_TIMEOUT_MS,
  );
}

function captureJpeg(video, canvas, ctx, outW, outH) {
  if (!video.videoWidth) return null;
  canvas.width = outW;
  canvas.height = outH;
  ctx.drawImage(video, 0, 0, outW, outH);
  try {
    return canvas.toDataURL('image/jpeg', 0.5);
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
  try {
    const gif = GIFEncoder();
    for (const frame of frames) {
      const palette = quantize(frame.rgba, 96, { format: 'rgb565' });
      const index = applyPalette(frame.rgba, palette, 'rgb565');
      gif.writeFrame(index, frame.width, frame.height, { palette, delay: delayCs });
    }
    gif.finish();
    return new Blob([gif.bytes()], { type: 'image/gif' });
  } catch {
    return null;
  }
}

const EMPTY = {
  duration: 0,
  previewStart: 0,
  previewEnd: 0,
  thumbnail: null,
  previewGifBlob: null,
};

async function extractFileMediaInner(
  file,
  { previewStartPct = 15, previewEndPct = 25, needThumb = true, needGif = true },
) {
  const loaded = await loadVideo(file);
  if (!loaded?.video) return { ...EMPTY };

  const { video, url, duration } = loaded;
  const previewStart = (duration * previewStartPct) / 100;
  const previewEnd = Math.max(previewStart + 0.1, (duration * previewEndPct) / 100);
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
      const delayCs = Math.max(4, Math.round((span / GIF_FRAMES) * 100));
      const frames = [];

      for (let i = 0; i < GIF_FRAMES; i++) {
        const t = gifRange.start + (span * i) / Math.max(1, GIF_FRAMES - 1);
        await seekTo(video, Math.min(t, duration - 0.05));
        const rgba = captureRgba(video, canvas, ctx, outW, outH);
        if (rgba?.length) frames.push({ width: outW, height: outH, rgba });
      }

      previewGifBlob = encodeGif(frames, delayCs);
    }
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
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

/** One decode per call; always resolves (never hangs). */
export async function extractFileMedia(file, options = {}) {
  const result = await withTimeout(extractFileMediaInner(file, options), EXTRACT_TIMEOUT_MS);
  return result || { ...EMPTY };
}

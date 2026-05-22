import { generateThumbnailAtTime } from './thumbnailGenerator';

const VIDEO_EXT_PLAYABLE = ['mp4', 'webm', 'mov', 'm4v'];

export function isBrowserPlayable(name) {
  const ext = name.split('.').pop().toLowerCase();
  return VIDEO_EXT_PLAYABLE.includes(ext);
}

/** Load metadata + thumbnail + hover preview window (default 15%–25% of timeline). */
export function probeVideo(file, { previewStartPct = 15, previewEndPct = 25, thumbPct = 15 } = {}) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({
        duration: 0,
        previewStart: 0,
        previewEnd: 0,
        thumbnail: null,
        previewPlayable: isBrowserPlayable(file.name),
      });
    }, 8000);

    const finish = async (duration) => {
      clearTimeout(timeout);
      const d = duration && Number.isFinite(duration) ? duration : 0;
      const start = d ? (d * previewStartPct) / 100 : 0;
      const end = d ? Math.max(start + 0.5, (d * previewEndPct) / 100) : 0;
      let thumbnail = null;
      if (d > 0) {
        const tThumb = (d * thumbPct) / 100;
        thumbnail = await generateThumbnailAtTime(file, tThumb).catch(() => null);
      }
      URL.revokeObjectURL(url);
      resolve({
        duration: d,
        previewStart: start,
        previewEnd: end,
        thumbnail,
        previewPlayable: isBrowserPlayable(file.name),
      });
    };

    video.onloadedmetadata = () => finish(video.duration);
    video.onerror = () => finish(0);
  });
}

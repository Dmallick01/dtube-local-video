/** Quick metadata + 15–25% window (GIF clip capped at 3s elsewhere). */
export function probeMetadata(file, { previewStartPct = 15, previewEndPct = 25 } = {}) {
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
        previewStartPct,
        previewEndPct,
      });
    }, 10000);

    const done = (duration) => {
      clearTimeout(timeout);
      const d = duration && Number.isFinite(duration) ? duration : 0;
      const start = d ? (d * previewStartPct) / 100 : 0;
      const regionEnd = d ? Math.max(start + 0.1, (d * previewEndPct) / 100) : 0;
      URL.revokeObjectURL(url);
      resolve({
        duration: d,
        previewStart: start,
        previewEnd: regionEnd,
        previewStartPct,
        previewEndPct,
      });
    };

    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done(0);
  });
}

/** End time for GIF: within 15–25% region, max 3 seconds long. */
export function previewGifRange(previewStart, previewEnd, maxSec = 3) {
  if (previewEnd <= previewStart) return { start: previewStart, end: previewStart };
  const end = Math.min(previewEnd, previewStart + maxSec);
  return { start: previewStart, end };
}

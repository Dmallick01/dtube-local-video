import { generateThumbnailAtTime } from './thumbnailGenerator';
import { generatePreviewGif } from './previewGifGenerator';

/** Load metadata, static thumbnail, and hover preview GIF for the timeline window. */
export async function probeVideo(
  file,
  { previewStartPct = 15, previewEndPct = 25, thumbPct = 15 } = {},
) {
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  const url = URL.createObjectURL(file);
  video.src = url;

  const meta = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve({ duration: 0, previewStart: 0, previewEnd: 0 });
    }, 10000);

    const done = (duration) => {
      clearTimeout(timeout);
      const d = duration && Number.isFinite(duration) ? duration : 0;
      const start = d ? (d * previewStartPct) / 100 : 0;
      const end = d ? Math.max(start + 0.5, (d * previewEndPct) / 100) : 0;
      URL.revokeObjectURL(url);
      resolve({ duration: d, previewStart: start, previewEnd: end });
    };

    video.onloadedmetadata = () => done(video.duration);
    video.onerror = () => done(0);
  });

  let thumbnail = null;
  let previewGifBlob = null;

  if (meta.duration > 0 && meta.previewEnd > meta.previewStart) {
    const tThumb = (meta.duration * thumbPct) / 100;
    thumbnail = await generateThumbnailAtTime(file, tThumb).catch(() => null);
    previewGifBlob = await generatePreviewGif(file, meta.previewStart, meta.previewEnd).catch(
      () => null,
    );
  }

  return {
    ...meta,
    previewStartPct,
    previewEndPct,
    thumbnail,
    previewGifBlob,
    hasPreviewGif: !!previewGifBlob,
  };
}

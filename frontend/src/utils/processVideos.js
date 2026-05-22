import { generateThumbnailAtTime } from './thumbnailGenerator';
import { probeMetadata, previewGifRange } from './mediaProbe';
import { generatePreviewGif } from './previewGifGenerator';
import {
  getCachedThumbnail,
  cacheThumbnail,
  getCachedPreviewMeta,
  cachePreviewMeta,
  getCachedPreviewGif,
  cachePreviewGif,
} from '../lib/storage';

export const PREVIEW_GIF_VERSION = 1;

function metaNeedsRefresh(meta, previewStartPct, previewEndPct) {
  if (!meta) return true;
  return (
    meta.previewGifVersion !== PREVIEW_GIF_VERSION ||
    meta.previewStartPct !== previewStartPct ||
    meta.previewEndPct !== previewEndPct ||
    !meta.hasPreviewGif
  );
}

function reportProgress(onProgress, phase, done, total) {
  if (!onProgress) return;
  const half = total / 2;
  if (phase === 'thumb') {
    onProgress(Math.round((done / total) * 50), done, total, 'thumb');
  } else {
    onProgress(50 + Math.round((done / total) * 50), done, total, 'gif');
  }
}

/** Phase 1: thumbnails + metadata. Phase 2: hover preview GIFs (≤3s, 15–25% slice). */
export async function processVideosBatch(
  files,
  { concurrency = 4, onProgress, previewStartPct = 15, previewEndPct = 25 } = {},
) {
  const total = files.length;
  const pending = files.map((file, i) => ({
    i,
    file,
    id: file.id ?? `${file.name}-${file.size}-${file.lastModified}`,
    relativePath: file.webkitRelativePath || file.name,
  }));

  const results = new Array(total);
  let thumbDone = 0;
  let gifDone = 0;

  // —— Phase 1: thumbnails ——
  let thumbIndex = 0;
  async function thumbWorker() {
    while (thumbIndex < pending.length) {
      const slot = thumbIndex++;
      const { file, id, relativePath, i } = pending[slot];

      let thumbnail = await getCachedThumbnail(id).catch(() => null);
      let meta = await getCachedPreviewMeta(id).catch(() => null);

      if (!meta || meta.previewStartPct !== previewStartPct || meta.previewEndPct !== previewEndPct) {
        meta = await probeMetadata(file, { previewStartPct, previewEndPct });
      }

      if (!thumbnail && meta.duration > 0) {
        const tThumb = (meta.duration * previewStartPct) / 100;
        thumbnail = await generateThumbnailAtTime(file, tThumb).catch(() => null);
        if (thumbnail) await cacheThumbnail(id, thumbnail).catch(() => {});
      }

      const gifRange = previewGifRange(meta.previewStart, meta.previewEnd, 3);
      const cachedGifUrl = await getCachedPreviewGif(id).catch(() => null);
      const needsGif =
        metaNeedsRefresh(meta, previewStartPct, previewEndPct) || !cachedGifUrl;

      results[i] = {
        id,
        name: file.name,
        relativePath,
        file,
        size: file.size,
        createdAt: file.lastModified,
        thumbnail,
        previewGifUrl: cachedGifUrl,
        duration: meta.duration ?? 0,
        previewStart: gifRange.start,
        previewEnd: gifRange.end,
        hasPreviewGif: !!cachedGifUrl,
        _meta: meta,
        _needsGif: needsGif,
      };

      thumbDone += 1;
      reportProgress(onProgress, 'thumb', thumbDone, total);
    }
  }

  const thumbWorkers = Array.from(
    { length: Math.min(concurrency, pending.length) },
    () => thumbWorker(),
  );
  await Promise.all(thumbWorkers);

  // —— Phase 2: preview GIFs ——
  const gifQueue = pending
    .map((p) => results[p.i])
    .filter((r) => r && r._needsGif);

  let gifIndex = 0;
  const gifConcurrency = Math.min(2, concurrency);

  async function gifWorker() {
    while (gifIndex < gifQueue.length) {
      const entry = gifQueue[gifIndex++];
      const { file, id } = entry;
      const meta = entry._meta;
      const gifRange = previewGifRange(meta.previewStart, meta.previewEnd, 3);

      let previewGifUrl = await getCachedPreviewGif(id).catch(() => null);
      let blob = null;

      if (!previewGifUrl && gifRange.end > gifRange.start) {
        blob = await generatePreviewGif(file, gifRange.start, gifRange.end).catch(() => null);
        if (blob) {
          await cachePreviewGif(id, blob).catch(() => {});
          previewGifUrl = URL.createObjectURL(blob);
        }
      }

      const storedMeta = {
        duration: meta.duration,
        previewStart: gifRange.start,
        previewEnd: gifRange.end,
        previewStartPct,
        previewEndPct,
        previewGifVersion: PREVIEW_GIF_VERSION,
        hasPreviewGif: !!(previewGifUrl || blob),
      };
      await cachePreviewMeta(id, storedMeta).catch(() => {});

      entry.previewGifUrl = previewGifUrl;
      entry.previewStart = gifRange.start;
      entry.previewEnd = gifRange.end;
      entry.hasPreviewGif = storedMeta.hasPreviewGif;
      delete entry._meta;
      delete entry._needsGif;

      gifDone += 1;
      reportProgress(onProgress, 'gif', gifDone, Math.max(gifQueue.length, 1));
    }
  }

  if (gifQueue.length) {
    const gifWorkers = Array.from({ length: Math.min(gifConcurrency, gifQueue.length) }, () =>
      gifWorker(),
    );
    await Promise.all(gifWorkers);
  } else {
    reportProgress(onProgress, 'gif', 1, 1);
  }

  // Items that skipped phase 2 still need cached GIF URLs
  for (const entry of results) {
    if (!entry) continue;
    if (!entry.previewGifUrl) {
      entry.previewGifUrl = await getCachedPreviewGif(entry.id).catch(() => null);
      entry.hasPreviewGif = !!entry.previewGifUrl;
    }
    delete entry._meta;
    delete entry._needsGif;
  }

  return results.filter(Boolean);
}

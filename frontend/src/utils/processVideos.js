import { previewGifRange } from './mediaProbe';
import { extractFileMedia } from './mediaExtractor';
import {
  getCachedThumbnail,
  cacheThumbnail,
  getCachedPreviewMeta,
  cachePreviewMeta,
  getCachedPreviewGif,
  cachePreviewGif,
} from '../lib/storage';

export const PREVIEW_GIF_VERSION = 2;
const EARLY_GALLERY_COUNT = 40;
const GALLERY_UPDATE_EVERY = 80;

function metaNeedsRefresh(meta, previewStartPct, previewEndPct) {
  if (!meta) return true;
  return (
    meta.previewGifVersion !== PREVIEW_GIF_VERSION ||
    meta.previewStartPct !== previewStartPct ||
    meta.previewEndPct !== previewEndPct ||
    !meta.hasPreviewGif
  );
}

export function defaultProcessConcurrency(fileCount = 100) {
  if (typeof navigator === 'undefined') return 2;
  const cores = navigator.hardwareConcurrency || 4;
  if (fileCount > 500) return 2;
  if (fileCount > 200) return Math.min(3, Math.max(2, Math.floor(cores / 2)));
  return Math.min(4, Math.max(2, Math.floor(cores / 2)));
}

async function runParallelPool(total, concurrency, onItemDone, worker, signal) {
  if (total <= 0) {
    onItemDone(0, 0);
    return;
  }
  let index = 0;
  let done = 0;

  async function poolWorker() {
    while (index < total) {
      if (signal?.aborted) return;
      const slot = index++;
      try {
        await worker(slot);
      } catch {
        /* worker handles errors */
      }
      done += 1;
      onItemDone(done, total);
    }
  }

  const n = Math.min(Math.max(1, concurrency), total);
  await Promise.all(Array.from({ length: n }, () => poolWorker()));
}

function buildEntry(item, data) {
  return {
    id: item.id,
    name: item.file.name,
    relativePath: item.relativePath,
    file: item.file,
    size: item.file.size,
    createdAt: item.file.lastModified,
    thumbnail: data.thumbnail,
    previewGifUrl: data.previewGifUrl,
    duration: data.duration ?? 0,
    previewStart: data.previewStart ?? 0,
    previewEnd: data.previewEnd ?? 0,
    hasPreviewGif: !!data.previewGifUrl,
  };
}

function snapshotResults(results) {
  return results.filter(Boolean);
}

/**
 * Opens gallery early; never blocks on all thumbnails. GIFs run after (skippable).
 */
export async function processVideosBatch(
  files,
  {
    concurrency,
    onProgress,
    onGalleryReady,
    onVideosSnapshot,
    onVideoUpdated,
    previewStartPct = 15,
    previewEndPct = 25,
    signal,
    skipGifs = false,
  } = {},
) {
  const total = files.length;
  const workers = concurrency ?? defaultProcessConcurrency(total);

  const items = files.map((file, i) => ({
    i,
    file,
    id: file.id ?? `${file.name}-${file.size}-${file.lastModified}`,
    relativePath: file.webkitRelativePath || file.name,
  }));

  const results = new Array(total);
  const plan = new Array(total);
  let galleryOpened = false;
  const updateEvery = total > 200 ? 25 : GALLERY_UPDATE_EVERY;

  const tryOpenGallery = (force = false) => {
    const snap = snapshotResults(results);
    const ready = snap.length;
    if (signal?.aborted && !force) return;
    if (force || ready >= EARLY_GALLERY_COUNT || ready >= total) {
      if (!galleryOpened || force) {
        galleryOpened = true;
        onGalleryReady?.(snap);
      } else {
        onVideosSnapshot?.(snap);
      }
    } else if (ready > 0 && ready % updateEvery === 0) {
      onVideosSnapshot?.(snap);
    }
  };

  const report = (phase, done, t) => {
    if (!onProgress) return;
    const denom = Math.max(t, 1);
    if (phase === 'thumb') {
      onProgress(Math.round((done / denom) * 45), done, t, 'thumb');
    } else {
      onProgress(45 + Math.round((done / denom) * 55), done, t, 'gif');
    }
  };

  // Cache probe (lightweight)
  await runParallelPool(
    total,
    Math.min(6, workers + 2),
    () => {},
    async (slot) => {
      const { id } = items[slot];
      const [meta, cachedThumb, cachedGifUrl] = await Promise.all([
        getCachedPreviewMeta(id).catch(() => null),
        getCachedThumbnail(id).catch(() => null),
        getCachedPreviewGif(id).catch(() => null),
      ]);
      plan[slot] = {
        meta,
        cachedThumb,
        cachedGifUrl,
        needsThumb: !cachedThumb,
        needsGif:
          !skipGifs &&
          (metaNeedsRefresh(meta, previewStartPct, previewEndPct) || !cachedGifUrl),
      };
    },
    signal,
  );

  if (signal?.aborted) return snapshotResults(results);

  // Pass 1 — thumbnails (always makes progress; per-file timeout inside extractFileMedia)
  await runParallelPool(
    total,
    workers,
    (d, t) => report('thumb', d, t),
    async (slot) => {
      if (signal?.aborted) return;
      const item = items[slot];
      const p = plan[slot];

      let thumbnail = p.cachedThumb;
      let meta = p.meta;
      const previewGifUrl = p.cachedGifUrl;

      if (p.needsThumb || !meta?.duration) {
        const extracted = await extractFileMedia(item.file, {
          previewStartPct,
          previewEndPct,
          needThumb: true,
          needGif: false,
        });
        if (extracted.thumbnail) {
          thumbnail = extracted.thumbnail;
          cacheThumbnail(item.id, thumbnail).catch(() => {});
        }
        meta = {
          duration: extracted.duration,
          previewStart: extracted.previewStart,
          previewEnd: extracted.previewEnd,
          previewStartPct,
          previewEndPct,
        };
        p.meta = meta;
      }

      const gifRange = previewGifRange(meta?.previewStart ?? 0, meta?.previewEnd ?? 0, 3);

      results[item.i] = buildEntry(item, {
        thumbnail,
        previewGifUrl,
        duration: meta?.duration ?? 0,
        previewStart: gifRange.start,
        previewEnd: gifRange.end,
      });

      tryOpenGallery();
    },
    signal,
  );

  tryOpenGallery(true);
  report('thumb', total, total);

  if (signal?.aborted) return snapshotResults(results);
  if (skipGifs) return snapshotResults(results);

  const gifSlots = items.map((_, s) => s).filter((s) => plan[s]?.needsGif);

  await runParallelPool(
    gifSlots.length,
    Math.max(1, workers - 1),
    (d, t) => report('gif', d, t),
    async (job) => {
      if (signal?.aborted) return;
      const slot = gifSlots[job];
      const item = items[slot];
      const entry = results[item.i];
      if (!entry) return;
      const meta = plan[slot].meta || {};

      const extracted = await extractFileMedia(item.file, {
        previewStartPct,
        previewEndPct,
        needThumb: false,
        needGif: true,
      });

      let previewGifUrl = entry.previewGifUrl;
      if (extracted.previewGifBlob) {
        cachePreviewGif(item.id, extracted.previewGifBlob).catch(() => {});
        previewGifUrl = URL.createObjectURL(extracted.previewGifBlob);
      }

      const gifRange = previewGifRange(
        meta.previewStart ?? extracted.previewStart,
        meta.previewEnd ?? extracted.previewEnd,
        3,
      );

      cachePreviewMeta(item.id, {
        duration: meta.duration ?? extracted.duration,
        previewStart: gifRange.start,
        previewEnd: gifRange.end,
        previewStartPct,
        previewEndPct,
        previewGifVersion: PREVIEW_GIF_VERSION,
        hasPreviewGif: !!previewGifUrl,
      }).catch(() => {});

      entry.previewGifUrl = previewGifUrl;
      entry.hasPreviewGif = !!previewGifUrl;
      entry.previewStart = gifRange.start;
      entry.previewEnd = gifRange.end;
      onVideoUpdated?.({ ...entry });
    },
    signal,
  );

  if (!gifSlots.length) report('gif', 1, 1);

  return snapshotResults(results);
}

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

/** Default worker count from CPU cores (capped for memory). */
export function defaultProcessConcurrency() {
  if (typeof navigator === 'undefined') return 6;
  const cores = navigator.hardwareConcurrency || 4;
  return Math.min(12, Math.max(4, cores));
}

function metaNeedsRefresh(meta, previewStartPct, previewEndPct) {
  if (!meta) return true;
  return (
    meta.previewGifVersion !== PREVIEW_GIF_VERSION ||
    meta.previewStartPct !== previewStartPct ||
    meta.previewEndPct !== previewEndPct ||
    !meta.hasPreviewGif
  );
}

async function runParallelPool(total, concurrency, onItemDone, worker) {
  let index = 0;
  let done = 0;

  async function poolWorker() {
    while (index < total) {
      const slot = index++;
      await worker(slot);
      done += 1;
      onItemDone(done, total);
    }
  }

  const n = Math.min(Math.max(1, concurrency), Math.max(1, total));
  await Promise.all(Array.from({ length: n }, () => poolWorker()));
}

function reportProgress(onProgress, phase, done, total) {
  if (!onProgress) return;
  if (phase === 'meta') {
    onProgress(Math.round((done / total) * 25), done, total, 'meta');
  } else {
    onProgress(25 + Math.round((done / total) * 75), done, total, 'media');
  }
}

/**
 * Pass 1: metadata in parallel.
 * Pass 2: per file, thumbnail + GIF generated in parallel (Promise.all), many files at once.
 */
export async function processVideosBatch(
  files,
  {
    concurrency,
    thumbConcurrency,
    gifConcurrency,
    onProgress,
    previewStartPct = 15,
    previewEndPct = 25,
  } = {},
) {
  const base = concurrency ?? defaultProcessConcurrency();
  const mediaWorkers = Math.max(thumbConcurrency ?? base, gifConcurrency ?? base);
  const metaWorkers = thumbConcurrency ?? base;
  const total = files.length;

  const items = files.map((file, i) => ({
    i,
    file,
    id: file.id ?? `${file.name}-${file.size}-${file.lastModified}`,
    relativePath: file.webkitRelativePath || file.name,
  }));

  const metas = new Array(total);
  const results = new Array(total);

  await runParallelPool(total, metaWorkers, (done, t) => {
    reportProgress(onProgress, 'meta', done, t);
  }, async (slot) => {
    const { file, id } = items[slot];
    let meta = await getCachedPreviewMeta(id).catch(() => null);
    if (!meta || meta.previewStartPct !== previewStartPct || meta.previewEndPct !== previewEndPct) {
      meta = await probeMetadata(file, { previewStartPct, previewEndPct });
    }
    metas[slot] = meta;
  });

  await runParallelPool(total, mediaWorkers, (done, t) => {
    reportProgress(onProgress, 'media', done, t);
  }, async (slot) => {
    const { file, id, relativePath, i } = items[slot];
    const meta = metas[slot] || {};
    const gifRange = previewGifRange(meta.previewStart ?? 0, meta.previewEnd ?? 0, 3);

    const [cachedThumb, cachedGifUrl] = await Promise.all([
      getCachedThumbnail(id).catch(() => null),
      getCachedPreviewGif(id).catch(() => null),
    ]);

    const needsThumb = !cachedThumb && meta.duration > 0;
    const needsGif =
      (metaNeedsRefresh(meta, previewStartPct, previewEndPct) || !cachedGifUrl) &&
      gifRange.end > gifRange.start;

    const thumbTask = needsThumb
      ? (async () => {
          const tThumb = (meta.duration * previewStartPct) / 100;
          const thumb = await generateThumbnailAtTime(file, tThumb).catch(() => null);
          if (thumb) await cacheThumbnail(id, thumb).catch(() => {});
          return thumb;
        })()
      : Promise.resolve(cachedThumb);

    const gifTask = needsGif
      ? (async () => {
          const blob = await generatePreviewGif(file, gifRange.start, gifRange.end).catch(() => null);
          if (!blob) return null;
          await cachePreviewGif(id, blob).catch(() => {});
          return URL.createObjectURL(blob);
        })()
      : Promise.resolve(cachedGifUrl);

    const [thumbnail, previewGifUrl] = await Promise.all([thumbTask, gifTask]);

    const storedMeta = {
      duration: meta.duration,
      previewStart: gifRange.start,
      previewEnd: gifRange.end,
      previewStartPct,
      previewEndPct,
      previewGifVersion: PREVIEW_GIF_VERSION,
      hasPreviewGif: !!previewGifUrl,
    };
    await cachePreviewMeta(id, storedMeta).catch(() => {});

    results[i] = {
      id,
      name: file.name,
      relativePath,
      file,
      size: file.size,
      createdAt: file.lastModified,
      thumbnail,
      previewGifUrl,
      duration: meta.duration ?? 0,
      previewStart: gifRange.start,
      previewEnd: gifRange.end,
      hasPreviewGif: !!previewGifUrl,
    };
  });

  return results.filter(Boolean);
}

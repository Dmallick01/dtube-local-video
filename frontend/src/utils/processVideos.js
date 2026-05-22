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

function metaNeedsRefresh(meta, previewStartPct, previewEndPct) {
  if (!meta) return true;
  return (
    meta.previewGifVersion !== PREVIEW_GIF_VERSION ||
    meta.previewStartPct !== previewStartPct ||
    meta.previewEndPct !== previewEndPct ||
    !meta.hasPreviewGif
  );
}

/** Video decode is heavy — limit parallel decoders to reduce thrashing. */
export function defaultProcessConcurrency() {
  if (typeof navigator === 'undefined') return 3;
  const cores = navigator.hardwareConcurrency || 4;
  return Math.min(4, Math.max(2, Math.floor(cores / 2)));
}

async function runParallelPool(total, concurrency, onItemDone, worker) {
  if (total <= 0) {
    onItemDone(0, 0);
    return;
  }
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

/**
 * Pass 1: thumbnails (one decode/file). Opens gallery early.
 * Pass 2: GIFs only (one decode/file), runs in parallel after gallery is shown.
 */
export async function processVideosBatch(
  files,
  {
    concurrency,
    onProgress,
    onGalleryReady,
    onVideoUpdated,
    previewStartPct = 15,
    previewEndPct = 25,
  } = {},
) {
  const workers = concurrency ?? defaultProcessConcurrency();
  const total = files.length;

  const items = files.map((file, i) => ({
    i,
    file,
    id: file.id ?? `${file.name}-${file.size}-${file.lastModified}`,
    relativePath: file.webkitRelativePath || file.name,
  }));

  const results = new Array(total);
  const plan = new Array(total);

  await runParallelPool(total, Math.min(8, workers * 2), () => {}, async (slot) => {
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
      needsGif: metaNeedsRefresh(meta, previewStartPct, previewEndPct) || !cachedGifUrl,
      needsDecode: !cachedThumb || metaNeedsRefresh(meta, previewStartPct, previewEndPct) || !meta,
    };
  });

  const report = (phase, done, t) => {
    if (!onProgress) return;
    const denom = Math.max(t, 1);
    if (phase === 'thumb') {
      onProgress(Math.round((done / denom) * 45), done, t, 'thumb');
    } else {
      onProgress(45 + Math.round((done / denom) * 55), done, t, 'gif');
    }
  };

  // —— Pass 1: thumbnails + metadata (single decode when needed) ——
  await runParallelPool(total, workers, (d, t) => report('thumb', d, t), async (slot) => {
    const item = items[slot];
    const p = plan[slot];

    let thumbnail = p.cachedThumb;
    let meta = p.meta;
    let previewGifUrl = p.cachedGifUrl;

    if (p.needsThumb || !meta?.duration) {
      const extracted = await extractFileMedia(item.file, {
        previewStartPct,
        previewEndPct,
        needThumb: true,
        needGif: false,
      });
      if (extracted.thumbnail) {
        thumbnail = extracted.thumbnail;
        await cacheThumbnail(item.id, thumbnail).catch(() => {});
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
  });

  onGalleryReady?.(results.filter(Boolean));
  report('thumb', total, total);

  // —— Pass 2: GIFs (only files that need them) ——
  const gifSlots = items.map((_, s) => s).filter((s) => plan[s].needsGif);

  await runParallelPool(gifSlots.length, workers, (d, t) => report('gif', d, t), async (job) => {
    const slot = gifSlots[job];
    const item = items[slot];
    const entry = results[item.i];
    const meta = plan[slot].meta || {};

    const extracted = await extractFileMedia(item.file, {
      previewStartPct,
      previewEndPct,
      needThumb: false,
      needGif: true,
    });

    let previewGifUrl = entry.previewGifUrl;
    if (extracted.previewGifBlob) {
      await cachePreviewGif(item.id, extracted.previewGifBlob).catch(() => {});
      previewGifUrl = URL.createObjectURL(extracted.previewGifBlob);
    }

    const gifRange = previewGifRange(
      meta.previewStart ?? extracted.previewStart,
      meta.previewEnd ?? extracted.previewEnd,
      3,
    );

    await cachePreviewMeta(item.id, {
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
  });

  if (!gifSlots.length) report('gif', 1, 1);

  return results.filter(Boolean);
}

import { probeVideo } from './mediaProbe';
import { getCachedThumbnail, cacheThumbnail, getCachedPreviewMeta, cachePreviewMeta } from '../lib/storage';

/** Probe thumbnails + preview window (15–25%) with IndexedDB cache. */
export async function processVideosBatch(
  files,
  { concurrency = 4, onProgress, previewStartPct = 15, previewEndPct = 25 } = {},
) {
  const results = new Array(files.length);
  let completed = 0;
  let index = 0;

  async function worker() {
    while (index < files.length) {
      const i = index++;
      const file = files[i];
      const id = file.id ?? `${file.name}-${file.size}-${file.lastModified}`;
      const relativePath = file.webkitRelativePath || file.name;

      let thumbnail = await getCachedThumbnail(id).catch(() => null);
      let meta = await getCachedPreviewMeta(id).catch(() => null);

      if (!meta) {
        const probed = await probeVideo(file, { previewStartPct, previewEndPct, thumbPct: previewStartPct });
        meta = {
          duration: probed.duration,
          previewStart: probed.previewStart,
          previewEnd: probed.previewEnd,
          previewPlayable: probed.previewPlayable,
        };
        await cachePreviewMeta(id, meta).catch(() => {});
        if (!thumbnail && probed.thumbnail) {
          thumbnail = probed.thumbnail;
          await cacheThumbnail(id, probed.thumbnail).catch(() => {});
        }
      } else if (!thumbnail) {
        const probed = await probeVideo(file, { previewStartPct, previewEndPct, thumbPct: previewStartPct });
        if (probed.thumbnail) {
          thumbnail = probed.thumbnail;
          await cacheThumbnail(id, probed.thumbnail).catch(() => {});
        }
      }

      results[i] = {
        id,
        name: file.name,
        relativePath,
        file,
        size: file.size,
        createdAt: file.lastModified,
        thumbnail,
        duration: meta?.duration ?? 0,
        previewStart: meta?.previewStart ?? 0,
        previewEnd: meta?.previewEnd ?? 0,
        previewPlayable: meta?.previewPlayable ?? false,
      };
      completed += 1;
      onProgress?.(Math.round((completed / files.length) * 100), completed, files.length);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => worker());
  await Promise.all(workers);
  return results.filter(Boolean);
}

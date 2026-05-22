import { generateThumbnail } from './thumbnailGenerator';
import { getCachedThumbnail, cacheThumbnail } from '../lib/storage';

/** Process files with limited concurrency; reuse IndexedDB thumbnail cache. */
export async function processVideosBatch(files, { concurrency = 4, onProgress } = {}) {
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
      if (!thumbnail) {
        const generated = await generateThumbnail(file).catch(() => null);
        if (generated) {
          thumbnail = generated;
          await cacheThumbnail(id, generated).catch(() => {});
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
        duration: 0,
      };
      completed += 1;
      onProgress?.(Math.round((completed / files.length) * 100), completed, files.length);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => worker());
  await Promise.all(workers);
  return results.filter(Boolean);
}

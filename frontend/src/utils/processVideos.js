import { generateThumbnail } from './thumbnailGenerator';

/** Process files with limited concurrency for faster folder loads. */
export async function processVideosBatch(files, { concurrency = 4, onProgress } = {}) {
  const results = new Array(files.length);
  let completed = 0;
  let index = 0;

  async function worker() {
    while (index < files.length) {
      const i = index++;
      const file = files[i];
      const thumbUrl = await generateThumbnail(file).catch(() => null);
      results[i] = {
        id: file.id ?? `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        file,
        size: file.size,
        createdAt: file.lastModified,
        thumbnail: thumbUrl,
      };
      completed += 1;
      onProgress?.(Math.round((completed / files.length) * 100), completed, files.length);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, files.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results.filter(Boolean);
}

function folderKey(video) {
  const p = video.relativePath || video.name;
  const parts = p.split('/');
  if (parts.length <= 1) return '(root)';
  return parts.slice(0, -1).join('/') || '(root)';
}

function sizeBucket(size) {
  if (size < 50 * 1024 * 1024) return 'Small (<50 MB)';
  if (size < 500 * 1024 * 1024) return 'Medium (50–500 MB)';
  return 'Large (>500 MB)';
}

function dateBucket(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function groupVideos(videos, groupBy) {
  if (!groupBy || groupBy === 'none') {
    return [{ key: 'all', label: 'All videos', videos }];
  }

  const map = new Map();
  for (const v of videos) {
    let key;
    switch (groupBy) {
      case 'folder':
        key = folderKey(v);
        break;
      case 'extension':
        key = `.${v.name.split('.').pop().toLowerCase()}`;
        break;
      case 'size':
        key = sizeBucket(v.size);
        break;
      case 'date':
        key = dateBucket(v.createdAt);
        break;
      default:
        key = 'all';
    }
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(v);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, vids]) => ({ key, label: key, videos: vids }));
}

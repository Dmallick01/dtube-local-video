export function sortVideos(videos, sortOption) {
  const list = [...videos];
  list.sort((a, b) => {
    switch (sortOption) {
      case 'name_asc':
        return a.name.localeCompare(b.name);
      case 'name_desc':
        return b.name.localeCompare(a.name);
      case 'path_asc':
        return (a.relativePath || a.name).localeCompare(b.relativePath || b.name);
      case 'path_desc':
        return (b.relativePath || b.name).localeCompare(a.relativePath || a.name);
      case 'size_asc':
        return a.size - b.size;
      case 'size_desc':
        return b.size - a.size;
      case 'duration_asc':
        return (a.duration || 0) - (b.duration || 0);
      case 'duration_desc':
        return (b.duration || 0) - (a.duration || 0);
      case 'ext_asc':
        return a.name.split('.').pop().localeCompare(b.name.split('.').pop());
      case 'date_asc':
        return a.createdAt - b.createdAt;
      case 'date_desc':
      default:
        return b.createdAt - a.createdAt;
    }
  });
  return list;
}

export function orderByIds(videos, idOrder) {
  const map = new Map(videos.map((v) => [v.id, v]));
  const ordered = idOrder.map((id) => map.get(id)).filter(Boolean);
  const rest = videos.filter((v) => !idOrder.includes(v.id));
  return [...ordered, ...rest];
}

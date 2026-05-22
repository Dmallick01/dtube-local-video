import React from 'react';

function formatBytes(n) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function VideoListView({
  videos,
  favorites,
  progressMap,
  onPlay,
  onToggleFavorite,
  onAddQueue,
}) {
  return (
    <table className="video-list-table">
      <thead>
        <tr>
          <th style={{ width: 32 }}>★</th>
          <th>Name / path</th>
          <th>Size</th>
          <th>Modified</th>
          <th>Progress</th>
          <th style={{ width: 48 }}>Q</th>
        </tr>
      </thead>
      <tbody>
        {videos.map((video) => {
          const prog = progressMap[video.id];
          const pct = video.duration && prog ? Math.min(100, Math.round((prog / video.duration) * 100)) : null;
          return (
            <tr key={video.id} onDoubleClick={() => onPlay(video)}>
              <td onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={`star-btn ${favorites.has(video.id) ? 'active' : ''}`}
                  onClick={() => onToggleFavorite(video.id)}
                  aria-label="Favorite"
                >
                  {favorites.has(video.id) ? '★' : '☆'}
                </button>
              </td>
              <td onClick={() => onPlay(video)} title={video.relativePath || video.name}>
                <div>{video.name}</div>
                {video.relativePath && video.relativePath !== video.name && (
                  <div className="video-meta-line">{video.relativePath}</div>
                )}
              </td>
              <td onClick={() => onPlay(video)}>{formatBytes(video.size)}</td>
              <td onClick={() => onPlay(video)}>{new Date(video.createdAt).toLocaleDateString()}</td>
              <td onClick={() => onPlay(video)}>
                {pct != null ? <span className="progress-badge">{pct}%</span> : '—'}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <button type="button" className="btn" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => onAddQueue(video.id)}>
                  +
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

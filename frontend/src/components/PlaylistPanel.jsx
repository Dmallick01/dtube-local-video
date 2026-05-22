import React from 'react';

export default function PlaylistPanel({
  queue,
  videosById,
  currentVideoId,
  onReorder,
  onRemove,
  onSelect,
  onClear,
}) {
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('text/plain'));
    if (Number.isNaN(from) || from === dropIndex) return;
    onReorder(from, dropIndex);
  };

  return (
    <aside className="queue-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="queue-title">Playlist ({queue.length})</h2>
        {queue.length > 0 && (
          <button type="button" className="btn" style={{ fontSize: 10, padding: '2px 6px' }} onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <p style={{ fontSize: 10, color: 'var(--cdisabled)', marginBottom: 8 }}>
        Drag to reorder · click to play
      </p>
      {queue.length === 0 ? (
        <p style={{ fontSize: 11, color: 'var(--cdisabled)' }}>Click videos to add to queue.</p>
      ) : (
        <ul style={{ listStyle: 'none' }}>
          {queue.map((id, index) => {
            const v = videosById[id];
            if (!v) return null;
            return (
              <li
                key={id}
                className={`queue-item ${currentVideoId === id ? 'playing' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => onSelect(v)}
              >
                <span title={v.relativePath || v.name}>
                  {index + 1}. {v.name}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(id);
                  }}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

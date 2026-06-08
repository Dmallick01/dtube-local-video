import React from 'react';

function formatChapterTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const ChaptersPanel = ({ chapters, onSeek, onClose }) => (
  <div className="side-panel">
    <div className="side-panel-head">
      <span>Chapters · {chapters.length} · derived from transcript topic breaks</span>
      <button type="button" className="btn" onClick={onClose}>
        Close
      </button>
    </div>
    <div className="side-panel-body">
      {chapters.map((chapter, i) => (
        <button
          key={`${chapter.start}-${i}`}
          type="button"
          className="side-panel-row"
          onClick={() => onSeek(chapter.start)}
        >
          <span className="side-panel-row-time">{formatChapterTime(chapter.start)}</span>
          <span className="side-panel-row-text">{chapter.label}</span>
        </button>
      ))}
    </div>
  </div>
);

export default ChaptersPanel;

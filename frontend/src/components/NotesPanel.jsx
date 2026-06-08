import React, { useState } from 'react';

function formatNoteTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const NotesPanel = ({ notes, currentTime, onAdd, onDelete, onSeek, onExport, exportDisabled, onClose }) => {
  const [draft, setDraft] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft('');
  };

  const sorted = [...notes].sort((a, b) => a.time - b.time);

  return (
    <div className="side-panel">
      <div className="side-panel-head">
        <span>Notes · {notes.length} · click a line to jump</span>
        <button
          type="button"
          className="btn"
          onClick={onExport}
          disabled={exportDisabled}
          title={exportDisabled ? 'Generate captions or add a note first' : 'Download a Markdown study sheet'}
        >
          Export study sheet
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
      <form className="notes-composer" onSubmit={submit}>
        <input
          type="text"
          className="control-input"
          placeholder="Jot a note about what's on screen right now…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
          Add @ {formatNoteTime(currentTime)}
        </button>
      </form>
      <div className="side-panel-body">
        {sorted.length === 0 && (
          <p style={{ padding: '8px 16px', fontSize: 11, color: 'var(--cdisabled)' }}>
            No notes yet — type something above while you watch.
          </p>
        )}
        {sorted.map((note) => (
          <div key={note.id} className="note-row">
            <button type="button" className="side-panel-row" onClick={() => onSeek(note.time)}>
              <span className="side-panel-row-time">{formatNoteTime(note.time)}</span>
              <span className="side-panel-row-text">{note.text}</span>
            </button>
            <button type="button" className="note-delete" title="Delete note" onClick={() => onDelete(note.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotesPanel;

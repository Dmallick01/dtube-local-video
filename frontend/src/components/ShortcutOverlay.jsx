import React from 'react';

const GALLERY = [
  ['?', 'Shortcuts overlay'],
  ['/', 'Focus search'],
];

const PLAYER = [
  ['Space', 'Play / pause'],
  ['← / →', 'Seek ±5s'],
  ['Shift+← / →', 'Previous / next in queue'],
  ['N / P', 'Next / previous'],
  ['F', 'Fullscreen'],
  ['I', 'Picture-in-picture'],
  ['S', 'Toggle skip-silence'],
  ['[ / ]', 'Mark loop point A / B'],
  ['L', 'Toggle A↔B loop'],
  ['0.5–2 chips', 'Playback speed'],
  ['Esc', 'Close player'],
];

export default function ShortcutOverlay({ open, context, onClose }) {
  if (!open) return null;
  const rows = context === 'player' ? PLAYER : [...GALLERY, ...PLAYER];

  return (
    <div className="shortcut-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="shortcut-panel" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard shortcuts — {context === 'player' ? 'Player' : 'Gallery & player'}</h2>
        <table>
          <tbody>
            {rows.map(([key, desc]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn" style={{ marginTop: 16 }} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

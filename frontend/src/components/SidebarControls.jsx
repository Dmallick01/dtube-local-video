import React from 'react';
import { SHUFFLE_ALGORITHMS } from '../lib/shuffleAlgorithms';

const SidebarControls = ({
  sortOption,
  setSortOption,
  filterExt,
  setFilterExt,
  extensions,
  searchQuery,
  setSearchQuery,
  gridCols,
  setGridCols,
  groupBy,
  setGroupBy,
  shuffleAlgorithm,
  setShuffleAlgorithm,
  shuffleScope,
  setShuffleScope,
  previewStartPct,
  setPreviewStartPct,
  previewEndPct,
  setPreviewEndPct,
  onShuffle,
  onResetOrder,
  customOrderActive,
  folderHistory,
  onReopenFolder,
}) => {
  return (
    <div className="sidebar-controls">
      <div className="control-group">
        <label htmlFor="search-input">Search path (fuzzy)</label>
        <input
          id="search-input"
          type="search"
          placeholder="Match filename or folder path…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="control-input"
        />
      </div>

      <div className="control-group">
        <label htmlFor="sort-select">Sort by</label>
        <select
          id="sort-select"
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          className="control-select"
          disabled={customOrderActive}
        >
          <option value="date_desc">Date (newest)</option>
          <option value="date_asc">Date (oldest)</option>
          <option value="name_asc">Name (A–Z)</option>
          <option value="name_desc">Name (Z–A)</option>
          <option value="path_asc">Path (A–Z)</option>
          <option value="path_desc">Path (Z–A)</option>
          <option value="size_desc">Size (largest)</option>
          <option value="size_asc">Size (smallest)</option>
          <option value="duration_desc">Duration (longest)</option>
          <option value="duration_asc">Duration (shortest)</option>
          <option value="ext_asc">Extension (A–Z)</option>
        </select>
        {customOrderActive && (
          <p className="control-hint">Sort paused — shuffle order active. Reset to sort again.</p>
        )}
      </div>

      <div className="control-group">
        <label htmlFor="group-select">Group by</label>
        <select
          id="group-select"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value)}
          className="control-select"
        >
          <option value="none">None (single grid)</option>
          <option value="folder">Folder</option>
          <option value="extension">File type</option>
          <option value="size">Size bucket</option>
          <option value="date">Month</option>
        </select>
      </div>

      <div className="control-group">
        <label>Hover preview window (% of timeline)</label>
        <div className="range-row">
          <span className="range-label">Start {previewStartPct}%</span>
          <input
            type="range"
            min={5}
            max={40}
            value={previewStartPct}
            onChange={(e) => setPreviewStartPct(Number(e.target.value))}
          />
        </div>
        <div className="range-row">
          <span className="range-label">End {previewEndPct}%</span>
          <input
            type="range"
            min={previewStartPct + 5}
            max={50}
            value={Math.max(previewEndPct, previewStartPct + 5)}
            onChange={(e) => setPreviewEndPct(Number(e.target.value))}
          />
        </div>
        <p className="control-hint">Applied on next folder scan. Hover shows a GIF from this slice.</p>
      </div>

      <div className="control-group shuffle-panel">
        <label htmlFor="shuffle-algo">Shuffle algorithm</label>
        <select
          id="shuffle-algo"
          value={shuffleAlgorithm}
          onChange={(e) => setShuffleAlgorithm(e.target.value)}
          className="control-select"
        >
          {SHUFFLE_ALGORITHMS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <p className="control-hint">
          {SHUFFLE_ALGORITHMS.find((a) => a.id === shuffleAlgorithm)?.desc}
        </p>

        <label htmlFor="shuffle-scope">Shuffle scope</label>
        <select
          id="shuffle-scope"
          value={shuffleScope}
          onChange={(e) => setShuffleScope(e.target.value)}
          className="control-select"
        >
          <option value="library">Whole library</option>
          <option value="group">Within each group</option>
        </select>

        <div className="shuffle-actions">
          <button type="button" className="btn btn-primary" onClick={onShuffle}>
            Shuffle
          </button>
          <button type="button" className="btn" onClick={onResetOrder} disabled={!customOrderActive}>
            Reset order
          </button>
        </div>
      </div>

      <div className="control-group">
        <label htmlFor="ext-select">File type</label>
        <select
          id="ext-select"
          value={filterExt}
          onChange={(e) => setFilterExt(e.target.value)}
          className="control-select"
        >
          <option value="all">All types</option>
          {extensions.map((ext) => (
            <option key={ext} value={`.${ext}`}>
              .{ext}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label htmlFor="grid-select">Grid density</label>
        <select
          id="grid-select"
          value={gridCols}
          onChange={(e) => setGridCols(e.target.value)}
          className="control-select"
        >
          <option value="auto">Comfortable</option>
          <option value="compact">Compact</option>
          <option value="wide">Wide cards</option>
        </select>
      </div>

      {folderHistory?.length > 0 && (
        <div className="control-group">
          <label>Recent libraries</label>
          <ul className="history-list">
            {folderHistory.map((h) => (
              <li key={`${h.name}-${h.at}`}>
                <button type="button" className="btn" onClick={() => onReopenFolder()}>
                  {h.name} ({h.count} files)
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SidebarControls;

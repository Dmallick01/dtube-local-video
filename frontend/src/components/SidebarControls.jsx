import React from 'react';

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
        >
          <option value="date_desc">Date (newest)</option>
          <option value="date_asc">Date (oldest)</option>
          <option value="name_asc">Name (A–Z)</option>
          <option value="name_desc">Name (Z–A)</option>
          <option value="size_desc">Size (largest)</option>
          <option value="size_asc">Size (smallest)</option>
        </select>
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
          <p style={{ fontSize: 10, color: 'var(--cdisabled)', marginTop: 6 }}>
            Re-open uses folder picker (browser security).
          </p>
        </div>
      )}
    </div>
  );
};

export default SidebarControls;

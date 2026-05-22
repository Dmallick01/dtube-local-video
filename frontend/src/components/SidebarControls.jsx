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
}) => {
  return (
    <div className="sidebar-controls">
      <div className="control-group">
        <label>Search</label>
        <input
          type="search"
          placeholder="Filter by filename…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="control-input"
        />
      </div>

      <div className="control-group">
        <label>Sort by</label>
        <select
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
        <label>File type</label>
        <select
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
        <label>Grid density</label>
        <select
          value={gridCols}
          onChange={(e) => setGridCols(e.target.value)}
          className="control-select"
        >
          <option value="auto">Comfortable</option>
          <option value="compact">Compact</option>
          <option value="wide">Wide cards</option>
        </select>
      </div>
    </div>
  );
};

export default SidebarControls;

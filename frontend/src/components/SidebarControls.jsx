import React from 'react';

const SidebarControls = ({ sortOption, setSortOption, filterExt, setFilterExt, extensions }) => {
  return (
    <div className="sidebar-controls" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div className="control-group">
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Sort By
        </label>
        <select 
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            outline: 'none',
            fontSize: '0.875rem'
          }}
        >
          <option value="name_asc">Name (A-Z)</option>
          <option value="name_desc">Name (Z-A)</option>
          <option value="size_desc">Size (Largest)</option>
          <option value="size_asc">Size (Smallest)</option>
          <option value="date_desc">Date (Newest)</option>
          <option value="date_asc">Date (Oldest)</option>
        </select>
      </div>

      <div className="control-group">
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Filter Extension
        </label>
        <select 
          value={filterExt}
          onChange={(e) => setFilterExt(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            outline: 'none',
            fontSize: '0.875rem'
          }}
        >
          <option value="all">All Types</option>
          {extensions.map(ext => (
            <option key={ext} value={ext}>{ext.toUpperCase()}</option>
          ))}
        </select>
      </div>

    </div>
  );
};

export default SidebarControls;

import React from 'react';

export default function AppToolbar({
  theme,
  onThemeToggle,
  viewMode,
  onViewModeChange,
  favoritesOnly,
  onFavoritesOnlyChange,
  onShowShortcuts,
  onExportContactSheet,
  onOpenFolder,
  showGalleryActions,
}) {
  return (
    <nav className="dtube-toolbar" aria-label="DTube controls">
      <span className="brand">DTube</span>
      <span className="sep">|</span>
      <button type="button" onClick={onThemeToggle}>
        {theme === 'dark' ? '☀ Light' : '☾ Dark'}
      </button>
      <button type="button" onClick={onShowShortcuts} title="Keyboard shortcuts">
        ? Shortcuts
      </button>
      {showGalleryActions && (
        <>
          <span className="sep">|</span>
          <button
            type="button"
            className={viewMode === 'grid' ? 'active' : ''}
            onClick={() => onViewModeChange('grid')}
          >
            Grid
          </button>
          <button
            type="button"
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => onViewModeChange('list')}
          >
            List
          </button>
          <button
            type="button"
            className={favoritesOnly ? 'active' : ''}
            onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
          >
            ★ Favorites
          </button>
          <button type="button" onClick={onExportContactSheet}>
            Export sheet
          </button>
        </>
      )}
      <span className="sep">|</span>
      <button type="button" onClick={onOpenFolder}>
        Open folder…
      </button>
    </nav>
  );
}

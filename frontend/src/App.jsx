import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { scanFiles } from './utils/fileScanner';
import { processVideosBatch } from './utils/processVideos';
import VideoCard from './components/VideoCard';
import SidebarControls from './components/SidebarControls';
import VideoPlayer from './components/VideoPlayer';
import AppToolbar from './components/AppToolbar';
import PlaylistPanel from './components/PlaylistPanel';
import ShortcutOverlay from './components/ShortcutOverlay';
import VideoListView from './components/VideoListView';
import { fuzzyFilter } from './lib/fuzzy';
import {
  getFavorites,
  toggleFavorite,
  getFolderHistory,
  pushFolderHistory,
  getWatchProgress,
} from './lib/storage';
import { applyPluginFilters } from './lib/plugin';
import { findSubtitleFile, loadSubtitleUrl } from './lib/subtitles';
import { exportContactSheet } from './lib/contactSheet';

function formatBytes(n) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function App() {
  const [appState, setAppState] = useState('welcome');
  const [videos, setVideos] = useState([]);
  const [allFiles, setAllFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [libraryName, setLibraryName] = useState('');
  const folderInputRef = useRef(null);

  const [sortOption, setSortOption] = useState('date_desc');
  const [filterExt, setFilterExt] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [gridCols, setGridCols] = useState('auto');
  const [viewMode, setViewMode] = useState('grid');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(() => getFavorites());
  const [theme, setTheme] = useState(() => localStorage.getItem('dtube-theme') || 'light');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [queue, setQueue] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [subtitleUrl, setSubtitleUrl] = useState('');

  const [currentVideo, setCurrentVideo] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const [historyTick, setHistoryTick] = useState(0);
  const folderHistory = useMemo(() => getFolderHistory(), [historyTick]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dtube-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      }
      if (e.key === '/' && appState === 'gallery') {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [appState]);

  const refreshProgressMap = useCallback(async (list) => {
    const map = {};
    await Promise.all(
      list.slice(0, 200).map(async (v) => {
        map[v.id] = await getWatchProgress(v.id);
      }),
    );
    setProgressMap(map);
  }, []);

  const ingestFiles = useCallback(
    async (videoFiles, sidecarFiles, label = 'Library') => {
      setAppState('processing');
      setLibraryName(label);
      setProgress(0);
      setProgressLabel('Scanning folder…');
      setAllFiles([...videoFiles, ...sidecarFiles]);

      if (!videoFiles.length) {
        setAppState('welcome');
        alert('No video files found. Supported: mp4, webm, mov, mkv, avi, m4v');
        return;
      }

      setProgressLabel(`Indexing ${videoFiles.length} videos…`);
      const processed = await processVideosBatch(videoFiles, {
        concurrency: 6,
        onProgress: (pct, done, total) => {
          setProgress(pct);
          setProgressLabel(`${done} / ${total} thumbnails`);
        },
      });

      setVideos(processed);
      setQueue(processed.map((v) => v.id));
      setSearchQuery('');
      setFavoritesOnly(false);
      pushFolderHistory({ name: label, count: processed.length });
      setHistoryTick((t) => t + 1);
      await refreshProgressMap(processed);
      setAppState('gallery');
    },
    [refreshProgressMap],
  );

  const ingestFromFileList = async (files, label) => {
    const videoExts = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'];
    const videosList = [];
    const sidecars = [];
    files.forEach((f, i) => {
      const ext = f.name.split('.').pop().toLowerCase();
      if (videoExts.includes(ext)) {
        f.id = f.id ?? `f-${i}-${f.name}-${f.size}`;
        if (!f.webkitRelativePath) f.webkitRelativePath = f.name;
        videosList.push(f);
      } else if (ext === 'srt' || ext === 'vtt') {
        sidecars.push(f);
      }
    });
    await ingestFiles(videosList, sidecars, label);
  };

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.items) {
        const scanned = await scanFiles(e.dataTransfer.items);
        await ingestFiles(scanned, [], 'Dropped folder');
      }
    },
    [ingestFiles],
  );

  const handleFolderPick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const label = files[0].webkitRelativePath?.split('/')[0] || 'Selected folder';
    await ingestFromFileList(files, label);
    e.target.value = '';
  };

  const videosById = useMemo(() => {
    const m = {};
    videos.forEach((v) => { m[v.id] = v; });
    return m;
  }, [videos]);

  const processedVideos = useMemo(() => {
    let result = [...videos];
    if (favoritesOnly) result = result.filter((v) => favorites.has(v.id));
    if (filterExt !== 'all') {
      result = result.filter((v) => v.name.toLowerCase().endsWith(filterExt));
    }
    result = fuzzyFilter(result, searchQuery, (v) => v.relativePath || v.name);
    result.sort((a, b) => {
      switch (sortOption) {
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'size_asc': return a.size - b.size;
        case 'size_desc': return b.size - a.size;
        case 'date_asc': return a.createdAt - b.createdAt;
        case 'date_desc':
        default: return b.createdAt - a.createdAt;
      }
    });
    return applyPluginFilters(result);
  }, [videos, sortOption, filterExt, searchQuery, favoritesOnly, favorites]);

  const playOrder = useMemo(() => {
    const ordered = queue.filter((id) => processedVideos.some((v) => v.id === id));
    const missing = processedVideos.map((v) => v.id).filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  }, [queue, processedVideos]);

  const openVideo = async (video) => {
    const idx = playOrder.findIndex((id) => id === video.id);
    setCurrentIndex(idx);
    setCurrentVideo(video);
    if (!queue.includes(video.id)) setQueue((q) => [...q, video.id]);

    const sub = findSubtitleFile(video, allFiles);
    if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
    if (sub) {
      const url = await loadSubtitleUrl(sub);
      setSubtitleUrl(url);
    } else {
      setSubtitleUrl('');
    }
  };

  const playAdjacent = (delta) => {
    if (!playOrder.length) return;
    const next = Math.min(playOrder.length - 1, Math.max(0, currentIndex + delta));
    const v = videosById[playOrder[next]];
    if (v) openVideo(v);
  };

  const handleToggleFavorite = (id) => {
    toggleFavorite(id);
    setFavorites(getFavorites());
  };

  const reorderQueue = (from, to) => {
    setQueue((q) => {
      const next = [...q];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const extensions = useMemo(() => {
    const exts = new Set(videos.map((v) => v.name.split('.').pop().toLowerCase()));
    return Array.from(exts).sort();
  }, [videos]);

  const totalSize = useMemo(() => videos.reduce((s, v) => s + v.size, 0), [videos]);

  if (appState === 'welcome') {
    return (
      <>
        <AppToolbar
          theme={theme}
          onThemeToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          onShowShortcuts={() => setShortcutsOpen(true)}
          onExportContactSheet={() => {}}
          onOpenFolder={() => folderInputRef.current?.click()}
          showGalleryActions={false}
        />
        <div className="welcome-screen">
          <h1>DTube</h1>
          <p className="welcome-sub">
            Local-first video library — offline playback, IndexedDB thumbnails &amp; watch progress,
            playlists, subtitles, and a minimal teaching-lab UI.
          </p>
          <div
            className={`dropzone ${isDragging ? 'active' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <h2>Drag a folder here</h2>
            <p>Recursive scan · mp4, webm, mov, mkv, avi, m4v · sidecar .srt/.vtt</p>
            <div className="welcome-actions">
              <button type="button" className="btn btn-primary" onClick={() => folderInputRef.current?.click()}>
                Choose folder…
              </button>
            </div>
          </div>
          <ul className="welcome-features">
            <li>Playlist + drag reorder</li>
            <li>Resume via IndexedDB</li>
            <li>Favorites &amp; fuzzy path search</li>
            <li>PiP · speed presets · contact sheet</li>
            <li>PWA install · plugin filters</li>
          </ul>
          <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple hidden onChange={handleFolderPick} />
        </div>
        <ShortcutOverlay open={shortcutsOpen} context="gallery" onClose={() => setShortcutsOpen(false)} />
      </>
    );
  }

  if (appState === 'processing') {
    return (
      <>
        <AppToolbar
          theme={theme}
          onThemeToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          onShowShortcuts={() => setShortcutsOpen(true)}
          onExportContactSheet={() => {}}
          onOpenFolder={() => folderInputRef.current?.click()}
          showGalleryActions={false}
        />
        <div className="welcome-screen">
          <h1>DTube</h1>
          <div className="progress-panel">
            <h2>{progressLabel || 'Processing…'}</h2>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p>{progress}%</p>
          </div>
        </div>
      </>
    );
  }

  const minCol = gridCols === 'compact' ? 200 : gridCols === 'wide' ? 360 : 260;

  return (
    <div className="app-shell">
      <AppToolbar
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        favoritesOnly={favoritesOnly}
        onFavoritesOnlyChange={setFavoritesOnly}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onExportContactSheet={() => exportContactSheet(processedVideos)}
        onOpenFolder={() => folderInputRef.current?.click()}
        showGalleryActions
      />

      {currentVideo && (
        <VideoPlayer
          video={currentVideo}
          subtitleUrl={subtitleUrl}
          hasNext={currentIndex < playOrder.length - 1}
          hasPrev={currentIndex > 0}
          onNext={() => playAdjacent(1)}
          onPrev={() => playAdjacent(-1)}
          onClose={() => {
            if (subtitleUrl) URL.revokeObjectURL(subtitleUrl);
            setSubtitleUrl('');
            setCurrentVideo(null);
            setCurrentIndex(-1);
            refreshProgressMap(videos);
          }}
          onShowShortcuts={() => setShortcutsOpen(true)}
        />
      )}

      <header className="app-header">
        <div>
          <h1>{libraryName || 'Library'}</h1>
          <p className="header-meta">
            {videos.length} files · {formatBytes(totalSize)}
            {searchQuery && ` · ${processedVideos.length} shown`}
          </p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn" onClick={() => folderInputRef.current?.click()}>
            Add folder
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setAppState('welcome');
              setVideos([]);
              setQueue([]);
              setLibraryName('');
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar-panel">
          <h2 className="sidebar-title">Library</h2>
          <SidebarControls
            sortOption={sortOption}
            setSortOption={setSortOption}
            filterExt={filterExt}
            setFilterExt={setFilterExt}
            extensions={extensions}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            gridCols={gridCols}
            setGridCols={setGridCols}
            folderHistory={folderHistory}
            onReopenFolder={() => folderInputRef.current?.click()}
          />
        </aside>

        <main className="content-area">
          {processedVideos.length === 0 ? (
            <div className="empty-state">
              <p>No videos match your filters.</p>
              <button type="button" className="btn" onClick={() => { setSearchQuery(''); setFavoritesOnly(false); }}>
                Clear filters
              </button>
            </div>
          ) : viewMode === 'list' ? (
            <VideoListView
              videos={processedVideos}
              favorites={favorites}
              progressMap={progressMap}
              onPlay={openVideo}
              onToggleFavorite={handleToggleFavorite}
              onAddQueue={(id) => setQueue((q) => (q.includes(id) ? q : [...q, id]))}
            />
          ) : (
            <div
              className="video-grid"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))` }}
            >
              {processedVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  isFavorite={favorites.has(video.id)}
                  onToggleFavorite={() => handleToggleFavorite(video.id)}
                  watchSeconds={progressMap[video.id] || 0}
                  onClick={() => openVideo(video)}
                  onAddQueue={() => setQueue((q) => (q.includes(video.id) ? q : [...q, video.id]))}
                />
              ))}
            </div>
          )}
        </main>

        <PlaylistPanel
          queue={queue.filter((id) => videosById[id])}
          videosById={videosById}
          currentVideoId={currentVideo?.id}
          onReorder={reorderQueue}
          onRemove={(id) => setQueue((q) => q.filter((x) => x !== id))}
          onSelect={openVideo}
          onClear={() => setQueue([])}
        />
      </div>

      <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple hidden onChange={handleFolderPick} />
      <ShortcutOverlay
        open={shortcutsOpen}
        context={currentVideo ? 'player' : 'gallery'}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}

export default App;

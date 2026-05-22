import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { scanFiles } from './utils/fileScanner';
import { processVideosBatch } from './utils/processVideos';
import SidebarControls from './components/SidebarControls';
import VideoPlayer from './components/VideoPlayer';
import AppToolbar from './components/AppToolbar';
import PlaylistPanel from './components/PlaylistPanel';
import ShortcutOverlay from './components/ShortcutOverlay';
import GalleryContent from './components/GalleryContent';
import { fuzzyFilter } from './lib/fuzzy';
import { groupVideos } from './lib/groupVideos';
import { sortVideos, orderByIds } from './lib/sortVideos';
import { shuffleWithAlgorithm } from './lib/shuffleAlgorithms';
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
  const [groupBy, setGroupBy] = useState('none');
  const [shuffleAlgorithm, setShuffleAlgorithm] = useState('fisher-yates');
  const [shuffleScope, setShuffleScope] = useState('library');
  const [customOrder, setCustomOrder] = useState(null);
  const [previewStartPct, setPreviewStartPct] = useState(15);
  const [previewEndPct, setPreviewEndPct] = useState(25);
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
        previewStartPct,
        previewEndPct,
        onProgress: (pct, done, total) => {
          setProgress(pct);
          setProgressLabel(`${done} / ${total} · thumbs + preview window`);
        },
      });

      setVideos(processed);
      setQueue(processed.map((v) => v.id));
      setCustomOrder(null);
      setSearchQuery('');
      setFavoritesOnly(false);
      pushFolderHistory({ name: label, count: processed.length });
      setHistoryTick((t) => t + 1);
      await refreshProgressMap(processed);
      setAppState('gallery');
    },
    [refreshProgressMap, previewStartPct, previewEndPct],
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

  const filteredVideos = useMemo(() => {
    let result = [...videos];
    if (favoritesOnly) result = result.filter((v) => favorites.has(v.id));
    if (filterExt !== 'all') {
      result = result.filter((v) => v.name.toLowerCase().endsWith(filterExt));
    }
    result = fuzzyFilter(result, searchQuery, (v) => v.relativePath || v.name);
    return applyPluginFilters(result);
  }, [videos, filterExt, searchQuery, favoritesOnly, favorites]);

  const displayVideos = useMemo(() => {
    if (customOrder?.length) {
      return orderByIds(filteredVideos, customOrder);
    }
    return sortVideos(filteredVideos, sortOption);
  }, [filteredVideos, sortOption, customOrder]);

  const galleryGroups = useMemo(
    () => groupVideos(displayVideos, groupBy),
    [displayVideos, groupBy],
  );

  const handleShuffle = () => {
    const seed = Date.now();
    const baseList = sortVideos(filteredVideos, sortOption);
    let ids;
    if (shuffleScope === 'group' && groupBy !== 'none') {
      const sections = groupVideos(baseList, groupBy);
      ids = sections.flatMap((g) =>
        shuffleWithAlgorithm(
          g.videos.map((v) => v.id),
          shuffleAlgorithm,
          seed + g.key.length,
        ),
      );
    } else {
      ids = shuffleWithAlgorithm(
        baseList.map((v) => v.id),
        shuffleAlgorithm,
        seed,
      );
    }
    setCustomOrder(ids);
    setQueue(ids);
  };

  const handleResetOrder = () => {
    setCustomOrder(null);
    setQueue(displayVideos.map((v) => v.id));
  };

  useEffect(() => {
    if (!customOrder && displayVideos.length) {
      setQueue((q) => {
        const ids = displayVideos.map((v) => v.id);
        if (q.length === ids.length && q.every((id, i) => id === ids[i])) return q;
        return ids;
      });
    }
  }, [displayVideos, customOrder]);

  const setSortOptionWrapped = (v) => {
    setSortOption(v);
    setCustomOrder(null);
  };

  const playOrder = useMemo(() => {
    const ordered = queue.filter((id) => displayVideos.some((v) => v.id === id));
    const missing = displayVideos.map((v) => v.id).filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  }, [queue, displayVideos]);

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
            <li>15–25% hover preview (processed with library)</li>
            <li>Group, sort, 10 shuffle algorithms</li>
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
        onExportContactSheet={() => exportContactSheet(displayVideos)}
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
            {searchQuery && ` · ${displayVideos.length} shown`}
            {customOrder && ' · shuffled'}
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
            setSortOption={setSortOptionWrapped}
            filterExt={filterExt}
            setFilterExt={setFilterExt}
            extensions={extensions}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            gridCols={gridCols}
            setGridCols={setGridCols}
            groupBy={groupBy}
            setGroupBy={setGroupBy}
            shuffleAlgorithm={shuffleAlgorithm}
            setShuffleAlgorithm={setShuffleAlgorithm}
            shuffleScope={shuffleScope}
            setShuffleScope={setShuffleScope}
            previewStartPct={previewStartPct}
            setPreviewStartPct={setPreviewStartPct}
            previewEndPct={previewEndPct}
            setPreviewEndPct={setPreviewEndPct}
            onShuffle={handleShuffle}
            onResetOrder={handleResetOrder}
            customOrderActive={!!customOrder}
            folderHistory={folderHistory}
            onReopenFolder={() => folderInputRef.current?.click()}
          />
        </aside>

        <main className="content-area">
          {displayVideos.length === 0 ? (
            <div className="empty-state">
              <p>No videos match your filters.</p>
              <button type="button" className="btn" onClick={() => { setSearchQuery(''); setFavoritesOnly(false); }}>
                Clear filters
              </button>
            </div>
          ) : (
            <GalleryContent
              groups={galleryGroups}
              viewMode={viewMode}
              gridCols={gridCols}
              favorites={favorites}
              progressMap={progressMap}
              onPlay={openVideo}
              onToggleFavorite={handleToggleFavorite}
              onAddQueue={(id) => setQueue((q) => (q.includes(id) ? q : [...q, id]))}
            />
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

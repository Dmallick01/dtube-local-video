import React, { useState, useCallback, useMemo, useRef } from 'react';
import './App.css';
import { scanFiles } from './utils/fileScanner';
import { processVideosBatch } from './utils/processVideos';
import VideoCard from './components/VideoCard';
import SidebarControls from './components/SidebarControls';
import VideoPlayer from './components/VideoPlayer';

function formatBytes(n) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function App() {
  const [appState, setAppState] = useState('welcome');
  const [videos, setVideos] = useState([]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [libraryName, setLibraryName] = useState('');
  const folderInputRef = useRef(null);

  const [sortOption, setSortOption] = useState('date_desc');
  const [filterExt, setFilterExt] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [gridCols, setGridCols] = useState('auto');

  const [currentVideo, setCurrentVideo] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const ingestFiles = useCallback(async (items, label = 'Library') => {
    setAppState('processing');
    setLibraryName(label);
    setProgress(0);
    setProgressLabel('Scanning folder…');

    const files = await scanFiles(items);
    if (!files.length) {
      setAppState('welcome');
      alert('No video files found. Supported: mp4, webm, mov, mkv, avi, m4v');
      return;
    }

    setProgressLabel(`Indexing ${files.length} videos…`);
    const processed = await processVideosBatch(files, {
      concurrency: 6,
      onProgress: (pct, done, total) => {
        setProgress(pct);
        setProgressLabel(`${done} / ${total} thumbnails`);
      },
    });

    setVideos(processed);
    setSearchQuery('');
    setAppState('gallery');
  }, []);

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.items) {
        await ingestFiles(e.dataTransfer.items, 'Dropped folder');
      }
    },
    [ingestFiles],
  );

  const handleFolderPick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAppState('processing');
    setLibraryName(files[0].webkitRelativePath?.split('/')[0] || 'Selected folder');
    setProgressLabel(`Indexing ${files.length} videos…`);
    const withIds = files.map((f, i) => {
      f.id = `f-${i}-${f.name}`;
      return f;
    });
    const processed = await processVideosBatch(withIds, {
      concurrency: 6,
      onProgress: (pct, done, total) => {
        setProgress(pct);
        setProgressLabel(`${done} / ${total} thumbnails`);
      },
    });
    setVideos(processed);
    setAppState('gallery');
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const extensions = useMemo(() => {
    const exts = new Set(videos.map((v) => v.name.split('.').pop().toLowerCase()));
    return Array.from(exts).sort();
  }, [videos]);

  const processedVideos = useMemo(() => {
    let result = [...videos];
    const q = searchQuery.trim().toLowerCase();
    if (q) result = result.filter((v) => v.name.toLowerCase().includes(q));
    if (filterExt !== 'all') {
      result = result.filter((v) => v.name.toLowerCase().endsWith(filterExt));
    }
    result.sort((a, b) => {
      switch (sortOption) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'size_asc':
          return a.size - b.size;
        case 'size_desc':
          return b.size - a.size;
        case 'date_asc':
          return a.createdAt - b.createdAt;
        case 'date_desc':
        default:
          return b.createdAt - a.createdAt;
      }
    });
    return result;
  }, [videos, sortOption, filterExt, searchQuery]);

  const totalSize = useMemo(
    () => videos.reduce((s, v) => s + v.size, 0),
    [videos],
  );

  const openVideo = (video) => {
    const idx = processedVideos.findIndex((v) => v.id === video.id);
    setCurrentIndex(idx);
    setCurrentVideo(video);
  };

  const playAdjacent = (delta) => {
    if (!processedVideos.length) return;
    const next = Math.min(
      processedVideos.length - 1,
      Math.max(0, currentIndex + delta),
    );
    setCurrentIndex(next);
    setCurrentVideo(processedVideos[next]);
  };

  if (appState === 'welcome') {
    return (
      <div className="welcome-screen">
        <h1 className="dtube-title">
          D<span>Tube</span>
        </h1>
        <p className="welcome-sub">
          Local-first video library — no upload, no cloud. Fast scan, hover previews, offline playback.
        </p>
        <div
          className={`dropzone ${isDragging ? 'active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="dropzone-icon">▶</div>
          <h2>Drag a folder here</h2>
          <p>Recursive scan · mp4, webm, mov, mkv, avi, m4v</p>
          <div className="welcome-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => folderInputRef.current?.click()}
            >
              Choose folder…
            </button>
            <input
              ref={folderInputRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              hidden
              onChange={handleFolderPick}
            />
          </div>
        </div>
        <ul className="welcome-features">
          <li>Parallel thumbnail extraction</li>
          <li>Search, sort, and filter</li>
          <li>Keyboard player controls</li>
          <li>IndexedDB-ready hooks for watch progress (coming soon)</li>
        </ul>
      </div>
    );
  }

  if (appState === 'processing') {
    return (
      <div className="welcome-screen">
        <h1 className="dtube-title">
          D<span>Tube</span>
        </h1>
        <div className="glass-panel progress-panel">
          <h2>{progressLabel || 'Processing…'}</h2>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p>{progress}%</p>
        </div>
      </div>
    );
  }

  const minCol = gridCols === 'compact' ? 220 : gridCols === 'wide' ? 380 : 280;

  return (
    <div className={`app-container ${currentVideo ? 'player-active' : ''}`}>
      <div id="app-background" />

      {currentVideo && (
        <VideoPlayer
          video={currentVideo}
          hasNext={currentIndex < processedVideos.length - 1}
          hasPrev={currentIndex > 0}
          onNext={() => playAdjacent(1)}
          onPrev={() => playAdjacent(-1)}
          onClose={() => {
            setCurrentVideo(null);
            setCurrentIndex(-1);
          }}
        />
      )}

      <header className="header glass">
        <div className="header-left">
          <span className="logo-mark">▶</span>
          <div>
            <h1 className="header-title">DTube</h1>
            <p className="header-meta">
              {libraryName || 'Library'} · {videos.length} files · {formatBytes(totalSize)}
              {searchQuery && ` · ${processedVideos.length} shown`}
            </p>
          </div>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => folderInputRef.current?.click()}
          >
            Add folder
          </button>
          <input
            ref={folderInputRef}
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            hidden
            onChange={handleFolderPick}
          />
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setAppState('welcome');
              setVideos([]);
              setLibraryName('');
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar glass">
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
          />
        </aside>

        <main className="content-area">
          {processedVideos.length === 0 ? (
            <div className="empty-state glass">
              <p>No videos match your filters.</p>
              <button type="button" className="btn-ghost" onClick={() => setSearchQuery('')}>
                Clear search
              </button>
            </div>
          ) : (
            <div
              className="video-grid"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${minCol}px, 1fr))`,
              }}
            >
              {processedVideos.map((video) => (
                <VideoCard key={video.id} video={video} onClick={() => openVideo(video)} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

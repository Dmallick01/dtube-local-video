import React, { useState, useCallback, useMemo } from 'react';
import './App.css';
import { scanFiles } from './utils/fileScanner';
import { generateThumbnail } from './utils/thumbnailGenerator';
import VideoCard from './components/VideoCard';
import SidebarControls from './components/SidebarControls';
import VideoPlayer from './components/VideoPlayer';

function App() {
  const [appState, setAppState] = useState('welcome'); // 'welcome', 'processing', 'gallery'
  const [videos, setVideos] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Controls state
  const [sortOption, setSortOption] = useState('date_desc');
  const [filterExt, setFilterExt] = useState('all');

  // Player state
  const [currentVideo, setCurrentVideo] = useState(null);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.items) {
      setAppState('processing');
      const files = await scanFiles(e.dataTransfer.items);
      
      const processedVideos = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const thumbUrl = await generateThumbnail(file);
        
        processedVideos.push({
          id: file.id,
          name: file.name,
          file: file, // Keep reference to File object
          size: file.size,
          createdAt: file.lastModified,
          thumbnail: thumbUrl
        });
        
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }
      
      setVideos(processedVideos);
      setAppState('gallery');
    }
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Compute extensions for filter
  const extensions = useMemo(() => {
    const exts = new Set(videos.map(v => v.name.split('.').pop().toLowerCase()));
    return Array.from(exts).sort();
  }, [videos]);

  // Apply filter and sort
  const processedVideos = useMemo(() => {
    let result = [...videos];

    if (filterExt !== 'all') {
      result = result.filter(v => v.name.toLowerCase().endsWith(filterExt));
    }

    result.sort((a, b) => {
      switch (sortOption) {
        case 'name_asc': return a.name.localeCompare(b.name);
        case 'name_desc': return b.name.localeCompare(a.name);
        case 'size_asc': return a.size - b.size;
        case 'size_desc': return b.size - a.size;
        case 'date_asc': return a.createdAt - b.createdAt;
        case 'date_desc': return b.createdAt - a.createdAt;
        default: return 0;
      }
    });

    return result;
  }, [videos, sortOption, filterExt]);

  if (appState === 'welcome') {
    return (
      <div className="welcome-screen">
        <h1 className="dtube-title">D<span>Tube</span></h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', fontSize: '1.2rem' }}>
          Drop your folders here to initialize your gallery.
        </p>
        <div 
          className={`dropzone ${isDragging ? 'active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(0, 210, 106, 0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', marginBottom: '8px' }}>Drag & Drop Folders</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Supports recursive scanning</p>
        </div>
      </div>
    );
  }

  if (appState === 'processing') {
    return (
      <div className="welcome-screen">
        <h1 className="dtube-title">D<span>Tube</span></h1>
        <div className="glass-panel" style={{ padding: '40px', width: '80%', maxWidth: '600px', textAlign: 'center', marginTop: '40px' }}>
          <h2 style={{ marginBottom: '20px' }}>Extracting Thumbnails...</h2>
          <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-green)', transition: 'width 0.2s' }}></div>
          </div>
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>{progress}% Complete</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-container ${currentVideo ? 'player-active' : ''}`}>
      <div id="app-background"></div>
      
      {currentVideo && (
        <VideoPlayer 
          video={currentVideo} 
          onClose={() => setCurrentVideo(null)} 
        />
      )}

      <header className="header">
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.5rem', color: 'var(--accent-green)' }}>▶</span> DTube
        </h1>
        <button 
          onClick={() => { setAppState('welcome'); setVideos([]); }}
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
          onMouseOut={e => e.target.style.background = 'transparent'}
        >
          Load New Folder
        </button>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <h2 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
            Regulatory Module
          </h2>
          <SidebarControls 
            sortOption={sortOption}
            setSortOption={setSortOption}
            filterExt={filterExt}
            setFilterExt={setFilterExt}
            extensions={extensions}
          />
        </aside>

        <main className="content-area">
          <div className="video-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px'
          }}>
            {processedVideos.map(video => (
              <VideoCard 
                key={video.id} 
                video={video} 
                onClick={() => setCurrentVideo(video)} 
              />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;

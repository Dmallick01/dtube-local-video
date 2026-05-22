import React, { useRef, useState, useEffect } from 'react';

const VideoPlayer = ({ video, onClose }) => {
  const videoRef = useRef(null);
  const wrapperRef = useRef(null);
  
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    const url = URL.createObjectURL(video.file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      // Call requestFullscreen directly on the video wrapper to hide all browser UI
      wrapperRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleSpeedChange = (delta) => {
    let newSpeed = speed + delta;
    if (newSpeed < 0.25) newSpeed = 0.25;
    if (newSpeed > 4) newSpeed = 4;
    setSpeed(newSpeed);
    if (videoRef.current) videoRef.current.playbackRate = newSpeed;
  };

  const handleVolumeChange = (delta) => {
    let newVol = volume + delta;
    if (newVol < 0) newVol = 0;
    if (newVol > 1) newVol = 1;
    setVolume(newVol);
    if (videoRef.current) videoRef.current.volume = newVol;
  };

  const handleZoomChange = (delta) => {
    let newZoom = zoom + delta;
    if (newZoom < 0.5) newZoom = 0.5;
    if (newZoom > 5) newZoom = 5;
    setZoom(newZoom);
  };

  return (
    <div 
      className="player-overlay"
      style={{
        position: 'fixed',
        top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      {!isFullscreen && (
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '32px', left: '32px',
            background: 'rgba(255,255,255,0.1)', color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '10px 20px', borderRadius: '12px',
            cursor: 'pointer', fontSize: '1rem', fontWeight: 500,
            zIndex: 10001, transition: 'background 0.2s'
          }}
          onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.2)'}
          onMouseOut={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
        >
          ← Back to Gallery
        </button>
      )}

      <div 
        ref={wrapperRef}
        style={{
          width: isFullscreen ? '100%' : '90%', 
          maxWidth: isFullscreen ? '100%' : '1600px',
          height: isFullscreen ? '100%' : 'auto',
          display: 'flex', flexDirection: 'column',
          background: '#000', 
          borderRadius: isFullscreen ? '0' : '16px', 
          overflow: 'hidden',
          boxShadow: isFullscreen ? 'none' : '0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.1)'
        }}
      >
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#000' }}>
          {videoUrl && (
            <video 
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              style={{ 
                width: '100%', 
                maxHeight: isFullscreen ? '100vh' : '75vh', 
                objectFit: 'contain', 
                outline: 'none',
                transform: `scale(${zoom})`,
                transition: 'transform 0.2s ease-out'
              }}
            />
          )}
        </div>
        
        {/* Custom Quick Controls Bar */}
        {!isFullscreen && (
          <div style={{
            padding: '20px 32px',
            background: 'rgba(20,20,20,0.95)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', color: '#fff', marginBottom: '4px', fontWeight: 600 }}>{video.name}</h2>
              <p style={{ color: 'rgba(235,235,245,0.6)', fontSize: '0.9rem' }}>
                {(video.size / (1024 * 1024)).toFixed(2)} MB • Local File
              </p>
            </div>

            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Zoom Control */}
              <div style={controlGroupStyle}>
                <span style={controlLabelStyle}>Zoom: {zoom.toFixed(1)}x</span>
                <button onClick={() => handleZoomChange(-0.2)} style={btnStyle}>-</button>
                <button onClick={() => handleZoomChange(0.2)} style={btnStyle}>+</button>
              </div>

              {/* Speed Control */}
              <div style={controlGroupStyle}>
                <span style={controlLabelStyle}>Speed: {speed.toFixed(2)}x</span>
                <button onClick={() => handleSpeedChange(-0.25)} style={btnStyle}>-</button>
                <button onClick={() => handleSpeedChange(0.25)} style={btnStyle}>+</button>
              </div>
              
              {/* Volume Control */}
              <div style={controlGroupStyle}>
                <span style={controlLabelStyle}>Vol: {Math.round(volume * 100)}%</span>
                <button onClick={() => handleVolumeChange(-0.1)} style={btnStyle}>-</button>
                <button onClick={() => handleVolumeChange(0.1)} style={btnStyle}>+</button>
              </div>

              {/* Fullscreen Toggle */}
              <button 
                onClick={toggleFullscreen} 
                style={{ 
                  ...btnStyle, 
                  width: 'auto', 
                  padding: '10px 24px', 
                  background: 'var(--accent-color)',
                  border: 'none',
                  borderRadius: '12px'
                }}
                onMouseOver={e => e.target.style.background = 'var(--accent-hover)'}
                onMouseOut={e => e.target.style.background = 'var(--accent-color)'}
              >
                Fullscreen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const controlGroupStyle = { 
  display: 'flex', alignItems: 'center', gap: '8px', 
  background: 'rgba(255,255,255,0.05)', padding: '6px 12px', 
  borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' 
};

const controlLabelStyle = { color: 'rgba(235,235,245,0.8)', fontSize: '0.9rem', fontWeight: 500, minWidth: '80px' };

const btnStyle = {
  background: 'rgba(255,255,255,0.15)',
  color: 'white', border: 'none',
  width: '32px', height: '32px',
  borderRadius: '8px', cursor: 'pointer',
  display: 'flex', justifyContent: 'center', alignItems: 'center',
  fontWeight: 'bold', fontSize: '1rem',
  transition: 'background 0.2s'
};

export default VideoPlayer;

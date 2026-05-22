import React, { useRef, useState, useEffect } from 'react';

const VideoPlayer = ({ video, onClose, onNext, onPrev, hasNext, hasPrev }) => {
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case 'Escape':
          if (!document.fullscreenElement) onClose();
          break;
        case ' ':
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) videoRef.current.play();
            else videoRef.current.pause();
          }
          break;
        case 'ArrowRight':
          if (e.shiftKey && hasNext) onNext?.();
          else if (videoRef.current) videoRef.current.currentTime += 5;
          break;
        case 'ArrowLeft':
          if (e.shiftKey && hasPrev) onPrev?.();
          else if (videoRef.current) videoRef.current.currentTime -= 5;
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'n':
        case 'N':
          if (hasNext) onNext?.();
          break;
        case 'p':
        case 'P':
          if (hasPrev) onPrev?.();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev, hasNext, hasPrev]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen?.().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  const handleSpeedChange = (delta) => {
    let newSpeed = Math.min(4, Math.max(0.25, speed + delta));
    setSpeed(newSpeed);
    if (videoRef.current) videoRef.current.playbackRate = newSpeed;
  };

  const handleVolumeChange = (delta) => {
    let newVol = Math.min(1, Math.max(0, volume + delta));
    setVolume(newVol);
    if (videoRef.current) videoRef.current.volume = newVol;
  };

  const handleZoomChange = (delta) => {
    setZoom((z) => Math.min(5, Math.max(0.5, z + delta)));
  };

  return (
    <div className="player-overlay">
      {!isFullscreen && (
        <button type="button" className="player-back" onClick={onClose}>
          ← Gallery
        </button>
      )}

      <div
        ref={wrapperRef}
        className={`player-shell ${isFullscreen ? 'fullscreen' : ''}`}
      >
        <div className="player-video-wrap">
          {videoUrl && (
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              className="player-video"
              style={{ transform: `scale(${zoom})` }}
            />
          )}
        </div>

        {!isFullscreen && (
          <div className="player-bar">
            <div className="player-meta">
              <h2>{video.name}</h2>
              <p>
                {(video.size / (1024 * 1024)).toFixed(2)} MB · Space play/pause · ←/→ seek ·
                Shift+←/→ prev/next · F fullscreen
              </p>
            </div>
            <div className="player-controls">
              <button type="button" disabled={!hasPrev} onClick={onPrev} className="player-btn">
                ⏮
              </button>
              <button type="button" disabled={!hasNext} onClick={onNext} className="player-btn">
                ⏭
              </button>
              <div className="player-group">
                <span>Zoom {zoom.toFixed(1)}×</span>
                <button type="button" onClick={() => handleZoomChange(-0.2)}>−</button>
                <button type="button" onClick={() => handleZoomChange(0.2)}>+</button>
              </div>
              <div className="player-group">
                <span>{speed.toFixed(2)}×</span>
                <button type="button" onClick={() => handleSpeedChange(-0.25)}>−</button>
                <button type="button" onClick={() => handleSpeedChange(0.25)}>+</button>
              </div>
              <div className="player-group">
                <span>{Math.round(volume * 100)}%</span>
                <button type="button" onClick={() => handleVolumeChange(-0.1)}>−</button>
                <button type="button" onClick={() => handleVolumeChange(0.1)}>+</button>
              </div>
              <button type="button" className="player-btn-accent" onClick={toggleFullscreen}>
                Fullscreen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;

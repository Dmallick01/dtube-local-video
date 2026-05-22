import React, { useState, useRef, useEffect } from 'react';

const VideoCard = ({
  video,
  onClick,
  isFavorite,
  onToggleFavorite,
  watchSeconds,
  onAddQueue,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const ext = video.name.split('.').pop().toLowerCase();
  const isNativePlayable = ['mp4', 'webm', 'mov', 'm4v'].includes(ext);

  const handleMouseEnter = () => {
    if (!isNativePlayable) return;
    timeoutRef.current = setTimeout(() => {
      if (!previewUrl) setPreviewUrl(URL.createObjectURL(video.file));
      setIsHovered(true);
      videoRef.current?.play().catch(() => {});
    }, 400);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setIsHovered(false);
    videoRef.current?.pause();
  };

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <div
      className="video-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <div className={`thumbnail-container ${!video.thumbnail ? 'skeleton-pulse' : ''}`}>
        {!isHovered && video.thumbnail && (
          <img src={video.thumbnail} alt="" />
        )}
        {isHovered && previewUrl && (
          <video ref={videoRef} src={previewUrl} muted loop playsInline />
        )}
        {watchSeconds > 30 && (
          <span
            className="progress-badge"
            style={{ position: 'absolute', bottom: 8, left: 8, background: 'var(--cbg)' }}
          >
            resume
          </span>
        )}
      </div>
      <div className="video-info">
        <button
          type="button"
          className={`star-btn ${isFavorite ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-label="Favorite"
        >
          {isFavorite ? '★' : '☆'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 title={video.relativePath || video.name}>{video.name}</h3>
          <p className="video-meta-line">
            {(video.size / (1024 * 1024)).toFixed(2)} MB ·{' '}
            {new Date(video.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button
          type="button"
          className="btn"
          style={{ padding: '4px 8px', fontSize: 10 }}
          onClick={(e) => {
            e.stopPropagation();
            onAddQueue?.();
          }}
        >
          +Q
        </button>
      </div>
    </div>
  );
};

export default VideoCard;

import React, { useState, useRef } from 'react';

const VideoCard = ({
  video,
  onClick,
  isFavorite,
  onToggleFavorite,
  watchSeconds,
  onAddQueue,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef(null);

  const canPreview = !!(video.previewGifUrl && video.hasPreviewGif);

  const formatPreviewLabel = () => {
    if (!video.duration) return 'GIF';
    const s = ((video.previewStart / video.duration) * 100).toFixed(0);
    const e = ((video.previewEnd / video.duration) * 100).toFixed(0);
    return `${s}–${e}%`;
  };

  const handleMouseEnter = () => {
    if (!canPreview) return;
    timeoutRef.current = setTimeout(() => setIsHovered(true), 200);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setIsHovered(false);
  };

  return (
    <div
      className="video-card"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <div className={`thumbnail-container ${!video.thumbnail && !canPreview ? 'skeleton-pulse' : ''}`}>
        {isHovered && canPreview ? (
          <img src={video.previewGifUrl} alt="" className="hover-preview-gif" />
        ) : (
          video.thumbnail && <img src={video.thumbnail} alt="" />
        )}
        {!canPreview && !video.thumbnail && (
          <span className="preview-badge">no preview</span>
        )}
        {canPreview && (
          <span className="preview-badge">{formatPreviewLabel()}</span>
        )}
        {watchSeconds > 30 && (
          <span className="progress-badge resume-badge">resume</span>
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
            {(video.size / (1024 * 1024)).toFixed(2)} MB
            {video.duration > 0 && ` · ${Math.floor(video.duration / 60)}:${String(Math.floor(video.duration % 60)).padStart(2, '0')}`}
            {' · '}
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

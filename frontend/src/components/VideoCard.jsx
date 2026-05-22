import React, { useState, useRef, useEffect, useCallback } from 'react';

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

  const canPreview =
    video.previewPlayable &&
    video.duration > 0 &&
    video.previewEnd > video.previewStart;

  const formatPreviewLabel = () => {
    if (!video.duration) return '';
    const s = ((video.previewStart / video.duration) * 100).toFixed(0);
    const e = ((video.previewEnd / video.duration) * 100).toFixed(0);
    return `${s}–${e}%`;
  };

  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el || !canPreview) return;
    if (el.currentTime >= video.previewEnd - 0.05) {
      el.currentTime = video.previewStart;
    }
  }, [canPreview, video.previewStart, video.previewEnd]);

  const startPreview = async () => {
    if (!canPreview) return;
    if (!previewUrl) setPreviewUrl(URL.createObjectURL(video.file));
    setIsHovered(true);
    const el = videoRef.current;
    if (!el) return;
    const onReady = () => {
      el.currentTime = video.previewStart;
      el.play().catch(() => {});
    };
    if (el.readyState >= 1) onReady();
    else el.addEventListener('loadedmetadata', onReady, { once: true });
  };

  const handleMouseEnter = () => {
    if (!canPreview) return;
    timeoutRef.current = setTimeout(startPreview, 350);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    setIsHovered(false);
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.removeEventListener('timeupdate', handleTimeUpdate);
    }
  };

  useEffect(() => {
    const el = videoRef.current;
    if (isHovered && el) {
      el.addEventListener('timeupdate', handleTimeUpdate);
      return () => el.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [isHovered, handleTimeUpdate]);

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
      <div className={`thumbnail-container ${!video.thumbnail && !isHovered ? 'skeleton-pulse' : ''}`}>
        {!isHovered && video.thumbnail && <img src={video.thumbnail} alt="" />}
        {isHovered && previewUrl && (
          <video ref={videoRef} src={previewUrl} muted playsInline className="hover-preview-video" />
        )}
        {!isHovered && !video.thumbnail && !canPreview && (
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

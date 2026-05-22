import React, { useState, useRef, useEffect } from 'react';

const VideoCard = ({ video, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const videoRef = useRef(null);
  const timeoutRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // Browsers generally only support playing these natively
  const ext = video.name.split('.').pop().toLowerCase();
  const isNativePlayable = ['mp4', 'webm', 'mov'].includes(ext);

  const handleMouseEnter = () => {
    if (!isNativePlayable) return;
    
    timeoutRef.current = setTimeout(() => {
      // Create local URL for preview on demand
      if (!previewUrl) {
        setPreviewUrl(URL.createObjectURL(video.file));
      }
      setIsHovered(true);
      if (videoRef.current) {
        videoRef.current.play().catch(err => console.log('Playback error:', err));
      }
    }, 400);
  };

  const handleMouseLeave = () => {
    if (!isNativePlayable) return;
    
    clearTimeout(timeoutRef.current);
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div 
      className="video-card glass"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), box-shadow 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isHovered ? 'var(--shadow-lg)' : 'var(--shadow-md)',
        transform: isHovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
      }}
    >
      <div className={`thumbnail-container ${!video.thumbnail ? 'skeleton-pulse' : ''}`} style={{
        position: 'relative',
        width: '100%',
        paddingTop: '56.25%', // 16:9 aspect ratio
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}>
        {!isHovered ? (
          video.thumbnail && (
            <img 
              src={video.thumbnail} 
              alt={video.name}
              style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                objectFit: 'cover'
              }}
            />
          )
        ) : (
          <video 
            ref={videoRef}
            src={previewUrl}
            muted
            loop
            playsInline
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
        
        {!isNativePlayable && video.thumbnail && (
          <div style={{
            position: 'absolute', bottom: '8px', right: '8px',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            padding: '2px 6px', borderRadius: '4px',
            fontSize: '0.7rem', color: '#fff', fontWeight: 600, letterSpacing: '1px'
          }}>
            {ext.toUpperCase()}
          </div>
        )}
      </div>
      
      <div className="video-info" style={{ 
        padding: '16px', background: 'rgba(20,20,20,0.4)',
        borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
        <h3 style={{ 
          fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '6px'
        }} title={video.name}>
          {video.name}
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {(video.size / (1024 * 1024)).toFixed(2)} MB • {new Date(video.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default VideoCard;

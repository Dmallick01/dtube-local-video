import React, { useRef, useState, useEffect, useCallback } from 'react';
import { getWatchProgress, setWatchProgress } from '../lib/storage';

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const VideoPlayer = ({
  video,
  subtitleUrl,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  onShowShortcuts,
  playWithSound = true,
}) => {
  const videoRef = useRef(null);
  const wrapperRef = useRef(null);
  const saveTimer = useRef(null);
  const playAttempted = useRef(false);

  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [pipActive, setPipActive] = useState(false);
  const [needsClickToPlay, setNeedsClickToPlay] = useState(false);

  useEffect(() => {
    playAttempted.current = false;
    setNeedsClickToPlay(false);
    const url = URL.createObjectURL(video.file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  const applyAudio = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = muted;
    el.volume = volume;
  }, [muted, volume]);

  const startPlayback = useCallback(async () => {
    const el = videoRef.current;
    if (!el || playAttempted.current) return;
    playAttempted.current = true;
    el.muted = false;
    el.volume = volume;
    setMuted(false);
    try {
      await el.play();
      setNeedsClickToPlay(false);
    } catch {
      setNeedsClickToPlay(true);
    }
  }, [volume]);

  useEffect(() => {
    applyAudio();
  }, [applyAudio, videoUrl]);

  const saveProgress = useCallback(() => {
    const el = videoRef.current;
    if (!el || !video.id) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setWatchProgress(video.id, el.currentTime);
    }, 800);
  }, [video.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    getWatchProgress(video.id).then((t) => {
      if (t > 5 && el.duration && t < el.duration - 10) {
        el.currentTime = t;
      }
    });
  }, [video.id, videoUrl]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoUrl || !playWithSound) return;

    const onReady = () => startPlayback();
    if (el.readyState >= 2) onReady();
    else el.addEventListener('canplay', onReady, { once: true });
    return () => el.removeEventListener('canplay', onReady);
  }, [videoUrl, playWithSound, startPlayback]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT') return;
      switch (e.key) {
        case 'Escape':
          if (!document.fullscreenElement && !document.pictureInPictureElement) onClose();
          break;
        case ' ':
          e.preventDefault();
          if (videoRef.current?.paused) startPlayback();
          else videoRef.current?.pause();
          break;
        case 'm':
        case 'M':
          setMuted((m) => {
            const next = !m;
            if (videoRef.current) videoRef.current.muted = next;
            return next;
          });
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
        case 'i':
        case 'I':
          togglePiP();
          break;
        case 'n':
        case 'N':
          if (hasNext) onNext?.();
          break;
        case 'p':
        case 'P':
          if (hasPrev) onPrev?.();
          break;
        case '?':
          onShowShortcuts?.();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onPrev, hasNext, hasPrev, onShowShortcuts, startPlayback]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    const onPip = () => setPipActive(!!document.pictureInPictureElement);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('enterpictureinpicture', onPip);
    document.addEventListener('leavepictureinpicture', onPip);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('enterpictureinpicture', onPip);
      document.removeEventListener('leavepictureinpicture', onPip);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen?.().catch(console.error);
    } else {
      document.exitFullscreen();
    }
  };

  const togglePiP = async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await el.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP unavailable', err);
    }
  };

  const applySpeed = (rate) => {
    setSpeed(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  };

  return (
    <div className="player-overlay">
      <div className="player-topbar">
        <button type="button" className="btn" onClick={onClose}>
          ← Gallery
        </button>
        <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {video.name}
        </span>
        <button type="button" className="btn" onClick={onShowShortcuts}>
          ?
        </button>
      </div>

      <div ref={wrapperRef} className={`player-shell ${isFullscreen ? 'fullscreen' : ''}`}>
        <div className="player-video-wrap">
          {videoUrl && (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                className="player-video"
                onTimeUpdate={saveProgress}
                onVolumeChange={() => {
                  const el = videoRef.current;
                  if (!el) return;
                  setMuted(el.muted);
                  setVolume(el.volume);
                }}
              />
              {needsClickToPlay && (
                <button
                  type="button"
                  className="player-play-overlay btn btn-primary"
                  onClick={startPlayback}
                >
                  Play with sound
                </button>
              )}
            </>
          )}
        </div>

        {!isFullscreen && (
          <div className="player-bar">
            <div className="player-meta">
              <h2>{video.name}</h2>
              <p>
                Space play/pause · M mute · ←/→ seek · Shift+←/→ queue · N/P · F fullscreen · I PiP
                {pipActive ? ' · PiP on' : ''}
                {subtitleUrl ? ' · subtitles' : ''}
              </p>
            </div>
            <div className="player-controls" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button type="button" disabled={!hasPrev} onClick={onPrev} className="player-group">
                ⏮
              </button>
              <button type="button" disabled={!hasNext} onClick={onNext} className="player-group">
                ⏭
              </button>
              <button type="button" className={`btn ${muted ? '' : 'btn-primary'}`} onClick={toggleMute}>
                {muted ? 'Unmute' : 'Sound on'}
              </button>
              <div className="speed-chips">
                {SPEED_PRESETS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={speed === r ? 'active' : ''}
                    onClick={() => applySpeed(r)}
                  >
                    {r}×
                  </button>
                ))}
              </div>
              <div className="player-group">
                <span>{Math.round(volume * 100)}%</span>
                <button
                  type="button"
                  onClick={() => {
                    const v = Math.min(1, volume + 0.1);
                    setVolume(v);
                    if (videoRef.current) {
                      videoRef.current.volume = v;
                      videoRef.current.muted = false;
                      setMuted(false);
                    }
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const v = Math.max(0, volume - 0.1);
                    setVolume(v);
                    if (videoRef.current) videoRef.current.volume = v;
                  }}
                >
                  −
                </button>
              </div>
              <button type="button" className="btn" onClick={togglePiP}>
                PiP
              </button>
              <button type="button" className="btn" onClick={toggleFullscreen}>
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

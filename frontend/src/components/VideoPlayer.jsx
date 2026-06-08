import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  getWatchProgress,
  setWatchProgress,
  getCachedTranscript,
  cacheTranscript,
  getCaptionModel,
  setCaptionModel,
  getCachedSilence,
  cacheSilence,
  getNotes,
  saveNotes,
  getCachedSummary,
  cacheSummary,
  getCachedQuiz,
  cacheQuiz,
} from '../lib/storage';
import { cuesToVttUrl } from '../lib/subtitles';
import { transcribeLocally, TRANSCRIPTION_MODELS } from '../lib/transcription';
import { detectSilence } from '../lib/silence';
import { deriveChapters } from '../lib/chapters';
import { downloadStudySheet } from '../lib/studySheet';
import { isWebLLMSupported, summarizeTranscript, generateQuiz } from '../lib/studyAssist';
import NotesPanel from './NotesPanel';
import ChaptersPanel from './ChaptersPanel';
import StudyAidsPanel from './StudyAidsPanel';

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function describeTranscribeStatus(status) {
  if (!status) return '';
  switch (status.phase) {
    case 'loading-model':
      return status.progress != null
        ? `Downloading caption model… ${Math.round(status.progress * 100)}%`
        : 'Loading caption model…';
    case 'decoding-audio':
      return 'Decoding audio…';
    case 'transcribing':
      return 'Transcribing speech… (slower on CPU-only machines)';
    case 'starting':
      return 'Starting…';
    default:
      return 'Generating captions…';
  }
}

function formatCueTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const VideoPlayer = ({
  video,
  subtitleUrl,
  onTranscriptReady,
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
  const [currentTime, setCurrentTime] = useState(0);

  const [genCues, setGenCues] = useState(null);
  const [genSubtitleUrl, setGenSubtitleUrl] = useState('');
  const [transcribeStatus, setTranscribeStatus] = useState(null);
  const [transcribeError, setTranscribeError] = useState('');
  const [activePanel, setActivePanel] = useState(null);
  const [captionModel, setCaptionModelState] = useState(getCaptionModel);

  const [silenceRanges, setSilenceRanges] = useState(null);
  const [silenceStatus, setSilenceStatus] = useState(null);
  const [skipSilenceOn, setSkipSilenceOn] = useState(false);

  const [loopA, setLoopA] = useState(null);
  const [loopB, setLoopB] = useState(null);
  const [loopOn, setLoopOn] = useState(false);

  const [notes, setNotes] = useState([]);

  const [summary, setSummary] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [studyStatus, setStudyStatus] = useState(null);
  const [studyError, setStudyError] = useState('');

  const togglePanel = (name) => setActivePanel((p) => (p === name ? null : name));

  const handleCaptionModelChange = (e) => {
    const next = e.target.value;
    setCaptionModelState(next);
    setCaptionModel(next);
  };

  useEffect(() => {
    playAttempted.current = false;
    setNeedsClickToPlay(false);
    const url = URL.createObjectURL(video.file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  // Reset any generated-caption state for the new video and check the transcript
  // cache (IndexedDB) before offering to generate one from scratch.
  useEffect(() => {
    setGenCues(null);
    setGenSubtitleUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setTranscribeStatus(null);
    setTranscribeError('');
    setActivePanel(null);

    setSilenceRanges(null);
    setSilenceStatus(null);
    setSkipSilenceOn(false);
    setLoopA(null);
    setLoopB(null);
    setLoopOn(false);
    setNotes([]);
    setSummary(null);
    setQuiz(null);
    setStudyStatus(null);
    setStudyError('');

    let cancelled = false;
    if (video.id) {
      getCachedTranscript(video.id).then((cues) => {
        if (cancelled || !cues?.length) return;
        setGenCues(cues);
        setGenSubtitleUrl(cuesToVttUrl(cues));
        onTranscriptReady?.(video.id, cues);
      });
      getCachedSilence(video.id).then((ranges) => {
        if (!cancelled && ranges) setSilenceRanges(ranges);
      });
      getNotes(video.id).then((stored) => {
        if (!cancelled) setNotes(stored);
      });
      getCachedSummary(video.id).then((stored) => {
        if (!cancelled && stored) setSummary(stored);
      });
      getCachedQuiz(video.id).then((stored) => {
        if (!cancelled && stored) setQuiz(stored);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [video, onTranscriptReady]);

  const handleGenerateCaptions = useCallback(async () => {
    if (transcribeStatus || genCues) return;
    setTranscribeError('');
    setTranscribeStatus({ phase: 'starting', progress: null });
    try {
      const cues = await transcribeLocally(video.file, {
        model: captionModel,
        onProgress: (info) => setTranscribeStatus(info),
      });
      if (!cues.length) throw new Error('No speech detected in this video.');
      setGenCues(cues);
      setGenSubtitleUrl(cuesToVttUrl(cues));
      setActivePanel('transcript');
      if (video.id) {
        cacheTranscript(video.id, cues);
        onTranscriptReady?.(video.id, cues);
      }
    } catch (err) {
      setTranscribeError(err?.message || 'Caption generation failed.');
    } finally {
      setTranscribeStatus(null);
    }
  }, [video, transcribeStatus, genCues, captionModel, onTranscriptReady]);

  const handleToggleSkipSilence = useCallback(async () => {
    if (skipSilenceOn) {
      setSkipSilenceOn(false);
      return;
    }
    if (silenceRanges) {
      setSkipSilenceOn(true);
      return;
    }
    setSilenceStatus({ phase: 'decoding-audio', progress: null });
    try {
      const ranges = await detectSilence(video.file, setSilenceStatus);
      setSilenceRanges(ranges);
      setSkipSilenceOn(true);
      if (video.id) cacheSilence(video.id, ranges);
    } catch (err) {
      console.warn('Silence detection failed', err);
    } finally {
      setSilenceStatus(null);
    }
  }, [video, skipSilenceOn, silenceRanges]);

  const handleSetLoopA = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setLoopA(el.currentTime);
    setLoopOn(false);
  }, []);

  const handleSetLoopB = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setLoopB(el.currentTime);
    setLoopOn(false);
  }, []);

  const handleToggleLoop = useCallback(() => {
    setLoopOn((on) => (loopA == null || loopB == null ? on : !on));
  }, [loopA, loopB]);

  const handleAddNote = useCallback((text) => {
    const el = videoRef.current;
    if (!el || !video.id) return;
    const note = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: el.currentTime,
      text,
      createdAt: Date.now(),
    };
    setNotes((prev) => {
      const next = [...prev, note];
      saveNotes(video.id, next);
      return next;
    });
  }, [video]);

  const handleDeleteNote = useCallback((noteId) => {
    if (!video.id) return;
    setNotes((prev) => {
      const next = prev.filter((n) => n.id !== noteId);
      saveNotes(video.id, next);
      return next;
    });
  }, [video]);

  const chapters = useMemo(() => deriveChapters(genCues || []), [genCues]);

  const handleExportStudySheet = useCallback(() => {
    downloadStudySheet(video, { transcript: genCues, notes, chapters });
  }, [video, genCues, notes, chapters]);

  const handleSummarize = useCallback(async () => {
    if (!genCues?.length || studyStatus) return;
    setStudyError('');
    setStudyStatus({ phase: 'starting', progress: null });
    try {
      const bullets = await summarizeTranscript(genCues, setStudyStatus);
      setSummary(bullets);
      if (video.id) cacheSummary(video.id, bullets);
    } catch (err) {
      setStudyError(err?.message || 'Summary generation failed.');
    } finally {
      setStudyStatus(null);
    }
  }, [video, genCues, studyStatus]);

  const handleGenerateQuiz = useCallback(async () => {
    if (!genCues?.length || studyStatus) return;
    setStudyError('');
    setStudyStatus({ phase: 'starting', progress: null });
    try {
      const qa = await generateQuiz(genCues, setStudyStatus);
      setQuiz(qa);
      if (video.id) cacheQuiz(video.id, qa);
    } catch (err) {
      setStudyError(err?.message || 'Quiz generation failed.');
    } finally {
      setStudyStatus(null);
    }
  }, [video, genCues, studyStatus]);

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

  const seekTo = useCallback((time) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = time;
    if (el.paused) startPlayback();
  }, [startPlayback]);

  const seekToCue = (cue) => seekTo(cue.start);

  const saveProgress = useCallback(() => {
    const el = videoRef.current;
    if (!el || !video.id) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setWatchProgress(video.id, el.currentTime);
    }, 800);
  }, [video.id]);

  const handleTimeUpdate = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    saveProgress();
  }, [saveProgress]);

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

  // Skip-silence: jump past any cached quiet stretch the playhead enters
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !skipSilenceOn || !silenceRanges?.length) return;
    const onTime = () => {
      const t = el.currentTime;
      const hit = silenceRanges.find((r) => t >= r.start && t < r.end - 0.05);
      if (hit) el.currentTime = hit.end;
    };
    el.addEventListener('timeupdate', onTime);
    return () => el.removeEventListener('timeupdate', onTime);
  }, [skipSilenceOn, silenceRanges]);

  // A<->B loop: jump back to the earlier mark once playback reaches the later one
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !loopOn || loopA == null || loopB == null) return;
    const start = Math.min(loopA, loopB);
    const end = Math.max(loopA, loopB);
    const onTime = () => {
      if (el.currentTime >= end) el.currentTime = start;
    };
    el.addEventListener('timeupdate', onTime);
    return () => el.removeEventListener('timeupdate', onTime);
  }, [loopOn, loopA, loopB]);

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
        case 's':
        case 'S':
          handleToggleSkipSilence();
          break;
        case '[':
          handleSetLoopA();
          break;
        case ']':
          handleSetLoopB();
          break;
        case 'l':
        case 'L':
          handleToggleLoop();
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
  }, [
    onClose, onNext, onPrev, hasNext, hasPrev, onShowShortcuts, startPlayback,
    handleToggleSkipSilence, handleSetLoopA, handleSetLoopB, handleToggleLoop,
  ]);

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
                onTimeUpdate={handleTimeUpdate}
                onVolumeChange={() => {
                  const el = videoRef.current;
                  if (!el) return;
                  setMuted(el.muted);
                  setVolume(el.volume);
                }}
              >
                {(subtitleUrl || genSubtitleUrl) && (
                  <track
                    key={subtitleUrl || genSubtitleUrl}
                    kind="subtitles"
                    srcLang="en"
                    label={subtitleUrl ? 'Subtitles' : 'Generated captions'}
                    src={subtitleUrl || genSubtitleUrl}
                    default
                  />
                )}
              </video>
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
                · S skip-silence · [ / ] mark A/B · L loop
                {pipActive ? ' · PiP on' : ''}
                {subtitleUrl ? ' · subtitles' : ''}
                {!subtitleUrl && genSubtitleUrl ? ' · generated captions' : ''}
              </p>
            </div>
            <div className="player-controls">
              <div className="control-cluster">
                <div className="player-group">
                  <button type="button" disabled={!hasPrev} onClick={onPrev}>
                    ⏮
                  </button>
                  <button type="button" disabled={!hasNext} onClick={onNext}>
                    ⏭
                  </button>
                </div>
              </div>

              <div className="control-cluster">
                <button
                  type="button"
                  className={`btn ${activePanel === 'transcript' ? 'btn-primary' : ''}`}
                  onClick={() => togglePanel('transcript')}
                  disabled={!genCues?.length}
                  title={genCues?.length ? 'Show the generated transcript' : 'Generate captions to unlock the transcript'}
                >
                  Transcript{genCues?.length ? ` (${genCues.length})` : ''}
                </button>
                <button
                  type="button"
                  className={`btn ${activePanel === 'chapters' ? 'btn-primary' : ''}`}
                  onClick={() => togglePanel('chapters')}
                  disabled={chapters.length < 2}
                  title={
                    chapters.length > 1
                      ? 'Jump between transcript-derived chapters'
                      : genCues?.length
                        ? "This video is too short or continuous to split into chapters"
                        : 'Generate captions to unlock chapters'
                  }
                >
                  Chapters{chapters.length > 1 ? ` (${chapters.length})` : ''}
                </button>
                <button
                  type="button"
                  className={`btn ${activePanel === 'notes' ? 'btn-primary' : ''}`}
                  onClick={() => togglePanel('notes')}
                  title="Timestamped notes for this video"
                >
                  Notes{notes.length ? ` (${notes.length})` : ''}
                </button>
                <button
                  type="button"
                  className={`btn ${activePanel === 'study' ? 'btn-primary' : ''}`}
                  onClick={() => togglePanel('study')}
                  title="AI summary & quiz, generated locally in your browser"
                >
                  Study aids
                </button>
              </div>

              {!subtitleUrl && !genCues && (
                <div className="control-cluster" style={{ minWidth: 0 }}>
                  {transcribeStatus ? (
                    <span style={{ fontSize: 11, color: 'var(--cdisabled)' }}>
                      {describeTranscribeStatus(transcribeStatus)}
                    </span>
                  ) : (
                    <>
                      <select
                        value={captionModel}
                        onChange={handleCaptionModelChange}
                        className="control-select"
                        title="Caption model — bigger is slower but more accurate"
                        style={{ fontSize: 11 }}
                      >
                        {Object.keys(TRANSCRIPTION_MODELS).map((key) => (
                          <option key={key} value={key}>
                            {key === 'base' ? 'base (slower, more accurate)' : 'tiny (fast, rough)'}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="btn" onClick={handleGenerateCaptions}>
                        Generate captions
                      </button>
                    </>
                  )}
                  {transcribeError && (
                    <span style={{ fontSize: 11, color: 'var(--c-danger)' }}>{transcribeError}</span>
                  )}
                </div>
              )}

              <div className="control-cluster">
                <button
                  type="button"
                  className={`btn ${skipSilenceOn ? 'btn-primary' : ''}`}
                  onClick={handleToggleSkipSilence}
                  disabled={!!silenceStatus}
                  title="Automatically skip over quiet stretches (S)"
                >
                  {silenceStatus ? 'Analyzing audio…' : skipSilenceOn ? 'Skipping silence' : 'Skip silence'}
                </button>
                <button type="button" className="btn" onClick={handleSetLoopA} title="Mark loop start at the current time ([)">
                  Set A{loopA != null ? ` ${formatCueTime(loopA)}` : ''}
                </button>
                <button type="button" className="btn" onClick={handleSetLoopB} title="Mark loop end at the current time (])">
                  Set B{loopB != null ? ` ${formatCueTime(loopB)}` : ''}
                </button>
                {loopA != null && loopB != null && (
                  <button
                    type="button"
                    className={`btn ${loopOn ? 'btn-primary' : ''}`}
                    onClick={handleToggleLoop}
                    title="Loop playback between A and B (L)"
                  >
                    {loopOn ? 'Looping' : 'Loop'} {formatCueTime(Math.min(loopA, loopB))}–{formatCueTime(Math.max(loopA, loopB))}
                  </button>
                )}
              </div>

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

              <div className="control-cluster">
                <button type="button" className={`btn ${muted ? '' : 'btn-primary'}`} onClick={toggleMute}>
                  {muted ? 'Unmute' : 'Sound on'}
                </button>
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
              </div>

              <div className="control-cluster">
                <button type="button" className="btn" onClick={togglePiP}>
                  PiP
                </button>
                <button type="button" className="btn" onClick={toggleFullscreen}>
                  Fullscreen
                </button>
              </div>
            </div>
          </div>
        )}

        {!isFullscreen && activePanel === 'transcript' && genCues?.length > 0 && (
          <div className="side-panel">
            <div className="side-panel-head">
              <span>Generated transcript · {genCues.length} lines · click a line to jump</span>
              <button type="button" className="btn" onClick={() => setActivePanel(null)}>
                Close
              </button>
            </div>
            <div className="side-panel-body">
              {genCues.map((cue, i) => (
                <button
                  key={`${cue.start}-${i}`}
                  type="button"
                  className="side-panel-row"
                  onClick={() => seekToCue(cue)}
                >
                  <span className="side-panel-row-time">{formatCueTime(cue.start)}</span>
                  <span className="side-panel-row-text">{cue.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!isFullscreen && activePanel === 'chapters' && chapters.length > 0 && (
          <ChaptersPanel chapters={chapters} onSeek={seekTo} onClose={() => setActivePanel(null)} />
        )}

        {!isFullscreen && activePanel === 'notes' && (
          <NotesPanel
            notes={notes}
            currentTime={currentTime}
            onAdd={handleAddNote}
            onDelete={handleDeleteNote}
            onSeek={seekTo}
            onExport={handleExportStudySheet}
            exportDisabled={!genCues?.length && !notes.length}
            onClose={() => setActivePanel(null)}
          />
        )}

        {!isFullscreen && activePanel === 'study' && (
          <StudyAidsPanel
            supported={isWebLLMSupported()}
            hasTranscript={!!genCues?.length}
            summary={summary}
            quiz={quiz}
            status={studyStatus}
            error={studyError}
            onSummarize={handleSummarize}
            onGenerateQuiz={handleGenerateQuiz}
            onClose={() => setActivePanel(null)}
          />
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;

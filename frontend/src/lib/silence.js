/**
 * Detect quiet stretches in a video's audio track so the player can skip over
 * dead air — handy for lecture recordings with long pauses, fumbling with slides, etc.
 *
 * Reuses decodeAudio() from lib/transcription.js (mono Float32Array @ 16kHz) and
 * scans it in fixed windows, measuring RMS energy per window. Runs of low-energy
 * windows longer than MIN_SILENCE_SEC are reported as { start, end } ranges (seconds),
 * the same shape the player already seeks with via cue.start/cue.end.
 */
import { decodeAudio } from './transcription';

const SAMPLE_RATE = 16000;
const WINDOW_SEC = 0.25;
const WINDOW_SIZE = Math.round(SAMPLE_RATE * WINDOW_SEC);
const SILENCE_RMS_THRESHOLD = 0.015;
const MIN_SILENCE_SEC = 0.6;

function rms(samples, offset, length) {
  let sumSquares = 0;
  for (let i = 0; i < length; i++) {
    const s = samples[offset + i];
    sumSquares += s * s;
  }
  return Math.sqrt(sumSquares / length);
}

/**
 * @param {File} file - the video file (same File object the player already plays)
 * @param {(info: { phase: string, progress: number|null }) => void} [onProgress]
 * @returns {Promise<{ start: number, end: number }[]>}
 */
export async function detectSilence(file, onProgress) {
  onProgress?.({ phase: 'decoding-audio', progress: null });
  const audio = await decodeAudio(file);

  onProgress?.({ phase: 'analyzing-audio', progress: null });
  const windowCount = Math.floor(audio.length / WINDOW_SIZE);
  const ranges = [];
  let runStart = null;

  for (let i = 0; i < windowCount; i++) {
    const offset = i * WINDOW_SIZE;
    const energy = rms(audio, offset, WINDOW_SIZE);
    const t = offset / SAMPLE_RATE;

    if (energy < SILENCE_RMS_THRESHOLD) {
      if (runStart == null) runStart = t;
    } else if (runStart != null) {
      ranges.push({ start: runStart, end: t });
      runStart = null;
    }
  }
  if (runStart != null) {
    ranges.push({ start: runStart, end: (windowCount * WINDOW_SIZE) / SAMPLE_RATE });
  }

  return ranges.filter((r) => r.end - r.start >= MIN_SILENCE_SEC);
}

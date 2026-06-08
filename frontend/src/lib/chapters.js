/**
 * Derive chapter markers from a generated transcript — no extra model needed.
 * A new chapter starts wherever the gap between consecutive cues exceeds
 * GAP_THRESHOLD_SEC (the speaker paused — likely a topic/slide change). If a
 * transcript runs long with no such gaps (continuous narration), fall back to
 * fixed-interval splits so long lectures still get some navigable structure.
 *
 * Each chapter is labeled with the first few words of its opening cue.
 */
const GAP_THRESHOLD_SEC = 6;
const FALLBACK_INTERVAL_SEC = 120;
const LABEL_WORD_COUNT = 6;

function titleCase(text) {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

function labelFor(cue) {
  const words = (cue.text || '').trim().split(/\s+/).slice(0, LABEL_WORD_COUNT);
  const label = words.join(' ').replace(/[.,;:!?]+$/, '');
  return titleCase(label) || `Chapter @ ${Math.floor(cue.start)}s`;
}

/**
 * @param {{ start: number, end: number, text: string }[]} cues
 * @returns {{ start: number, label: string }[]}
 */
export function deriveChapters(cues) {
  if (!Array.isArray(cues) || !cues.length) return [];

  const gapBreaks = [0];
  for (let i = 1; i < cues.length; i++) {
    if (cues[i].start - cues[i - 1].end >= GAP_THRESHOLD_SEC) gapBreaks.push(i);
  }

  let breakIndices = gapBreaks;
  if (gapBreaks.length < 2) {
    const lastEnd = cues[cues.length - 1].end;
    if (lastEnd > FALLBACK_INTERVAL_SEC * 1.5) {
      breakIndices = [0];
      let nextMark = FALLBACK_INTERVAL_SEC;
      for (let i = 1; i < cues.length; i++) {
        if (cues[i].start >= nextMark) {
          breakIndices.push(i);
          nextMark += FALLBACK_INTERVAL_SEC;
        }
      }
    }
  }

  return breakIndices.map((idx) => ({
    start: cues[idx].start,
    label: labelFor(cues[idx]),
  }));
}

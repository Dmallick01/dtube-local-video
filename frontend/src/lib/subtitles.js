function parseTime(ts) {
  const p = ts.trim().replace(',', '.').split(':');
  const h = parseFloat(p.length === 3 ? p[0] : 0);
  const m = parseFloat(p.length === 3 ? p[1] : p[0]);
  const s = parseFloat(p.length === 3 ? p[2] : p[1]);
  return h * 3600 + m * 60 + s;
}

export function parseVtt(text) {
  const cues = [];
  const blocks = text.replace(/\r/g, '').split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;
    const timeLine = lines.find((l) => l.includes('-->'));
    if (!timeLine) continue;
    const [start, end] = timeLine.split('-->').map(parseTime);
    const textLines = lines.filter((l) => !l.includes('-->') && !/^\d+$/.test(l.trim()));
    cues.push({ start, end, text: textLines.join('\n') });
  }
  return cues;
}

export function parseSrt(text) {
  return parseVtt(text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'));
}

/** Find .srt / .vtt with same basename in the same folder path */
export function findSubtitleFile(video, allFiles) {
  const base = video.name.replace(/\.[^.]+$/, '');
  const dir = video.relativePath?.includes('/')
    ? video.relativePath.slice(0, video.relativePath.lastIndexOf('/'))
    : '';
  for (const f of allFiles) {
    const path = f.webkitRelativePath || f.name;
    const name = path.split('/').pop();
    if (!name) continue;
    const lower = name.toLowerCase();
    if (!lower.endsWith('.srt') && !lower.endsWith('.vtt')) continue;
    const subBase = name.replace(/\.[^.]+$/, '');
    if (subBase !== base) continue;
    if (dir && path.startsWith(dir + '/')) return f;
    if (!dir && !path.includes('/')) return f;
  }
  return null;
}

export async function loadSubtitleUrl(file) {
  const text = await file.text();
  const ext = file.name.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt';
  const blob = new Blob([ext === 'vtt' ? toVtt(text, ext) : toVtt(text, 'srt')], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}

/** Build a subtitle blob URL straight from { start, end, text } cues (e.g. generated transcripts). */
export function cuesToVttUrl(cues) {
  let out = 'WEBVTT\n\n';
  cues.forEach((c, i) => {
    out += `${i + 1}\n${formatTime(c.start)} --> ${formatTime(c.end)}\n${c.text}\n\n`;
  });
  const blob = new Blob([out], { type: 'text/vtt' });
  return URL.createObjectURL(blob);
}

function toVtt(text, format) {
  if (format === 'vtt' && text.trimStart().startsWith('WEBVTT')) return text;
  const cues = format === 'srt' ? parseSrt(text) : parseVtt(text);
  let out = 'WEBVTT\n\n';
  cues.forEach((c, i) => {
    out += `${i + 1}\n${formatTime(c.start)} --> ${formatTime(c.end)}\n${c.text}\n\n`;
  });
  return out;
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = (sec % 60).toFixed(3).padStart(6, '0');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s}`;
}

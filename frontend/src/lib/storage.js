import { idbGet, idbSet } from './idb';

const FAV_KEY = 'dtube-favorites';
const HISTORY_KEY = 'dtube-folder-history';
const CAPTION_MODEL_KEY = 'dtube-caption-model';

export async function getCachedThumbnail(videoId) {
  const blob = await idbGet('thumbnails', videoId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function getCachedPreviewMeta(videoId) {
  return idbGet('previewMeta', videoId);
}

export async function cachePreviewMeta(videoId, meta) {
  await idbSet('previewMeta', videoId, meta);
}

export async function getCachedPreviewGif(videoId) {
  const blob = await idbGet('previewGifs', videoId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

export async function cachePreviewGif(videoId, blob) {
  if (!blob) return;
  await idbSet('previewGifs', videoId, blob);
}

export async function getCachedTranscript(videoId) {
  const cues = await idbGet('transcripts', videoId);
  return Array.isArray(cues) ? cues : null;
}

export async function cacheTranscript(videoId, cues) {
  if (!videoId || !Array.isArray(cues)) return;
  await idbSet('transcripts', videoId, cues);
}

export async function getCachedSilence(videoId) {
  const ranges = await idbGet('silenceRanges', videoId);
  return Array.isArray(ranges) ? ranges : null;
}

export async function cacheSilence(videoId, ranges) {
  if (!videoId || !Array.isArray(ranges)) return;
  await idbSet('silenceRanges', videoId, ranges);
}

export async function getNotes(videoId) {
  const notes = await idbGet('notes', videoId);
  return Array.isArray(notes) ? notes : [];
}

export async function saveNotes(videoId, notes) {
  if (!videoId || !Array.isArray(notes)) return;
  await idbSet('notes', videoId, notes);
}

export async function getCachedSummary(videoId) {
  return idbGet('summaries', videoId);
}

export async function cacheSummary(videoId, summary) {
  if (!videoId || !summary) return;
  await idbSet('summaries', videoId, summary);
}

export async function getCachedQuiz(videoId) {
  const quiz = await idbGet('quizzes', videoId);
  return Array.isArray(quiz) ? quiz : null;
}

export async function cacheQuiz(videoId, quiz) {
  if (!videoId || !Array.isArray(quiz)) return;
  await idbSet('quizzes', videoId, quiz);
}

export async function cacheThumbnail(videoId, dataUrl) {
  if (!dataUrl?.startsWith('data:')) return;
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  await idbSet('thumbnails', videoId, blob);
}

export async function getWatchProgress(videoId) {
  const v = await idbGet('progress', videoId);
  return typeof v === 'number' ? v : 0;
}

export async function setWatchProgress(videoId, seconds) {
  if (!videoId || seconds < 1) return;
  await idbSet('progress', videoId, seconds);
}

export function getFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

export function toggleFavorite(videoId) {
  const fav = getFavorites();
  if (fav.has(videoId)) fav.delete(videoId);
  else fav.add(videoId);
  localStorage.setItem(FAV_KEY, JSON.stringify([...fav]));
  return fav.has(videoId);
}

export function getFolderHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

export function pushFolderHistory(entry) {
  const list = getFolderHistory().filter((h) => h.name !== entry.name);
  list.unshift({ ...entry, at: Date.now() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 5)));
}

export function getCaptionModel() {
  const stored = localStorage.getItem(CAPTION_MODEL_KEY);
  return stored === 'base' ? 'base' : 'tiny';
}

export function setCaptionModel(model) {
  localStorage.setItem(CAPTION_MODEL_KEY, model === 'base' ? 'base' : 'tiny');
}

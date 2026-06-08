import { TRANSCRIPTION_MODELS } from './transcription';
import { getCaptionModel, setCaptionModel } from './storage';

const filters = [];

/**
 * Register a gallery filter: (video) => boolean
 * @example window.DTube.registerFilter((v) => v.size > 1e6)
 */
export function registerFilter(fn) {
  if (typeof fn === 'function') filters.push(fn);
}

export function applyPluginFilters(videos) {
  if (!filters.length) return videos;
  return videos.filter((v) => filters.every((fn) => {
    try {
      return fn(v);
    } catch {
      return true;
    }
  }));
}

export function initDTubeGlobal() {
  if (typeof window === 'undefined') return;
  window.DTube = window.DTube || {};
  window.DTube.registerFilter = registerFilter;
  window.DTube.version = '1.0.0';
  window.DTube.captions = {
    /** Whisper model ids available for in-browser transcription, keyed by size */
    models: TRANSCRIPTION_MODELS,
    /** Currently selected model size ('tiny' | 'base'), persisted in localStorage */
    getModel: getCaptionModel,
    setModel: setCaptionModel,
  };
}

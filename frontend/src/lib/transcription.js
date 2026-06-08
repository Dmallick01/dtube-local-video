/**
 * In-browser speech-to-text for videos that have no sidecar .srt/.vtt.
 *
 * Runs entirely on-device via Transformers.js (ONNX runtime + Whisper), so it stays
 * true to DTube's "no upload, no cloud" pitch — the model is downloaded once and
 * cached by the browser, and the audio never leaves the machine.
 *
 * Output cues use the same { start, end, text } shape as lib/subtitles.js cues, so
 * callers can feed them straight into toVtt()/loadSubtitleUrl() and reuse the
 * existing <track> rendering untouched.
 */

const MODELS = {
  tiny: 'Xenova/whisper-tiny.en',
  base: 'Xenova/whisper-base.en',
};

const TARGET_SAMPLE_RATE = 16000;
const DECODE_TIMEOUT_MS = 120000;

let transcriberPromise = null;
let transcriberModelId = null;

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function loadTranscriber(modelKey, onProgress) {
  const modelId = MODELS[modelKey] || MODELS.tiny;
  if (transcriberPromise && transcriberModelId === modelId) return transcriberPromise;

  transcriberModelId = modelId;
  transcriberPromise = (async () => {
    const { pipeline } = await import('@huggingface/transformers');
    return pipeline('automatic-speech-recognition', modelId, {
      dtype: 'fp32',
      progress_callback: (data) => {
        if (data?.status === 'progress') {
          onProgress?.({ phase: 'loading-model', progress: (data.progress || 0) / 100, file: data.file });
        } else if (data?.status) {
          onProgress?.({ phase: 'loading-model', progress: null, file: data.file });
        }
      },
    });
  })();
  return transcriberPromise;
}

/** Decode a local video file's audio track to mono Float32Array @ 16kHz for Whisper. */
export async function decodeAudio(file) {
  const arrayBuffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const probeCtx = new AudioCtx();
  let audioBuffer;
  try {
    audioBuffer = await probeCtx.decodeAudioData(arrayBuffer);
  } finally {
    probeCtx.close?.().catch?.(() => {});
  }

  const { duration, numberOfChannels, sampleRate } = audioBuffer;
  if (sampleRate === TARGET_SAMPLE_RATE && numberOfChannels === 1) {
    return audioBuffer.getChannelData(0);
  }

  const offlineCtx = new OfflineAudioContext(1, Math.ceil(duration * TARGET_SAMPLE_RATE), TARGET_SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const rendered = await withTimeout(offlineCtx.startRendering(), DECODE_TIMEOUT_MS, null);
  if (!rendered) throw new Error('Audio decoding timed out.');
  return rendered.getChannelData(0);
}

function chunksToCues(output) {
  const chunks = output?.chunks?.length ? output.chunks : null;
  if (!chunks) {
    return output?.text?.trim() ? [{ start: 0, end: 0, text: output.text.trim() }] : [];
  }
  return chunks
    .map(({ timestamp, text }) => {
      const start = timestamp?.[0] ?? 0;
      const end = timestamp?.[1] ?? start;
      return { start, end: end > start ? end : start + 4, text: (text || '').trim() };
    })
    .filter((cue) => cue.text);
}

/**
 * Transcribe a local video file fully in-browser (Whisper via Transformers.js).
 * Returns cues shaped like { start, end, text }, ready for toVtt()/loadSubtitleUrl().
 *
 * @param {File} file - the video file (same File object the player already plays)
 * @param {{ model?: 'tiny'|'base', onProgress?: (info: { phase: string, progress: number|null }) => void }} [opts]
 */
export async function transcribeLocally(file, { model = 'tiny', onProgress } = {}) {
  const transcriber = await loadTranscriber(model, onProgress);

  onProgress?.({ phase: 'decoding-audio', progress: null });
  const audio = await decodeAudio(file);

  onProgress?.({ phase: 'transcribing', progress: null });
  const output = await transcriber(audio, {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  onProgress?.({ phase: 'done', progress: 1 });
  return chunksToCues(output);
}

/**
 * Stub for an optional cloud transcription engine ("bring your own API key").
 * Mirrors transcribeLocally's signature/output shape so the UI and cache layer don't
 * need to know which engine produced the cues — only the engine choice changes.
 * Not wired into the UI yet; intentionally left unimplemented until a provider
 * (e.g. Groq's free-tier Whisper endpoint) is chosen.
 */
export async function transcribeViaCloud(_file, { apiKey, provider = 'groq' } = {}) {
  if (!apiKey) throw new Error('Cloud transcription needs an API key.');
  throw new Error(`Cloud transcription via "${provider}" isn't wired up yet — use the local engine.`);
}

export const TRANSCRIPTION_MODELS = MODELS;

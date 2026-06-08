/**
 * Transcript-driven study aids — key-point summaries and self-test quizzes — via a
 * small in-browser LLM (WebLLM on WebGPU). Lazy-loaded only when the user asks for it,
 * exactly like the Whisper engine in lib/transcription.js, so it never touches the
 * default bundle or a user's download budget unprompted.
 *
 * WebGPU-only (Chrome/Edge 113+). isWebLLMSupported() lets the UI show a clear
 * "needs WebGPU" message up front rather than attempting a load that's destined to fail.
 */

const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';
const MAX_TRANSCRIPT_CHARS = 6000;

let enginePromise = null;

export function isWebLLMSupported() {
  return typeof navigator !== 'undefined' && !!navigator.gpu;
}

async function loadEngine(onProgress) {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
    return CreateMLCEngine(MODEL_ID, {
      initProgressCallback: (report) => {
        onProgress?.({
          phase: 'loading-model',
          progress: typeof report?.progress === 'number' ? report.progress : null,
          text: report?.text,
        });
      },
    });
  })();
  return enginePromise;
}

function transcriptToText(cues) {
  return cues.map((c) => c.text).join(' ').slice(0, MAX_TRANSCRIPT_CHARS);
}

async function ask(engine, systemPrompt, userPrompt) {
  const reply = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
  });
  return reply?.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * @param {{ start: number, end: number, text: string }[]} cues
 * @param {(info: { phase: string, progress: number|null }) => void} [onProgress]
 * @returns {Promise<string[]>} short bullet-point key ideas
 */
export async function summarizeTranscript(cues, onProgress) {
  const engine = await loadEngine(onProgress);
  onProgress?.({ phase: 'summarizing', progress: null });
  const reply = await ask(
    engine,
    'You are a study assistant. Summarize lecture transcripts as concise bullet points — '
      + 'one key idea per line, no preamble, no closing remarks.',
    `Summarize the key points of this lecture transcript as 4-8 short bullet points:\n\n${transcriptToText(cues)}`,
  );
  const bullets = reply
    .split('\n')
    .map((l) => l.replace(/^[\s*•\-\d.]+/, '').trim())
    .filter(Boolean);
  onProgress?.({ phase: 'done', progress: 1 });
  return bullets;
}

/**
 * @param {{ start: number, end: number, text: string }[]} cues
 * @param {(info: { phase: string, progress: number|null }) => void} [onProgress]
 * @returns {Promise<{ question: string, answer: string }[]>}
 */
export async function generateQuiz(cues, onProgress) {
  const engine = await loadEngine(onProgress);
  onProgress?.({ phase: 'generating-quiz', progress: null });
  const reply = await ask(
    engine,
    'You are a study assistant. Write short self-test questions from a lecture transcript. '
      + 'Reply with ONLY plain lines in the exact alternating form "Q: <question>" then '
      + '"A: <answer>" — no numbering, no extra commentary.',
    `Write 5 short question/answer pairs that test understanding of this lecture transcript:\n\n${transcriptToText(cues)}`,
  );

  // Small models often ignore "alternating lines" and write "Q: ...? A: ..." on
  // one line instead — handle both shapes, plus "Question:"/"Answer:" labels.
  const inlineRe = /^Q(?:uestion)?[:.]?\s*(.+?)\s+A(?:nswer)?[:.]\s+(.+)$/i;
  const qRe = /^Q(?:uestion)?[:.]?\s*(.+)/i;
  const aRe = /^A(?:nswer)?[:.]?\s*(.+)/i;
  const quiz = [];
  let pending = null;
  for (const raw of reply.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const inline = line.match(inlineRe);
    if (inline) {
      quiz.push({ question: inline[1].trim(), answer: inline[2].trim() });
      pending = null;
      continue;
    }
    const q = line.match(qRe);
    const a = line.match(aRe);
    if (q) pending = { question: q[1].trim(), answer: '' };
    else if (a && pending) {
      pending.answer = a[1].trim();
      quiz.push(pending);
      pending = null;
    }
  }
  onProgress?.({ phase: 'done', progress: 1 });
  return quiz;
}

export const STUDY_MODEL_ID = MODEL_ID;

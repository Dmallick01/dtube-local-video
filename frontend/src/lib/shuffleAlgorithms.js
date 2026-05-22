/** Seeded PRNG for reproducible shuffles (optional). */
export function createRng(seed = Date.now()) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function copy(arr) {
  return [...arr];
}

function randInt(rng, n) {
  return Math.floor(rng() * n);
}

/** 1. Fisher–Yates (Durstenfeld) — uniform, O(n). */
function fisherYates(arr, rng) {
  const a = copy(arr);
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 2. Inside-out Fisher–Yates — incremental build. */
function insideOut(arr, rng) {
  const a = [];
  for (let i = 0; i < arr.length; i++) {
    const j = randInt(rng, i + 1);
    a[i] = a[j];
    a[j] = arr[i];
  }
  return a;
}

/** 3. Sattolo — cyclic derangement (no element stays in place when n>1). */
function sattolo(arr, rng) {
  const a = copy(arr);
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 4. Riffle — perfect interleaving of two halves. */
function riffle(arr, _rng) {
  const a = copy(arr);
  const mid = Math.ceil(a.length / 2);
  const left = a.slice(0, mid);
  const right = a.slice(mid);
  const out = [];
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i++) {
    if (i < left.length) out.push(left[i]);
    if (i < right.length) out.push(right[i]);
  }
  return out;
}

/** 5. Faro out-shuffle — merge top-down. */
function faroOut(arr, _rng) {
  const a = copy(arr);
  const mid = Math.ceil(a.length / 2);
  const left = a.slice(0, mid);
  const right = a.slice(mid);
  const out = [];
  for (let i = 0; i < mid; i++) {
    if (left[i] !== undefined) out.push(left[i]);
    if (right[i] !== undefined) out.push(right[i]);
  }
  return out;
}

/** 6. Faro in-shuffle — bottom card first each step. */
function faroIn(arr, _rng) {
  const a = copy(arr);
  const mid = Math.floor(a.length / 2);
  const left = a.slice(0, mid);
  const right = a.slice(mid);
  const out = [];
  for (let i = 0; i < right.length; i++) {
    if (right[i] !== undefined) out.push(right[i]);
    if (left[i] !== undefined) out.push(left[i]);
  }
  return out;
}

/** 7. Block shuffle — shuffle fixed-size blocks, order blocks shuffled. */
function blockShuffle(arr, rng, blockSize = 4) {
  const a = copy(arr);
  const blocks = [];
  for (let i = 0; i < a.length; i += blockSize) {
    blocks.push(a.slice(i, i + blockSize));
  }
  const shuffledBlocks = fisherYates(blocks, rng);
  return shuffledBlocks.flat();
}

/** 8. Partial Fisher–Yates — only first k positions randomized. */
function partialFisherYates(arr, rng) {
  const a = copy(arr);
  const k = Math.max(1, Math.floor(a.length * 0.75));
  for (let i = 0; i < k; i++) {
    const j = i + randInt(rng, a.length - i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 9. Naive random sort — biased, for comparison only. */
function naiveRandom(arr, rng) {
  return copy(arr).sort(() => rng() - 0.5);
}

/** 10. Double Fisher–Yates — two passes for extra mixing. */
function doubleFisherYates(arr, rng) {
  return fisherYates(fisherYates(arr, rng), rng);
}

export const SHUFFLE_ALGORITHMS = [
  { id: 'fisher-yates', name: 'Fisher–Yates', desc: 'Uniform random permutation (gold standard)', fn: fisherYates },
  { id: 'inside-out', name: 'Inside-out FY', desc: 'Incremental Fisher–Yates build', fn: insideOut },
  { id: 'sattolo', name: 'Sattolo', desc: 'Cyclic derangement — no fixed positions', fn: sattolo },
  { id: 'riffle', name: 'Riffle', desc: 'Perfect interleave of first/second half', fn: riffle },
  { id: 'faro-out', name: 'Faro (out)', desc: 'Deck faro out-shuffle merge', fn: faroOut },
  { id: 'faro-in', name: 'Faro (in)', desc: 'Deck faro in-shuffle merge', fn: faroIn },
  { id: 'block', name: 'Block shuffle', desc: 'Shuffle within blocks of 4, then shuffle blocks', fn: blockShuffle },
  { id: 'partial-fy', name: 'Partial FY', desc: 'Randomize ~75% of leading positions', fn: partialFisherYates },
  { id: 'naive', name: 'Naive random sort', desc: 'sort(() => random) — not uniform', fn: naiveRandom },
  { id: 'double-fy', name: 'Double Fisher–Yates', desc: 'Two-pass FY mix', fn: doubleFisherYates },
];

export function shuffleWithAlgorithm(items, algorithmId, seed) {
  const algo = SHUFFLE_ALGORITHMS.find((a) => a.id === algorithmId) || SHUFFLE_ALGORITHMS[0];
  const rng = createRng(seed);
  return algo.fn(items, rng);
}

/** Subsequence fuzzy match — higher score = better match */
export function fuzzyScore(query, text) {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 100 + (100 - t.indexOf(q));
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      qi += 1;
      streak += 1;
      score += streak * 2;
    } else {
      streak = 0;
    }
  }
  if (qi < q.length) return 0;
  return score;
}

export function fuzzyFilter(items, query, pathFn) {
  const q = query.trim();
  if (!q) return items;
  return items
    .map((item) => ({ item, score: fuzzyScore(q, pathFn(item)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}

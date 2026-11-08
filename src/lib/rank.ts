/**
 * Reciprocal Rank Fusion: merges several ranked result lists into one.
 * Used to combine keyword search (exact terms like "E-21" or "M8") with
 * vector search (meaning, e.g. "machine won't start" ≈ "spindle fails to rotate").
 */
export function reciprocalRankFusion(lists: number[][], k = 60): number[] {
  const scores = new Map<number, number>();
  for (const list of lists) {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

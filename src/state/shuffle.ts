/**
 * Pure Fisher–Yates shuffle. Returns a new array; does not mutate the input.
 * `rand` defaults to Math.random but is injectable for deterministic tests.
 */
export function shuffleArray<T>(input: readonly T[], rand: () => number = Math.random): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

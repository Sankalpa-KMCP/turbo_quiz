/**
 * Non-mutating Fisher-Yates shuffle.
 * Accepts an optional or injected random function (defaults to Math.random).
 */
export function shuffle<T>(array: readonly T[], random: () => number = Math.random): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

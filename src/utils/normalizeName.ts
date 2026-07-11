/**
 * Normalizes a name string by trimming whitespace, lowercasing without locale dependencies,
 * and normalizing unicode characters to NFC.
 *
 * @param name The raw string to normalize
 * @returns The normalized deterministic string
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().normalize('NFC')
}

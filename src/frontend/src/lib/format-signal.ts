/**
 * Truncates a long signal sentence to the first clause.
 * "Algolia processed 1848 queries (massive growth)" → "Algolia processed 1848 queries"
 */
export function truncateSignal(signal: string, maxLen = 48): string {
  const trimmed = signal.split(/[,(]/)[0].trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen - 2) + "…" : trimmed;
}

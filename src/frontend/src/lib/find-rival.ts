import type { Company } from "@/types/company";

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has',
  'had', 'its', 'that', 'this', 'their', 'into', 'which', 'who', 'also', 'as',
  'more', 'than', 'other', 'about', 'such', 'through', 'over', 'between',
  'company', 'companies', 'platform', 'service', 'services', 'provides', 'offers',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !STOPWORDS.has(w))
  );
}

function buildTextBlock(c: Company): string {
  const parts = [c.description || '', c.sector || ''];
  if (c.businessProfile) parts.push(c.businessProfile);
  return parts.join(' ');
}

export function findClosestRival(current: Company, all: Company[]): Company | null {
  const currentWords = tokenize(buildTextBlock(current));
  const currentSignals = new Set(current.summaryMeta?.signals || []);

  let best: Company | null = null;
  let bestScore = -1;

  for (const c of all) {
    if (c.id === current.id) continue;
    let score = 0;

    // Sector match
    if (c.sector && current.sector && c.sector.toLowerCase() === current.sector.toLowerCase()) {
      score += 10;
    }

    // Business profile / description word overlap
    const words = tokenize(buildTextBlock(c));
    for (const w of currentWords) {
      if (words.has(w)) score += 2;
    }

    // Signal overlap (summaryMeta.signals)
    for (const sig of currentSignals) {
      if (c.summaryMeta?.signals?.includes(sig)) score += 3;
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return best;
}

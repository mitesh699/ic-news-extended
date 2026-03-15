import type { NewsArticle } from "@/types/company";

/**
 * Generates cumulative sentiment score data for sparkline visualization.
 * Starts at 50, moves +8 for positive, -8 for negative, +1 for neutral.
 */
export function calculateSparklineData(articles: NewsArticle[]): number[] {
  const sorted = [...articles].sort(
    (a, b) => new Date(a.publishedAt ?? a.fetchedAt).getTime() - new Date(b.publishedAt ?? b.fetchedAt).getTime()
  );
  let cumulative = 50;
  return sorted.map(a => {
    if (a.signal === "positive") cumulative += 8;
    else if (a.signal === "negative") cumulative -= 8;
    else cumulative += 1;
    return cumulative;
  });
}

export function sparklineColor(sentiment: "positive" | "negative" | "neutral"): string {
  if (sentiment === "positive") return "hsl(152, 55%, 36%)";
  if (sentiment === "negative") return "hsl(0, 65%, 48%)";
  return "hsl(38, 70%, 48%)";
}

export type Sentiment = "positive" | "negative" | "neutral";

export function getSentiment(pos: number, neg: number): Sentiment {
  return pos > neg ? "positive" : neg > pos ? "negative" : "neutral";
}

export function sentimentClass(sentiment: Sentiment): string {
  if (sentiment === "positive") return "text-signal-positive bg-signal-positive/10";
  if (sentiment === "negative") return "text-signal-negative bg-signal-negative/10";
  return "text-signal-neutral bg-muted/40";
}

export function sentimentBorderClass(sentiment: Sentiment): string {
  if (sentiment === "positive") return "border-signal-positive/30 bg-signal-positive/5";
  if (sentiment === "negative") return "border-signal-negative/30 bg-signal-negative/5";
  return "border-border bg-muted/30";
}

export function sentimentTextClass(sentiment: Sentiment): string {
  if (sentiment === "positive") return "text-signal-positive";
  if (sentiment === "negative") return "text-signal-negative";
  return "text-signal-neutral";
}

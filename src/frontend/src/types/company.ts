export interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string | null;
  fetchedAt: string;
  signal?: "positive" | "negative" | "neutral";
  isBreaking?: boolean;
  summary?: string;
}

export type EventSignal = 'funding' | 'hiring' | 'product' | 'regulatory' | 'M&A' | 'risk' | 'partnership';

export interface SummaryMeta {
  keyThemes: string[];
  outlook: string;
  actionItems: string[];
  confidence?: string;
  signals: EventSignal[];
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  sector: string;
  description: string;
  summary: string;
  summaryMeta?: SummaryMeta | null;
  newsArticles: NewsArticle[];
  lastUpdated: string;
}

export type TopicFilter = "all" | "climate" | "consumer" | "crypto" | "enterprise" | "fintech" | "frontier tech" | "healthcare" | "real estate";
export type DateFilter = "all" | "today" | "week" | "month" | "year";
export type SignalFilter = "all" | "positive" | "negative" | "neutral" | "breaking";

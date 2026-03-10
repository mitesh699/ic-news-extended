import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const LAST_SEEN_KEY = "ic_news_last_seen_at";
const ARTICLE_COUNT_KEY = "ic_news_article_count";

function getLastSeen(): string {
  const stored = localStorage.getItem(LAST_SEEN_KEY);
  if (!stored) {
    const now = new Date().toISOString();
    localStorage.setItem(LAST_SEEN_KEY, now);
    return now;
  }
  return stored;
}

function setLastSeen(ts: string): void {
  localStorage.setItem(LAST_SEEN_KEY, ts);
}

function getPreviousCount(): number {
  return parseInt(localStorage.getItem(ARTICLE_COUNT_KEY) || "0", 10);
}

function savePreviousCount(count: number): void {
  localStorage.setItem(ARTICLE_COUNT_KEY, String(count));
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

interface SSEEvent {
  totalNewArticles: number;
  timestamp: string;
}

interface ArticleDate {
  publishedAt: string | null;
  fetchedAt: string;
}

export function useNotifications(articles?: ArticleDate[]) {
  const queryClient = useQueryClient();
  const [sseCount, setSSECount] = useState(0);
  const [latestEvent, setLatestEvent] = useState<SSEEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Connect to SSE
  useEffect(() => {
    const es = new EventSource(`${API_BASE_URL}/events`);
    eventSourceRef.current = es;

    es.addEventListener("articles.new", (e) => {
      try {
        const data: SSEEvent = JSON.parse(e.data);
        setLatestEvent(data);
        setSSECount((prev) => prev + data.totalNewArticles);
        setDismissed(false);
        queryClient.invalidateQueries({ queryKey: ["companies"] });
      } catch { /* ignore malformed events */ }
    });

    es.onerror = () => { /* EventSource auto-reconnects */ };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [queryClient]);

  // Count unseen articles from data
  const unseenFromData = useMemo(() => {
    if (!articles || articles.length === 0) return 0;
    const lastSeen = getLastSeen();
    return articles.filter((a) => (a.publishedAt ?? a.fetchedAt) > lastSeen).length;
  }, [articles]);

  // Count new articles since last known total (works after refresh)
  const newSinceLastSession = useMemo(() => {
    if (!articles || articles.length === 0) return 0;
    const prev = getPreviousCount();
    if (prev === 0) {
      // First time — save current count, show 0
      savePreviousCount(articles.length);
      return 0;
    }
    const diff = articles.length - prev;
    return diff > 0 ? diff : 0;
  }, [articles]);

  // Use whichever source has data: SSE > date-based > count-based
  const totalNew = dismissed
    ? 0
    : sseCount > 0
      ? sseCount
      : unseenFromData > 0
        ? unseenFromData
        : newSinceLastSession;

  const markSeen = useCallback(() => {
    setSSECount(0);
    setLatestEvent(null);
    setDismissed(true);
    setLastSeen(new Date().toISOString());
    if (articles) savePreviousCount(articles.length);
  }, [articles]);

  return { newCount: totalNew, latestEvent, markSeen };
}

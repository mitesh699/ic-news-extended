import { Zap } from "lucide-react";
import type { NewsArticle } from "@/types/company";

interface TickerBarProps {
  breakingNews: { article: NewsArticle; companyName: string }[];
}

export function TickerBar({ breakingNews }: TickerBarProps) {
  if (breakingNews.length === 0) return null;
  const items = [...breakingNews, ...breakingNews];

  return (
    <div className="ticker-bar overflow-hidden whitespace-nowrap border-b border-foreground/[0.06]" aria-label="Breaking news ticker" role="marquee">
      <div className="flex items-center h-9">
        <div className="shrink-0 z-10 flex items-center gap-2 px-4 bg-accent text-accent-foreground text-[9px] font-bold uppercase tracking-[0.2em] h-full">
          <Zap className="h-2.5 w-2.5" />
          Breaking
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-ticker-bg to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-ticker-bg to-transparent z-10 pointer-events-none" />
          <div className="inline-flex animate-ticker-scroll items-center">
            {items.map((item, i) => (
              <a
                key={`${item.article.id}-${i}`}
                href={item.article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 text-[11px] hover:text-accent transition-colors"
              >
                <span className="h-1 w-1 rounded-full bg-accent shrink-0 breaking-pulse" />
                <span className="font-bold uppercase tracking-[0.06em]">{item.companyName}</span>
                <span className="opacity-60 font-normal">{item.article.title}</span>
                <span className="opacity-25 mono text-[8px] uppercase tracking-[0.1em]">{item.article.source}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

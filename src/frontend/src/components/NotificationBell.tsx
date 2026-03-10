import { useState, useRef, useEffect } from "react";
import { Bell, Zap, TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { NewsArticle } from "@/types/company";

interface NotificationArticle {
  article: NewsArticle;
  companyName: string;
}

interface NotificationBellProps {
  count: number;
  articles?: NotificationArticle[];
  onMarkSeen: () => void;
}

const signalIcon = {
  positive: <TrendingUp className="h-3 w-3 text-signal-positive" />,
  negative: <TrendingDown className="h-3 w-3 text-signal-negative" />,
  neutral: <Minus className="h-3 w-3 text-signal-neutral" />,
};

export function NotificationBell({ count, articles = [], onMarkSeen }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  };

  const handleMarkRead = () => {
    onMarkSeen();
    setOpen(false);
  };

  const recent = articles.slice(0, 8);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={toggle}
        aria-label={count > 0 ? `${count} new articles` : "No new articles"}
        className="relative h-8 w-8 flex items-center justify-center hover:bg-foreground/[0.05] transition-colors focus-visible:ring-2 focus-visible:ring-foreground/20"
      >
        <Bell className={cn("h-3.5 w-3.5 text-muted-foreground/60", count > 0 && "text-foreground")} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-accent text-[9px] font-bold text-white px-1">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-card border border-border/60 shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/80">
              Notifications
            </span>
            {count > 0 && (
              <button
                onClick={handleMarkRead}
                className="text-[9px] font-bold uppercase tracking-[0.1em] text-accent hover:text-accent/80 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Article list */}
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-5 w-5 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-[11px] text-muted-foreground/50">No new updates</p>
              </div>
            ) : (
              recent.map(({ article, companyName }) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex gap-3 px-4 py-3 hover:bg-foreground/[0.03] transition-colors border-b border-border/20 last:border-0 group"
                >
                  {/* Signal dot */}
                  <div className="mt-1.5 shrink-0">
                    {article.isBreaking ? (
                      <Zap className="h-3 w-3 text-accent" />
                    ) : (
                      signalIcon[article.signal || "neutral"]
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground/80 leading-[1.45] line-clamp-2 group-hover:text-accent transition-colors">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
                        {companyName}
                      </span>
                      <span className="text-muted-foreground/20 text-[6px]">|</span>
                      <span className="text-[8px] text-muted-foreground/40 mono">
                        {article.source}
                      </span>
                      <span className="text-muted-foreground/20 text-[6px]">|</span>
                      <span className="text-[8px] text-muted-foreground/40 mono">
                        {formatDistanceToNow(new Date(article.publishedAt ?? article.fetchedAt), { addSuffix: true })}
                      </span>
                    </div>
                    {article.summary && (
                      <p className="text-[10px] text-muted-foreground/40 leading-[1.5] line-clamp-1 mt-1 headline-font-italic">
                        {article.summary}
                      </p>
                    )}
                  </div>

                  {/* External link icon */}
                  <ExternalLink className="h-3 w-3 mt-1 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors" />
                </a>
              ))
            )}
          </div>

          {/* Footer */}
          {recent.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border/40 bg-foreground/[0.02]">
              <p className="text-[9px] text-muted-foreground/40 mono text-center uppercase tracking-[0.1em]">
                {count > 0 ? `${count} new` : "Up to date"} — Showing latest {recent.length}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

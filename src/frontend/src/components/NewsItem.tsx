import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, isToday, isThisWeek, isThisMonth, isThisYear, format, differenceInDays } from "date-fns";
import { Zap, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { NewsArticle } from "@/types/company";
import { cn } from "@/lib/utils";

interface NewsItemProps {
  article: NewsArticle;
  companyName: string;
  companyId?: string;
  variant?: "compact" | "feed";
}

function SignalBar({ signal }: { signal?: string }) {
  return (
    <div className={cn(
      "w-[3px] self-stretch shrink-0 rounded-full",
      signal === "positive" && "bg-signal-positive",
      signal === "negative" && "bg-signal-negative",
      signal === "neutral" && "bg-signal-neutral/40",
      !signal && "bg-muted-foreground/10",
    )} />
  );
}

export function NewsItem({ article, companyName, companyId, variant = "compact" }: NewsItemProps) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const displayDate = new Date(article.publishedAt ?? article.fetchedAt);
  const timeAgo = formatDistanceToNow(displayDate, { addSuffix: false });
  const exactDate = differenceInDays(new Date(), displayDate) > 6
    ? format(displayDate, "MMM d, yyyy")
    : format(displayDate, "MMM d, HH:mm");

  if (variant === "feed") {
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "group flex gap-3 py-3.5 border-b border-border/40 last:border-0 hover:bg-foreground/[0.02] transition-colors -mx-1 px-1",
          article.signal === "positive" && "border-l-[3px] border-l-signal-positive pl-3",
          article.signal === "negative" && "border-l-[3px] border-l-signal-negative pl-3",
        )}
      >
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-[13px] font-medium text-foreground/85 leading-[1.5] group-hover:text-accent transition-colors",
            article.isBreaking && "font-semibold text-foreground"
          )}>
            {article.isBreaking && (
              <Zap className="inline h-3 w-3 text-accent mr-1 -mt-0.5 breaking-pulse" />
            )}
            {article.title}
          </p>
          <AnimatePresence>
            {isHovered && article.summary && (
              <motion.p
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 4 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="text-[11px] text-muted-foreground/55 leading-[1.55] line-clamp-4 headline-font-italic overflow-hidden"
              >
                {article.summary}
              </motion.p>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">{article.source}</span>
            <span className="text-muted-foreground/20 text-[8px]">—</span>
            {exactDate && <span className="text-[9px] text-muted-foreground/40 mono tracking-[0.08em]">{exactDate}</span>}
            {exactDate && <span className="text-muted-foreground/20 text-[8px]">—</span>}
            <span className="text-[9px] text-muted-foreground/40 mono uppercase tracking-[0.08em]">{timeAgo} ago</span>
            <span className="text-muted-foreground/20 text-[8px]">—</span>
            {companyId ? (
              <span role="link" tabIndex={0}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/company/${companyId}`); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); navigate(`/company/${companyId}`); } }}
                className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.08em] hover:text-accent transition-colors cursor-pointer">
                {companyName}
              </span>
            ) : (
              <span className="text-[9px] text-muted-foreground/40 uppercase tracking-[0.08em]">{companyName}</span>
            )}
          </div>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground/0 group-hover:text-accent/60 transition-all" />
      </a>
    );
  }

  // Compact variant — hover reveals summary
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group flex items-stretch gap-2 py-[6px] hover:bg-foreground/[0.03] -mx-2 px-2 transition-all duration-200 rounded-sm"
    >
      <SignalBar signal={article.signal} />
      <div className="flex-1 min-w-0 py-0.5">
        <p className={cn(
          "text-[11.5px] leading-[1.45] text-foreground/70 group-hover:text-foreground transition-colors",
          article.isBreaking && "font-medium text-foreground/85"
        )}>
          {article.isBreaking && <Zap className="inline h-2.5 w-2.5 text-accent mr-0.5 -mt-0.5" />}
          {article.title}
        </p>
        <AnimatePresence>
          {isHovered && article.summary && (
            <motion.p
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 3 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="text-[10px] text-muted-foreground/50 leading-[1.55] line-clamp-4 headline-font-italic overflow-hidden"
            >
              {article.summary}
            </motion.p>
          )}
        </AnimatePresence>
        <p className="text-[8px] text-muted-foreground/35 mt-1 mono uppercase tracking-[0.12em]">
          {article.source} · {exactDate ? `${exactDate} · ` : ""}{timeAgo} ago
        </p>
      </div>
      <ArrowUpRight className="h-3 w-3 mt-1.5 shrink-0 text-muted-foreground/0 group-hover:text-accent/50 transition-all duration-200" />
    </a>
  );
}

export function getTimeFilter(article: { publishedAt: string | null; fetchedAt: string }, filter: string): boolean {
  const d = new Date(article.publishedAt ?? article.fetchedAt);
  switch (filter) {
    case "today": return isToday(d);
    case "week": return isThisWeek(d);
    case "month": return isThisMonth(d);
    case "year": return isThisYear(d);
    default: return true;
  }
}

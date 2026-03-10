import { format } from "date-fns";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, ArrowRight, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { NewsItem } from "@/components/NewsItem";
import { Sparkline } from "@/components/Sparkline";
import type { Company } from "@/types/company";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface CompanyCardProps {
  company: Company;
  onClick: () => void;
  index?: number;
}

export function CompanyCard({ company, onClick, index = 0 }: CompanyCardProps) {
  const positiveCount = company.newsArticles.filter(a => a.signal === "positive").length;
  const negativeCount = company.newsArticles.filter(a => a.signal === "negative").length;
  const hasBreaking = company.newsArticles.some(a => a.isBreaking);
  const sentiment = positiveCount > negativeCount ? "positive" : negativeCount > positiveCount ? "negative" : "neutral";
  const totalArticles = company.newsArticles.length;

  // Generate sparkline data from article signals over time
  const sparklineData = useMemo(() => {
    const sorted = [...company.newsArticles].sort(
      (a, b) => new Date(a.publishedAt ?? a.fetchedAt).getTime() - new Date(b.publishedAt ?? b.fetchedAt).getTime()
    );
    let cumulative = 50;
    return sorted.map(a => {
      if (a.signal === "positive") cumulative += 8;
      else if (a.signal === "negative") cumulative -= 8;
      else cumulative += 1;
      return cumulative;
    });
  }, [company.newsArticles]);

  const sparkColor =
    sentiment === "positive" ? "hsl(152, 55%, 36%)" :
    sentiment === "negative" ? "hsl(0, 65%, 48%)" :
    "hsl(38, 70%, 48%)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      whileHover={{ y: -3, transition: { duration: 0.25 } }}
    >
      <div
        className={cn(
          "group cursor-pointer glass-card overflow-hidden",
        )}
        onClick={onClick}
      >
        {/* Top accent line — animated width on hover */}
        <div className="relative h-[2px] overflow-hidden">
          <div className={cn(
            "absolute inset-0",
            sentiment === "positive" && "bg-signal-positive/40",
            sentiment === "negative" && "bg-signal-negative/40",
            sentiment === "neutral" && "bg-border",
          )} />
          <div className={cn(
            "absolute inset-y-0 left-0 w-0 group-hover:w-full transition-all duration-500 ease-out",
            sentiment === "positive" && "bg-signal-positive",
            sentiment === "negative" && "bg-signal-negative",
            sentiment === "neutral" && "bg-foreground/20",
          )} />
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5">
                <h3 className="text-[20px] font-bold tracking-[-0.03em] text-foreground group-hover:text-accent transition-colors duration-200 headline-font">
                  {company.name}
                </h3>
                {hasBreaking && (
                  <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-[0.14em] text-accent breaking-pulse bg-accent/8 px-2 py-0.5">
                    <Zap className="h-2.5 w-2.5" />
                    Live
                  </span>
                )}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/45 mt-1">
                {company.sector}
              </p>
            </div>

            {/* Sparkline + signal badges */}
            <div className="flex flex-col items-end gap-2 mt-1 shrink-0">
              <Sparkline
                data={sparklineData}
                width={64}
                height={20}
                color={sparkColor}
                className="opacity-60 group-hover:opacity-100 transition-opacity duration-300"
              />
              <div className="flex items-center gap-1.5">
                {positiveCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-signal-positive mono bg-signal-positive/8 px-1.5 py-0.5">
                    <TrendingUp className="h-3 w-3" />{positiveCount}
                  </span>
                )}
                {negativeCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold text-signal-negative mono bg-signal-negative/8 px-1.5 py-0.5">
                    <TrendingDown className="h-3 w-3" />{negativeCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Company summary */}
          <p className="text-[12px] text-muted-foreground/55 leading-[1.65] line-clamp-2 mb-4 headline-font-italic">
            {company.summary}
          </p>

          {/* Divider with label */}
          <div className="flex items-center gap-3 mb-2">
            <div className="h-px bg-border/50 flex-1" />
            <span className="text-[7px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 mono">Latest</span>
            <div className="h-px bg-border/50 flex-1" />
          </div>

          {/* Per-article items */}
          <div className="space-y-0" onClick={(e) => e.stopPropagation()}>
            {company.newsArticles.slice(0, 3).map((article) => (
              <NewsItem key={article.id} article={article} companyName={company.name} variant="compact" />
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
            <span className="text-[9px] text-muted-foreground/35 mono uppercase tracking-[0.1em]">
              {format(new Date(company.lastUpdated), "MMM d, HH:mm")}
            </span>
            <Link
              to={`/company/${company.id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/35 group-hover:text-accent transition-colors duration-200"
            >
              View all {totalArticles}
              <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

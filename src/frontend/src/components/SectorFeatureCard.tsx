import { Link } from "react-router-dom";
import { Building2, Newspaper, Swords, ArrowUpRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getTrendConfig } from "@/lib/sector-config";
import { truncateSignal } from "@/lib/format-signal";
import { useCountUp } from "@/lib/use-count-up";
import type { SectorBrief } from "@/types/company";

function StatBox({ value, label, delay }: { value: number; label: string; delay: number }) {
  const count = useCountUp(value, 900);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="flex flex-col items-center px-6 py-3 border-r border-border/30 last:border-r-0"
    >
      <span className="text-[28px] font-bold mono text-foreground/80 leading-none tabular-nums">
        {count.toLocaleString()}
      </span>
      <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 mt-1.5">
        {label}
      </span>
    </motion.div>
  );
}

export function SectorFeatureCard({
  sector,
  rank,
  maxArticles = 1,
}: {
  sector: SectorBrief;
  rank: number;
  maxArticles?: number;
}) {
  const { icon: TrendIcon, color: trendColor, border: trendBorder, bg: trendBg, label: trendLabel } =
    getTrendConfig(sector.metadata?.trendDirection);

  const articlePct = Math.round((sector.articleCount / Math.max(maxArticles, 1)) * 100);
  const signals = sector.metadata?.topSignals ?? [];

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Link
        to={`/sectors/${encodeURIComponent(sector.sector)}`}
        className={cn(
          "group glass-card border-l-4 hover:border-accent/40 transition-colors block overflow-hidden",
          trendBorder,
        )}
      >
        {/* Header row */}
        <div className={cn("px-6 pt-5 pb-4 border-b border-border/30", trendBg)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <span className="text-[10px] font-bold mono text-muted-foreground/30 uppercase tracking-[0.2em]">
                #{rank}
              </span>
              <h3 className="text-[28px] font-bold tracking-[-0.03em] headline-font text-foreground/90 group-hover:text-accent transition-colors leading-[1.1]">
                {sector.sector}
              </h3>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {sector.generatedAt && (
                <span className="text-[8px] text-muted-foreground/30 mono hidden sm:block">
                  {formatDistanceToNow(new Date(sector.generatedAt), { addSuffix: true })}
                </span>
              )}
              <div className={cn("flex items-center gap-1.5 px-3 py-1.5 border", trendBorder, trendBg)}>
                {/* Pulse dot */}
                <span className="relative flex h-1.5 w-1.5 mr-0.5">
                  <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-60", trendColor.replace("text-", "bg-"))} />
                  <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", trendColor.replace("text-", "bg-"))} />
                </span>
                <TrendIcon className={cn("h-3 w-3", trendColor)} />
                <span className={cn("text-[9px] font-bold uppercase tracking-[0.12em]", trendColor)}>
                  {trendLabel}
                </span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-accent/50 transition-all" />
            </div>
          </div>

          {sector.brief && (
            <p className="text-[13px] text-foreground/60 leading-[1.75] line-clamp-2 mt-3 headline-font-italic max-w-[780px]">
              {sector.brief}
            </p>
          )}
        </div>

        {/* Stats + signals row */}
        <div className="grid grid-cols-[auto_1fr] divide-x divide-border/30">
          {/* Stats */}
          <div className="flex divide-x divide-border/30">
            <StatBox value={sector.companyCount} label="Companies" delay={0.15} />
            <StatBox value={sector.articleCount} label="Articles" delay={0.2} />
            <StatBox value={sector.competitorCount} label="Competitors" delay={0.25} />
          </div>

          {/* Article activity bar + signals */}
          <div className="px-6 py-4 flex flex-col justify-between gap-3">
            {/* Activity bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground/35 mono">
                  Activity
                </span>
                <span className="text-[8px] mono text-muted-foreground/30">{articlePct}%</span>
              </div>
              <div className="h-1 bg-foreground/[0.06] rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full", trendColor.replace("text-", "bg-"))}
                  initial={{ width: 0 }}
                  animate={{ width: `${articlePct}%` }}
                  transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
                />
              </div>
            </div>

            {/* Top signals */}
            {signals.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground/35 mono block">
                  Top Signals
                </span>
                {signals.slice(0, 3).map((sig, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06, duration: 0.3 }}
                    className="flex items-start gap-1.5"
                  >
                    <div className={cn("h-1 w-1 rounded-full shrink-0 mt-1.5", trendColor.replace("text-", "bg-"))} />
                    <span className="text-[11px] text-foreground/55 leading-[1.45] line-clamp-1">
                      {truncateSignal(sig)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Minus, Activity, Building2, Newspaper, Swords } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { SectorBrief } from "@/types/company";

const TREND_CONFIG = {
  growing: { icon: TrendingUp, color: "text-signal-positive", label: "Growing" },
  stable: { icon: Minus, color: "text-signal-neutral", label: "Stable" },
  declining: { icon: TrendingDown, color: "text-signal-negative", label: "Declining" },
  volatile: { icon: Activity, color: "text-accent", label: "Volatile" },
} as const;

export function SectorCard({ sector }: { sector: SectorBrief }) {
  const trend = sector.metadata?.trendDirection ?? "stable";
  const { icon: TrendIcon, color: trendColor, label: trendLabel } = TREND_CONFIG[trend];

  return (
    <Link
      to={`/sectors/${encodeURIComponent(sector.sector)}`}
      className="group glass-card p-5 border border-border/40 hover:border-accent/30 transition-all block"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-[14px] font-bold text-foreground/85 group-hover:text-accent transition-colors">
          {sector.sector}
        </h3>
        <div className={cn("flex items-center gap-1", trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span className="text-[8px] font-bold uppercase tracking-[0.1em]">{trendLabel}</span>
        </div>
      </div>

      {sector.brief && (
        <p className="text-[12px] text-muted-foreground/60 leading-[1.6] line-clamp-3 mb-4 headline-font-italic">
          {sector.brief}
        </p>
      )}

      {/* Signals */}
      {sector.metadata?.topSignals && sector.metadata.topSignals.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {sector.metadata.topSignals.slice(0, 3).map((signal) => (
            <span key={signal} className="text-[7px] px-1.5 py-0.5 bg-foreground/[0.04] text-muted-foreground/60 mono uppercase tracking-[0.1em]">
              {signal}
            </span>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 pt-3 border-t border-border/30">
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground/50">
          <Building2 className="h-2.5 w-2.5" /> {sector.companyCount}
        </span>
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground/50">
          <Newspaper className="h-2.5 w-2.5" /> {sector.articleCount}
        </span>
        <span className="flex items-center gap-1 text-[9px] text-muted-foreground/50">
          <Swords className="h-2.5 w-2.5" /> {sector.competitorCount}
        </span>
        {sector.generatedAt && (
          <span className="text-[8px] text-muted-foreground/35 mono ml-auto">
            {formatDistanceToNow(new Date(sector.generatedAt), { addSuffix: true })}
          </span>
        )}
      </div>
    </Link>
  );
}

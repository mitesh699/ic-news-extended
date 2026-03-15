import { Link } from "react-router-dom";
import { Building2, Newspaper, Swords } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getTrendConfig } from "@/lib/sector-config";
import { truncateSignal } from "@/lib/format-signal";
import type { SectorBrief } from "@/types/company";

export function SectorCard({ sector }: { sector: SectorBrief }) {
  const { icon: TrendIcon, color: trendColor, border: trendBorder, label: trendLabel } =
    getTrendConfig(sector.metadata?.trendDirection);

  const signals = sector.metadata?.topSignals ?? [];

  return (
    <motion.div whileHover={{ y: -3, transition: { duration: 0.18 } }}>
      <Link
        to={`/sectors/${encodeURIComponent(sector.sector)}`}
        className={cn(
          "group glass-card border-l-4 hover:border-accent/30 transition-colors block h-full",
          trendBorder,
        )}
      >
        {/* Card header */}
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-[15px] font-bold tracking-[-0.01em] headline-font text-foreground/85 group-hover:text-accent transition-colors leading-[1.2]">
              {sector.sector}
            </h3>
            <div className={cn("flex items-center gap-1 shrink-0 ml-3", trendColor)}>
              <TrendIcon className="h-3 w-3" />
              <span className="text-[8px] font-bold uppercase tracking-[0.12em]">{trendLabel}</span>
            </div>
          </div>

          {sector.brief && (
            <p className="text-[12px] text-foreground/55 leading-[1.65] line-clamp-3 headline-font-italic">
              {sector.brief}
            </p>
          )}
        </div>

        {/* Signals */}
        {signals.length > 0 && (
          <div className="px-5 pb-4 flex flex-wrap gap-1.5">
            {signals.slice(0, 2).map((sig, i) => (
              <span
                key={i}
                className="text-[9px] px-2 py-1 bg-foreground/[0.04] border border-border/30 text-foreground/50 leading-[1.3] line-clamp-1 max-w-[200px]"
              >
                {truncateSignal(sig, 32)}
              </span>
            ))}
          </div>
        )}

        {/* Stats footer */}
        <div className="flex items-center gap-4 px-5 py-3 border-t border-border/25 bg-foreground/[0.01]">
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground/50">
            <Building2 className="h-2.5 w-2.5" />
            <span className="font-bold mono text-foreground/55">{sector.companyCount}</span>
            <span className="uppercase tracking-[0.08em]">co.</span>
          </span>
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground/50">
            <Newspaper className="h-2.5 w-2.5" />
            <span className="font-bold mono text-foreground/55">{sector.articleCount}</span>
            <span className="uppercase tracking-[0.08em]">art.</span>
          </span>
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground/50">
            <Swords className="h-2.5 w-2.5" />
            <span className="font-bold mono text-foreground/55">{sector.competitorCount}</span>
            <span className="uppercase tracking-[0.08em]">comp.</span>
          </span>
          {sector.generatedAt && (
            <span className="text-[8px] text-muted-foreground/30 mono ml-auto">
              {formatDistanceToNow(new Date(sector.generatedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

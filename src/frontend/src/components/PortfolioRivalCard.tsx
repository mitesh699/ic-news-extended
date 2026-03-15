import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSentiment, sentimentClass } from "@/lib/sentiment";
import type { Company } from "@/types/company";

export function PortfolioRivalCard({ rival }: { rival: Company }) {
  const pos = rival.newsArticles.filter(a => a.signal === "positive").length;
  const neg = rival.newsArticles.filter(a => a.signal === "negative").length;
  const sentiment = getSentiment(pos, neg);

  const signals = rival.summaryMeta?.signals ?? [];

  return (
    <Link
      to={`/company/${rival.id}`}
      className="group glass-card p-5 border border-border/40 hover:border-accent/30 transition-all block mb-8"
    >
      <p className="section-label mb-3">Closest Portfolio Peer</p>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-[18px] font-bold tracking-[-0.02em] headline-font text-foreground/85 group-hover:text-accent transition-colors">
              {rival.name}
            </h3>
            <span className={cn("text-[8px] font-bold uppercase tracking-[0.14em] px-2 py-0.5", sentimentClass(sentiment))}>
              {sentiment}
            </span>
            <span className="text-[9px] text-muted-foreground/40 mono">{rival.newsArticles.length} articles</span>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40 mb-3">
            {rival.sector} — {rival.description}
          </p>

          {rival.businessProfile ? (
            <p className="text-[13px] text-foreground/65 leading-[1.7] line-clamp-3 headline-font-italic">
              {rival.businessProfile}
            </p>
          ) : rival.summary ? (
            <p className="text-[13px] text-foreground/65 leading-[1.7] line-clamp-3 headline-font-italic">
              {rival.summary}
            </p>
          ) : null}

          {signals.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {signals.slice(0, 4).map(sig => (
                <span key={sig} className="text-[7px] px-1.5 py-0.5 bg-foreground/[0.04] text-muted-foreground/50 mono uppercase tracking-[0.1em]">
                  {sig}
                </span>
              ))}
            </div>
          )}
        </div>

        <ArrowUpRight className="h-4 w-4 shrink-0 mt-1 text-muted-foreground/0 group-hover:text-accent/60 transition-all" />
      </div>
    </Link>
  );
}

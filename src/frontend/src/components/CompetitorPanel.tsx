import { Swords, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useCompetitors } from "@/hooks/useCompetitors";
import { cn } from "@/lib/utils";
import type { CompetitorArticle } from "@/types/company";

const SIGNAL_COLORS: Record<string, string> = {
  funding: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  hiring: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  product: "bg-green-500/10 text-green-600 dark:text-green-400",
  regulatory: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  "M&A": "bg-red-500/10 text-red-600 dark:text-red-400",
  risk: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function SentimentIcon({ sentiment }: { sentiment: string | null }) {
  if (sentiment === "positive") return <TrendingUp className="h-3 w-3 text-signal-positive" />;
  if (sentiment === "negative") return <TrendingDown className="h-3 w-3 text-signal-negative" />;
  return <Minus className="h-3 w-3 text-signal-neutral" />;
}

function CompetitorArticleItem({ article }: { article: CompetitorArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2.5 py-2.5 border-b border-border/20 last:border-0 hover:bg-foreground/[0.02] transition-colors"
    >
      <SentimentIcon sentiment={article.sentiment} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-foreground/75 leading-[1.4] group-hover:text-accent transition-colors line-clamp-2">
          {article.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[8px] text-muted-foreground/50 mono uppercase tracking-[0.1em]">
            {article.sourceName || article.source}
          </span>
          {article.signal && (
            <span className={cn("text-[7px] px-1.5 py-0.5 font-bold uppercase tracking-[0.1em]", SIGNAL_COLORS[article.signal] ?? "bg-muted text-muted-foreground")}>
              {article.signal}
            </span>
          )}
          {article.publishedAt && (
            <span className="text-[8px] text-muted-foreground/40 mono">
              {formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover:text-accent/50 transition-all mt-0.5" />
    </a>
  );
}

export function CompetitorPanel({ companyId }: { companyId: string }) {
  const { data: competitors, isLoading } = useCompetitors(companyId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <p className="section-label flex items-center gap-2"><Swords className="h-3 w-3" /> Competitors</p>
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!competitors || competitors.length === 0) {
    return (
      <div>
        <p className="section-label flex items-center gap-2 mb-3"><Swords className="h-3 w-3" /> Competitors</p>
        <p className="text-[11px] text-muted-foreground/50 italic">No competitors tracked yet.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="section-label flex items-center gap-2 mb-4"><Swords className="h-3 w-3" /> Competitor Intelligence</p>
      <div className="space-y-6">
        {competitors.map((comp, i) => (
          <motion.div
            key={comp.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="glass-card p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-[12px] font-bold text-foreground/80">{comp.name}</h4>
                {comp.sector && (
                  <span className="text-[8px] text-muted-foreground/50 uppercase tracking-[0.12em]">{comp.sector}</span>
                )}
              </div>
              <span className={cn(
                "text-[7px] px-1.5 py-0.5 font-bold uppercase tracking-[0.1em]",
                comp.relevance === "direct" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"
              )}>
                {comp.relevance}
              </span>
            </div>
            {comp.articles.length > 0 ? (
              <div className="divide-y divide-border/10">
                {comp.articles.map((article) => (
                  <CompetitorArticleItem key={article.id} article={article} />
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground/40 italic">No recent articles.</p>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

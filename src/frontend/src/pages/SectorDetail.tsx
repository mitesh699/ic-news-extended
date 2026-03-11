import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus, Activity, AlertCircle, Eye, Swords } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { fetchSectorBrief } from "@/lib/api";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageTransition } from "@/components/PageTransition";
import { ChatWidget } from "@/components/ChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SectorBriefMeta } from "@/types/company";

const TREND_CONFIG = {
  growing: { icon: TrendingUp, color: "text-signal-positive", border: "border-signal-positive/30" },
  stable: { icon: Minus, color: "text-signal-neutral", border: "border-border" },
  declining: { icon: TrendingDown, color: "text-signal-negative", border: "border-signal-negative/30" },
  volatile: { icon: Activity, color: "text-accent", border: "border-accent/30" },
} as const;

export default function SectorDetail() {
  const { sector: sectorParam } = useParams<{ sector: string }>();
  const sector = sectorParam ? decodeURIComponent(sectorParam) : "";

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sector-brief", sector],
    queryFn: () => fetchSectorBrief(sector),
    enabled: !!sector,
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="section-label">Loading sector brief...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-6 w-6 text-destructive/60" />
        <p className="text-[13px] text-muted-foreground">Failed to load sector brief</p>
        <Button size="sm" variant="outline" className="h-8 text-[10px] rounded-none" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-[15px] text-muted-foreground">No brief for "{sector}" yet.</p>
        <Link to="/sectors" className="text-[11px] text-accent hover:underline">&larr; Back to sectors</Link>
      </div>
    );
  }

  const meta: SectorBriefMeta | null = data.metadata;
  const trend = meta?.trendDirection ?? "stable";
  const { icon: TrendIcon, color: trendColor, border: trendBorder } = TREND_CONFIG[trend];

  return (
    <PageTransition className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-header border-b border-border/60">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-[56px]">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8" />
            <div className="h-5 w-px bg-border/40" />
            <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]">
              <Link to="/sectors" className="text-muted-foreground/60 hover:text-foreground transition-colors">Sectors</Link>
              <span className="text-muted-foreground/30">/</span>
              <span className="text-foreground/80 truncate max-w-[200px]">{sector}</span>
            </nav>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="border-b border-border/40">
        <div className="max-w-[1200px] mx-auto px-6 py-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">Sector Intelligence</p>
            <div className="flex items-start justify-between gap-6">
              <h1 className="text-[42px] font-bold tracking-[-0.04em] headline-font text-foreground leading-[1.1]">
                {sector}
              </h1>
              <div className={cn("px-4 py-2 border glass-card flex items-center gap-2", trendBorder)}>
                <TrendIcon className={cn("h-4 w-4", trendColor)} />
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Trend</p>
                  <p className={cn("text-[14px] font-bold uppercase tracking-[0.08em]", trendColor)}>{trend}</p>
                </div>
              </div>
            </div>
            {data.generatedAt && (
              <p className="text-[9px] text-muted-foreground/40 mono mt-3">
                Generated {formatDistanceToNow(new Date(data.generatedAt), { addSuffix: true })}
              </p>
            )}
          </motion.div>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-[1fr_340px] gap-10">
          <div>
            {/* Brief */}
            {data.brief && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="p-6 border-l-2 border-accent glass-card mb-8 glow-accent"
              >
                <p className="section-label mb-3">AI Sector Brief</p>
                <p className="text-[16px] text-foreground/85 leading-[1.8] headline-font-italic">{data.brief}</p>
              </motion.div>
            )}

            {/* Competitor Moves */}
            {meta?.competitorMoves && meta.competitorMoves.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4 }}
                className="mb-8"
              >
                <p className="section-label mb-4 flex items-center gap-2">
                  <Swords className="h-3 w-3" /> Competitor Moves
                </p>
                <div className="space-y-3">
                  {meta.competitorMoves.map((move, i) => (
                    <div key={i} className="glass-card p-4 border-l-2 border-l-accent/30">
                      <p className="text-[13px] text-foreground/75 leading-[1.6]">{move}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-[80px] space-y-6">
              {/* Top Signals */}
              {meta?.topSignals && meta.topSignals.length > 0 && (
                <div className="glass-card p-4">
                  <p className="section-label mb-3 flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Top Signals
                  </p>
                  <div className="space-y-2">
                    {meta.topSignals.map((signal, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-accent shrink-0 mt-1.5" />
                        <p className="text-[11px] text-foreground/70 leading-[1.5]">{signal}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Watch List */}
              {meta?.watchList && meta.watchList.length > 0 && (
                <div className="glass-card p-4">
                  <p className="section-label mb-3 flex items-center gap-2">
                    <Eye className="h-3 w-3" /> Watch List
                  </p>
                  <div className="space-y-2">
                    {meta.watchList.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-signal-neutral shrink-0 mt-1.5" />
                        <p className="text-[11px] text-foreground/70 leading-[1.5]">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <ChatWidget />
    </PageTransition>
  );
}

import { useState, useMemo } from "react";
import { AlertCircle, TrendingDown, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useSectors } from "@/hooks/useSectors";
import { SectorCard } from "@/components/SectorCard";
import { SectorFeatureCard } from "@/components/SectorFeatureCard";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageTransition } from "@/components/PageTransition";
import { ChatWidget } from "@/components/ChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/lib/use-count-up";
import type { SectorBrief } from "@/types/company";

function StatsBar({ stats }: { stats: { total: number; companies: number; articles: number; growing: number; declining: number } }) {
  const total = useCountUp(stats.total);
  const companies = useCountUp(stats.companies);
  const articles = useCountUp(stats.articles);
  const growing = useCountUp(stats.growing);
  const declining = useCountUp(stats.declining);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.35 }}
      className="flex items-stretch border border-border/40 mb-8 divide-x divide-border/40"
    >
      {[
        { value: total, label: "Sectors" },
        { value: companies, label: "Companies" },
        { value: articles.toLocaleString(), label: "Articles" },
        { value: growing, label: "Growing", color: "text-signal-positive" },
        { value: declining, label: "Declining", color: "text-signal-negative" },
      ].map(({ value, label, color }) => (
        <div key={label} className="flex-1 px-4 py-4 text-center">
          <p className={cn("text-[22px] font-bold mono tabular-nums leading-none", color ?? "text-foreground/80")}>
            {value}
          </p>
          <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 mt-1.5">{label}</p>
        </div>
      ))}
    </motion.div>
  );
}

type SortOption = "mostActive" | "trending" | "alpha";
type TrendFilter = "all" | "growing" | "stable" | "declining" | "volatile";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "mostActive", label: "Most Active" },
  { value: "trending", label: "Trending Up" },
  { value: "alpha", label: "A–Z" },
];

const FILTER_OPTIONS: { value: TrendFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "growing", label: "Growing" },
  { value: "stable", label: "Stable" },
  { value: "volatile", label: "Volatile" },
  { value: "declining", label: "Declining" },
];

const TREND_ORDER: Record<string, number> = { growing: 0, stable: 1, volatile: 2, declining: 3 };

function sortSectors(sectors: SectorBrief[], sort: SortOption): SectorBrief[] {
  const copy = [...sectors];
  if (sort === "mostActive") return copy.sort((a, b) => b.articleCount - a.articleCount);
  if (sort === "trending") return copy.sort((a, b) => (TREND_ORDER[a.metadata?.trendDirection ?? "stable"] ?? 1) - (TREND_ORDER[b.metadata?.trendDirection ?? "stable"] ?? 1));
  return copy.sort((a, b) => a.sector.localeCompare(b.sector));
}

export default function Sectors() {
  const { data: sectors, isLoading, error, refetch } = useSectors();
  const [sort, setSort] = useState<SortOption>("mostActive");
  const [filter, setFilter] = useState<TrendFilter>("all");

  const stats = useMemo(() => {
    if (!sectors) return null;
    return {
      total: sectors.length,
      companies: sectors.reduce((sum, s) => sum + s.companyCount, 0),
      articles: sectors.reduce((sum, s) => sum + s.articleCount, 0),
      growing: sectors.filter(s => s.metadata?.trendDirection === "growing").length,
      declining: sectors.filter(s => s.metadata?.trendDirection === "declining").length,
      maxArticles: Math.max(...sectors.map(s => s.articleCount), 1),
    };
  }, [sectors]);

  const filtered = useMemo(() => {
    if (!sectors) return [];
    const base = filter === "all" ? sectors : sectors.filter(s => s.metadata?.trendDirection === filter);
    return sortSectors(base, sort);
  }, [sectors, sort, filter]);

  const watchList = useMemo(
    () => sectors?.filter(s => s.metadata?.trendDirection === "declining" || s.metadata?.trendDirection === "volatile") ?? [],
    [sectors]
  );

  const [featured, ...rest] = filtered;
  const maxArticles = stats?.maxArticles ?? 1;

  return (
    <PageTransition className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-header border-b border-border/60">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-[56px]">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8" />
            <div className="h-5 w-px bg-border/40" />
            <h1 className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/80">
              Sector Intelligence
            </h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Page heading */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">Intelligence</p>
          <h2 className="text-[32px] font-bold tracking-[-0.03em] headline-font text-foreground leading-[1.1] mb-1">
            Sector Pulse
          </h2>
          <p className="text-[12px] text-muted-foreground/50 mb-6">
            Cross-portfolio signals, ranked by activity.
          </p>
        </motion.div>

        {/* Stats bar */}
        {stats && <StatsBar stats={stats} />}

        {/* Sort + Filter controls */}
        {sectors && sectors.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="flex items-center gap-6 mb-7"
          >
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground/30 mb-1.5 mono">Sort</p>
              <div className="flex gap-1">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSort(opt.value)}
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 transition-colors",
                      sort === opt.value
                        ? "bg-foreground text-background"
                        : "text-muted-foreground/40 hover:text-foreground/70"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground/30 mb-1.5 mono">Trend</p>
              <div className="flex gap-1">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={cn(
                      "text-[9px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 transition-colors",
                      filter === opt.value
                        ? "bg-foreground text-background"
                        : "text-muted-foreground/40 hover:text-foreground/70"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            <div className="h-44 bg-muted/30 animate-pulse" />
            <div className="grid md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-36 bg-muted/30 animate-pulse" />)}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <AlertCircle className="h-6 w-6 text-destructive/60" />
            <p className="text-[13px] text-muted-foreground">Failed to load sector data</p>
            <Button size="sm" variant="outline" className="h-8 text-[10px] rounded-none" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Empty */}
        {sectors && sectors.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[13px] text-muted-foreground/50">No sectors with data yet.</p>
          </div>
        )}

        {/* No results after filter */}
        {!isLoading && sectors && sectors.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[13px] text-muted-foreground/50">No sectors match the current filter.</p>
            <button onClick={() => setFilter("all")} className="text-[11px] text-accent hover:underline mt-2">
              Clear filter
            </button>
          </div>
        )}

        {/* Featured + grid */}
        {filtered.length > 0 && (
          <div className="space-y-8">
            {/* #1 featured — full width */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.35 }}
            >
              <SectorFeatureCard sector={featured} rank={1} maxArticles={maxArticles} />
            </motion.div>

            {/* Rest — 2-col grid */}
            {rest.length > 0 && (
              <div className="grid md:grid-cols-2 gap-4">
                {rest.map((sector, i) => (
                  <motion.div
                    key={sector.sector}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.04, duration: 0.3 }}
                  >
                    <SectorCard sector={sector} />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Watch List */}
            {watchList.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <p className="section-label mb-3 flex items-center gap-2 text-signal-negative/70">
                  Watch List
                </p>
                <div className="space-y-2">
                  {watchList.map(s => {
                    const isDecline = s.metadata?.trendDirection === "declining";
                    return (
                      <div key={s.sector} className={cn(
                        "flex items-center gap-3 px-4 py-3 border",
                        isDecline ? "border-signal-negative/20 bg-signal-negative/[0.03]" : "border-accent/20 bg-accent/[0.03]"
                      )}>
                        {isDecline
                          ? <TrendingDown className="h-3.5 w-3.5 text-signal-negative/60 shrink-0" />
                          : <Activity className="h-3.5 w-3.5 text-accent/60 shrink-0" />
                        }
                        <span className="text-[11px] font-bold text-foreground/70">{s.sector}</span>
                        <span className={cn(
                          "text-[8px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5",
                          isDecline ? "text-signal-negative/70 bg-signal-negative/10" : "text-accent/70 bg-accent/10"
                        )}>
                          {s.metadata?.trendDirection}
                        </span>
                        {s.metadata?.topSignals?.[0] && (
                          <span className="text-[10px] text-muted-foreground/50 ml-1">
                            · {s.metadata.topSignals[0]}
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground/35 mono ml-auto">
                          {s.articleCount} articles · {s.companyCount} co.
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </main>

      <ChatWidget />
    </PageTransition>
  );
}

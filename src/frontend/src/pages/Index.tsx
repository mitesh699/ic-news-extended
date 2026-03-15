import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RefreshCw, Search, Zap, TrendingUp, TrendingDown, Minus, Newspaper, AlertCircle, ArrowUpRight, Building2, ChevronDown, BarChart3 } from "lucide-react";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TickerBar } from "@/components/TickerBar";
import { ChatWidget } from "@/components/ChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NewsItem, getTimeFilter } from "@/components/NewsItem";
import { PageTransition } from "@/components/PageTransition";
import { NotificationBell } from "@/components/NotificationBell";
import { SignalHeatmap } from "@/components/SignalHeatmap";
import { SentimentTrend } from "@/components/SentimentTrend";
import { useCompanies, useRefreshNews } from "@/hooks/useCompanies";
import { useNotifications } from "@/hooks/useNotifications";
import { useSignalHeatmap, useSentimentTrend } from "@/hooks/useAnalytics";
import type { DateFilter, SignalFilter } from "@/types/company";
import { cn } from "@/lib/utils";

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const SIGNAL_FILTERS: { value: SignalFilter; label: string; icon?: React.ReactNode; color?: string }[] = [
  { value: "all", label: "All Signals" },
  { value: "breaking", label: "Breaking", icon: <Zap className="h-3.5 w-3.5" />, color: "text-accent" },
  { value: "positive", label: "Positive", icon: <TrendingUp className="h-3.5 w-3.5" />, color: "text-signal-positive" },
  { value: "negative", label: "Negative", icon: <TrendingDown className="h-3.5 w-3.5" />, color: "text-signal-negative" },
  { value: "neutral", label: "Neutral", icon: <Minus className="h-3.5 w-3.5" />, color: "text-signal-neutral" },
];

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { data: companies, isLoading, error, refetch } = useCompanies();
  const refreshMutation = useRefreshNews();

  const allArticleDates = useMemo(() => {
    if (!companies) return [];
    return companies.flatMap(c => c.newsArticles.map(a => ({ publishedAt: a.publishedAt, fetchedAt: a.fetchedAt })));
  }, [companies]);
  const { newCount, markSeen } = useNotifications(allArticleDates);

  // Recent articles for notification panel (sorted by date, most recent first)
  const recentNotificationArticles = useMemo(() => {
    if (!companies) return [];
    return companies
      .flatMap(c => c.newsArticles.map(a => ({ article: a, companyName: c.name })))
      .sort((a, b) => {
        const tA = new Date(a.article.publishedAt ?? a.article.fetchedAt).getTime();
        const tB = new Date(b.article.publishedAt ?? b.article.fetchedAt).getTime();
        return tB - tA;
      })
      .slice(0, 8);
  }, [companies]);

  const lastRefreshed = useMemo(() => {
    if (!companies?.length) return null;
    const dates = companies.map(c => new Date(c.lastUpdated).getTime()).filter(Boolean);
    return dates.length ? new Date(Math.max(...dates)) : null;
  }, [companies]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const { data: signalData } = useSignalHeatmap();
  const { data: sentimentData } = useSentimentTrend();

  // Sync signal filter from URL params (e.g. /?signal=breaking)
  useEffect(() => {
    const sig = searchParams.get("signal");
    if (sig && ["breaking", "positive", "negative", "neutral"].includes(sig)) {
      setSignalFilter(sig as SignalFilter);
    }
  }, [searchParams]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [signalFilter, dateFilter, search]);

  const breakingNews = useMemo(() => {
    if (!companies) return [];
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    return companies.flatMap(c =>
      c.newsArticles
        .filter(a => a.isBreaking && new Date(a.publishedAt ?? a.fetchedAt).getTime() > sevenDaysAgo)
        .map(a => ({ article: a, companyName: c.name }))
    );
  }, [companies]);

  const totalArticles = companies?.reduce((sum, c) => sum + c.newsArticles.length, 0) || 0;

  const allNews = useMemo(() => {
    if (!companies) return [];
    return companies
      .flatMap(c => c.newsArticles.map(a => ({ article: a, companyName: c.name, companyId: c.id, sector: c.sector })))
      .filter(({ article }) => {
        if (signalFilter === "breaking") return article.isBreaking;
        if (signalFilter !== "all") return article.signal === signalFilter;
        return true;
      })
      .filter(({ article }) => getTimeFilter(article, dateFilter))
      .filter(({ article, companyName }) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return article.title.toLowerCase().includes(q) || companyName.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // Articles with real dates first, sorted desc; then undated articles by fetchedAt desc
        const aHasDate = !!a.article.publishedAt;
        const bHasDate = !!b.article.publishedAt;
        if (aHasDate !== bHasDate) return bHasDate ? 1 : -1;
        const tA = new Date(a.article.publishedAt ?? a.article.fetchedAt).getTime();
        const tB = new Date(b.article.publishedAt ?? b.article.fetchedAt).getTime();
        return tB - tA;
      });
  }, [companies, signalFilter, dateFilter, search]);

  // Top 4 hero articles (breaking first, then most recent)
  const heroArticles = useMemo(() => {
    const breaking = allNews.filter(n => n.article.isBreaking);
    const rest = allNews.filter(n => !n.article.isBreaking);
    return [...breaking, ...rest].slice(0, 4);
  }, [allNews]);

  // Remaining articles for the feed
  const feedArticles = useMemo(() => {
    const heroIds = new Set(heroArticles.map(h => h.article.id));
    return allNews.filter(n => !heroIds.has(n.article.id));
  }, [allNews, heroArticles]);

  return (
    <PageTransition className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-header border-b border-border/60">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between px-4 h-[56px]">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8" />
            <div className="h-5 w-px bg-border/40" />
            <h1 className="text-[16px] font-bold tracking-[-0.04em] text-foreground uppercase">
              Initialized
            </h1>
            <div className="hidden sm:flex items-center gap-3">
              <div className="h-4 w-px bg-border/60" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Portfolio Intelligence</span>
            </div>
          </div>

          <div className="flex items-center gap-4">

            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/30" />
              <Input
                placeholder="Search news..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-44 text-[11px] bg-foreground/[0.03] border-border/40 rounded-none focus:bg-card"
              />
            </div>

            {lastRefreshed && (
              <span className="hidden xl:block text-[9px] text-muted-foreground/60 mono uppercase tracking-[0.08em]">
                Updated {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
              </span>
            )}
            <ThemeToggle />
            <NotificationBell count={newCount} articles={recentNotificationArticles} onMarkSeen={markSeen} />
            <Button
              size="sm"
              className="h-8 text-[9px] font-bold uppercase tracking-[0.12em] px-4 rounded-none gap-2 focus-visible:ring-2 focus-visible:ring-foreground/20"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={cn("h-3 w-3", refreshMutation.isPending && "animate-spin")} />
              {refreshMutation.isPending ? "Updating" : "Update"}
            </Button>
          </div>
        </div>
      </header>

      {/* Ticker */}
      <TickerBar breakingNews={breakingNews} />

      {/* Analytics section */}
      {!isLoading && (signalData?.length || sentimentData?.length) && (
        <div className="border-b border-border/40">
          <div className="max-w-[1440px] mx-auto px-4">
            <button
              onClick={() => setAnalyticsOpen((o) => !o)}
              className="flex items-center gap-2 py-3 w-full text-left group"
            >
              <BarChart3 className="h-3 w-3 text-muted-foreground/50" />
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60 group-hover:text-foreground transition-colors">
                Analytics
              </span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-muted-foreground/40 transition-transform duration-200",
                  analyticsOpen && "rotate-180"
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {analyticsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="overflow-hidden"
                >
                  <div className="grid md:grid-cols-2 gap-6 pb-6">
                    <div className="glass-card p-4">
                      <p className="section-label mb-3">Signal Heatmap by Sector</p>
                      <SignalHeatmap data={signalData ?? []} />
                    </div>
                    <div className="glass-card p-4">
                      <p className="section-label mb-3">Sentiment Trend (7 days)</p>
                      <SentimentTrend data={sentimentData ?? []} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-3">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] text-destructive font-medium">
              <AlertCircle className="h-4 w-4" />
              Failed to load portfolio data. Check your connection.
            </span>
            <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-none" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="sticky top-[56px] z-20 glass-header border-b border-border/40">
        <div className="max-w-[1440px] mx-auto px-4 py-2 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="section-label text-[8px]">Date</span>
            <div className="flex gap-0.5" role="tablist" aria-label="Date filter">
              {DATE_FILTERS.map(d => (
                <button key={d.value} onClick={() => setDateFilter(d.value)} role="tab" aria-selected={dateFilter === d.value}
                  className={cn("filter-pill focus-visible:ring-2 focus-visible:ring-foreground/20", dateFilter === d.value && "filter-pill-active")}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-4 w-px bg-border/30 shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <span className="section-label text-[8px]">Signal</span>
            <div className="flex gap-1" role="tablist" aria-label="Signal filter">
              {SIGNAL_FILTERS.map(s => (
                <button key={s.value} onClick={() => setSignalFilter(s.value)} role="tab" aria-selected={signalFilter === s.value}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] border transition-colors focus-visible:ring-2 focus-visible:ring-foreground/20",
                    signalFilter === s.value
                      ? "bg-foreground text-background border-foreground"
                      : "text-muted-foreground/60 border-border/40 hover:text-foreground hover:border-border"
                  )}>
                  {s.icon && <span className={cn(signalFilter === s.value ? "text-background" : s.color)}>{s.icon}</span>}
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile search */}
      <div className="md:hidden px-4 py-3 bg-card border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/30" />
          <Input placeholder="Search news..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-[11px] bg-foreground/[0.03] rounded-none" />
        </div>
      </div>

      {/* Main */}
      <main className="max-w-[1440px] mx-auto px-4 py-8">
        {/* Empty state — no companies loaded */}
        {!isLoading && !error && companies && companies.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-28 text-center">
            <div className="h-14 w-14 border border-border/60 flex items-center justify-center mb-5">
              <Building2 className="h-5 w-5 text-muted-foreground/40" />
            </div>
            <p className="text-[13px] font-medium text-muted-foreground">No companies tracked yet</p>
            <p className="text-[11px] text-muted-foreground/40 mt-1">Hit Update to fetch portfolio news</p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[10px] font-bold uppercase tracking-[0.1em] px-5 rounded-none mt-4 gap-2"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={cn("h-3 w-3", refreshMutation.isPending && "animate-spin")} />
              {refreshMutation.isPending ? "Updating" : "Fetch Now"}
            </Button>
          </motion.div>
        )}

        {/* Hero loading skeleton */}
        {isLoading && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div className="h-3 w-24 bg-foreground/[0.06] animate-pulse" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={cn("glass-card p-5 space-y-3", i === 0 && "md:row-span-2 p-6")}>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-foreground/[0.06] animate-pulse" />
                    <div className="h-2.5 w-16 bg-foreground/[0.06] animate-pulse" />
                    <div className="h-2.5 w-20 bg-foreground/[0.04] animate-pulse" />
                  </div>
                  <div className="h-5 w-4/5 bg-foreground/[0.06] animate-pulse" />
                  <div className="h-5 w-3/5 bg-foreground/[0.04] animate-pulse" />
                  <div className="h-3 w-full bg-foreground/[0.03] animate-pulse mt-2" />
                  <div className="h-3 w-2/3 bg-foreground/[0.03] animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Hero Headlines */}
        {!isLoading && heroArticles.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <p className="section-label flex items-center gap-2">
                <Zap className="h-3 w-3" /> Top Stories
              </p>
              <span className="text-[8px] text-muted-foreground/30 mono uppercase tracking-[0.1em]">{allNews.length} total</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {heroArticles.map(({ article, companyName, companyId }, i) => {
                const displayDate = new Date(article.publishedAt ?? article.fetchedAt);
                const exactDate = differenceInDays(new Date(), displayDate) > 6
                  ? format(displayDate, "MMM d, yyyy")
                  : format(displayDate, "MMM d, HH:mm");
                const isLead = i === 0;
                return (
                  <motion.a
                    key={article.id}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    className={cn(
                      "glass-card group flex flex-col gap-3 hover:border-foreground/20 transition-all",
                      isLead ? "p-6 md:row-span-2" : "p-5",
                    )}
                  >
                    {/* Signal + metadata row */}
                    <div className="flex items-center gap-2">
                      {article.signal === "positive" && <span className="h-2 w-2 rounded-full bg-signal-positive" />}
                      {article.signal === "negative" && <span className="h-2 w-2 rounded-full bg-signal-negative" />}
                      {article.signal === "neutral" && <span className="h-2 w-2 rounded-full bg-signal-neutral/60" />}
                      {article.isBreaking && (
                        <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-accent bg-accent/10 px-1.5 py-0.5 breaking-pulse">
                          Breaking
                        </span>
                      )}
                      <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">{article.source}</span>
                      <span className="text-muted-foreground/20 text-[8px]">-</span>
                      <span className="text-[9px] text-muted-foreground/40 mono tracking-[0.06em]">{exactDate}</span>
                      <span className="text-muted-foreground/20 text-[8px]">-</span>
                      <span className="text-[9px] text-muted-foreground/35 mono">
                        {formatDistanceToNow(displayDate, { addSuffix: true })}
                      </span>
                    </div>

                    {/* Title */}
                    <p className={cn(
                      "font-semibold leading-[1.4] text-foreground/85 group-hover:text-foreground transition-colors headline-font",
                      isLead ? "text-[22px] md:text-[26px]" : "text-[16px]",
                    )}>
                      {article.isBreaking && <Zap className="inline h-4 w-4 text-accent mr-1.5 -mt-0.5 breaking-pulse" />}
                      {article.title}
                    </p>

                    {/* Summary */}
                    {article.summary && (
                      <p className={cn(
                        "text-muted-foreground/55 leading-[1.6] headline-font-italic",
                        isLead ? "text-[14px] line-clamp-3" : "text-[12px] line-clamp-2",
                      )}>
                        {article.summary}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/company/${companyId}`); }}
                        className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-[0.1em] hover:text-accent transition-colors"
                      >
                        {companyName}
                      </button>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/0 group-hover:text-accent/60 transition-all" />
                    </div>
                  </motion.a>
                );
              })}
            </div>
          </section>
        )}

        {/* All Articles Feed */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <p className="section-label flex items-center gap-2">
              <Newspaper className="h-3 w-3" /> All Coverage
              {!isLoading && <span className="text-muted-foreground/40">— {feedArticles.length}</span>}
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 bg-foreground/[0.03] animate-pulse" />
              ))}
            </div>
          ) : feedArticles.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center">
              <Newspaper className="h-6 w-6 text-muted-foreground/30 mb-3" />
              <p className="text-[13px] font-medium text-muted-foreground">No articles match</p>
              <p className="text-[11px] text-muted-foreground/40 mt-1">Adjust your filters</p>
            </motion.div>
          ) : (
            <div>
              {feedArticles.slice(0, page * PAGE_SIZE).map(({ article, companyName, companyId }) => (
                <NewsItem key={article.id} article={article} companyName={companyName} companyId={companyId} variant="feed" />
              ))}
              {page * PAGE_SIZE < feedArticles.length ? (
                <div className="flex flex-col items-center gap-2 py-8">
                  <p className="text-[9px] text-muted-foreground/40 mono uppercase tracking-[0.1em]">
                    Showing {Math.min(page * PAGE_SIZE, feedArticles.length)} of {feedArticles.length}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-bold uppercase tracking-[0.1em] px-6 rounded-none"
                    onClick={() => setPage(p => p + 1)}
                  >
                    Load More
                  </Button>
                </div>
              ) : feedArticles.length > PAGE_SIZE && (
                <p className="text-center text-[9px] text-muted-foreground/40 mono uppercase tracking-[0.1em] py-6">
                  All {feedArticles.length} articles loaded
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      <ChatWidget />
    </PageTransition>
  );
};

export default Index;

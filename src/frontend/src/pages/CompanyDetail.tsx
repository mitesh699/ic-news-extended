import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Clock, TrendingUp, TrendingDown, Minus, Zap, ArrowUpRight, AlertCircle } from "lucide-react";
import { formatDistanceToNow, format, differenceInDays } from "date-fns";
import { motion } from "framer-motion";
import { useCompanies } from "@/hooks/useCompanies";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ChatWidget } from "@/components/ChatWidget";
import { Sparkline } from "@/components/Sparkline";
import { PageTransition } from "@/components/PageTransition";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: companies, isLoading, error, refetch } = useCompanies();
  const company = companies?.find(c => c.id === id);

  const positive = useMemo(() => company?.newsArticles.filter(a => a.signal === "positive") || [], [company]);
  const negative = useMemo(() => company?.newsArticles.filter(a => a.signal === "negative") || [], [company]);
  const neutral = useMemo(() => company?.newsArticles.filter(a => a.signal === "neutral" || !a.signal) || [], [company]);

  // Sparkline data
  const sparklineData = useMemo(() => {
    if (!company) return [];
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
  }, [company]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="section-label">Loading…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-6 w-6 text-destructive/60" />
        <p className="text-[13px] text-muted-foreground">Failed to load company data</p>
        <Button size="sm" variant="outline" className="h-8 text-[10px] rounded-none" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-[15px] text-muted-foreground">Company not found</p>
        <Link to="/companies" className="text-[11px] text-accent hover:underline">← Back to companies</Link>
      </div>
    );
  }

  const sentiment = positive.length > negative.length ? "positive" : negative.length > positive.length ? "negative" : "neutral";
  const sparkColor =
    sentiment === "positive" ? "hsl(152, 55%, 36%)" :
    sentiment === "negative" ? "hsl(0, 65%, 48%)" :
    "hsl(38, 70%, 48%)";

  return (
    <PageTransition className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-header border-b border-border/60">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-6 h-[56px]">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-8 w-8" />
            <div className="h-5 w-px bg-border/40" />
            <nav className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]">
              <Link to="/companies" className="text-muted-foreground/60 hover:text-foreground transition-colors">
                Companies
              </Link>
              <span className="text-muted-foreground/30">/</span>
              <span className="text-foreground/80 truncate max-w-[200px]">{company?.name ?? "..."}</span>
            </nav>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <div className="border-b border-border/40">
        <div className="max-w-[1200px] mx-auto px-6 py-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">Company Profile</p>
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-[42px] font-bold tracking-[-0.04em] headline-font text-foreground leading-[1.1]">
                  {company.name}
                </h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50 mt-2">
                  {company.sector} — {company.description}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className={cn(
                  "px-4 py-2 border glass-card",
                  sentiment === "positive" && "border-signal-positive/30 bg-signal-positive/5",
                  sentiment === "negative" && "border-signal-negative/30 bg-signal-negative/5",
                  sentiment === "neutral" && "border-border bg-muted/30",
                )}>
                  <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">Sentiment</p>
                  <p className={cn(
                    "text-[14px] font-bold uppercase tracking-[0.08em]",
                    sentiment === "positive" && "text-signal-positive",
                    sentiment === "negative" && "text-signal-negative",
                    sentiment === "neutral" && "text-signal-neutral",
                  )}>
                    {sentiment === "positive" ? "Positive" : sentiment === "negative" ? "Negative" : "Neutral"}
                  </p>
                </div>
                <Sparkline data={sparklineData} width={120} height={32} color={sparkColor} />
              </div>
            </div>

            {/* Metrics row */}
            <div className="flex items-center gap-8 mt-8 pt-6 border-t border-border/40">
              {[
                { count: company.newsArticles.length, label: "Articles", color: "text-foreground" },
                { count: positive.length, label: "Positive", color: "text-signal-positive" },
                { count: negative.length, label: "Negative", color: "text-signal-negative" },
                { count: neutral.length, label: "Neutral", color: "text-signal-neutral" },
                { count: company.newsArticles.filter(a => a.isBreaking).length, label: "Breaking", color: "text-signal-breaking" },
              ].map((m, i) => (
                <motion.div
                  key={m.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
                  className="flex flex-col items-center gap-1"
                >
                  <span className={cn("text-[24px] font-bold mono", m.color)}>{m.count}</span>
                  <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50">{m.label}</span>
                </motion.div>
              ))}
              <div className="ml-auto text-right">
                <span className="text-[10px] text-muted-foreground/40 mono flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Updated {formatDistanceToNow(new Date(company.lastUpdated), { addSuffix: true })}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-[1fr_340px] gap-10">
          {/* Main content */}
          <div>
            {/* AI Brief */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="p-6 border-l-2 border-accent glass-card mb-8 glow-accent"
            >
              <p className="section-label mb-3">AI Portfolio Brief</p>
              <p className="text-[16px] text-foreground/85 leading-[1.8] headline-font-italic">{company.summary}</p>
            </motion.div>

            {/* Signal sections */}
            <ArticleSection articles={positive} label="Positive Coverage" icon={TrendingUp} color="text-signal-positive" borderColor="border-l-signal-positive" delay={0.15} />
            <ArticleSection articles={negative} label="Negative Coverage" icon={TrendingDown} color="text-signal-negative" borderColor="border-l-signal-negative" delay={0.2} />
            <ArticleSection articles={neutral} label="Neutral Coverage" icon={Minus} color="text-signal-neutral" borderColor="border-l-border" delay={0.25} />
          </div>

          {/* Timeline sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-[80px]">
              <p className="section-label mb-4 flex items-center gap-2">
                <Clock className="h-3 w-3" /> Timeline
              </p>
              <div className="glass-card">
                <div className="max-h-[calc(100vh-10rem)] overflow-y-auto custom-scrollbar p-4">
                  {[...company.newsArticles]
                    .sort((a, b) => new Date(b.publishedAt ?? b.fetchedAt).getTime() - new Date(a.publishedAt ?? a.fetchedAt).getTime())
                    .map((article, i) => (
                      <motion.div
                        key={article.id}
                        initial={{ opacity: 0, x: 4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.3 }}
                        className="flex gap-3 pb-4 last:pb-0"
                      >
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "h-2 w-2 rounded-full shrink-0 mt-1.5",
                            article.signal === "positive" && "bg-signal-positive",
                            article.signal === "negative" && "bg-signal-negative",
                            article.signal === "neutral" && "bg-signal-neutral",
                            !article.signal && "bg-muted-foreground/20",
                          )} />
                          {i < company.newsArticles.length - 1 && (
                            <div className="w-px flex-1 bg-border/40 mt-1" />
                          )}
                        </div>
                        <div className="pb-3">
                          <p className="text-[8px] text-muted-foreground/40 mono uppercase tracking-[0.1em] mb-1">
                            {format(new Date(article.publishedAt ?? article.fetchedAt), "MMM d · HH:mm")}
                          </p>
                          <a href={article.url} target="_blank" rel="noopener noreferrer"
                            className="text-[11px] text-foreground/70 leading-[1.45] hover:text-accent transition-colors block">
                            {article.isBreaking && <Zap className="inline h-2.5 w-2.5 text-accent mr-0.5 -mt-0.5" />}
                            {article.title}
                          </a>
                          <p className="text-[8px] text-muted-foreground/35 mono uppercase tracking-[0.1em] mt-0.5">
                            {article.source}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <ChatWidget />
    </PageTransition>
  );
}

function ArticleSection({
  articles,
  label,
  icon: Icon,
  color,
  borderColor,
  delay = 0,
}: {
  articles: { id: string; title: string; url: string; source: string | null; summary: string | null; publishedAt: string | null; fetchedAt: string; signal?: string | null; isBreaking: boolean; tags?: string[] }[];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  borderColor: string;
  delay?: number;
}) {
  if (articles.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="mb-8"
    >
      <p className={cn("section-label mb-4 flex items-center gap-2", color)}>
        <Icon className="h-3 w-3" />
        {label} — {articles.length}
      </p>
      <div className="space-y-0">
        {articles.map((article) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "group flex gap-4 py-4 border-b border-border/30 last:border-0 hover:bg-foreground/[0.02] transition-colors",
              "border-l-2 pl-4",
              borderColor,
            )}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14px] font-medium text-foreground/85 leading-[1.5] group-hover:text-accent transition-colors">
                  {article.isBreaking && <Zap className="inline h-3.5 w-3.5 text-accent mr-1 -mt-0.5 breaking-pulse" />}
                  {article.title}
                </p>
                <ArrowUpRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground/0 group-hover:text-accent/60 transition-all" />
              </div>
              {article.summary && (
                <p className="text-[13px] text-muted-foreground/55 leading-[1.65] mt-1.5 headline-font-italic">
                  {article.summary}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">{article.source}</span>
                <span className="text-muted-foreground/20 text-[8px]">—</span>
                <span className="text-[9px] text-muted-foreground/40 mono tracking-[0.08em]">
                  {format(new Date(article.publishedAt ?? article.fetchedAt), differenceInDays(new Date(), new Date(article.publishedAt ?? article.fetchedAt)) > 6 ? "MMM d, yyyy" : "MMM d, HH:mm")}
                </span>
                <span className="text-muted-foreground/20 text-[8px]">—</span>
                <span className="text-[9px] text-muted-foreground/40 mono uppercase tracking-[0.08em]">
                  {formatDistanceToNow(new Date(article.publishedAt ?? article.fetchedAt), { addSuffix: true })}
                </span>
                {article.tags && article.tags.length > 0 && (
                  <>
                    <span className="text-muted-foreground/20 text-[8px]">—</span>
                    {article.tags.slice(0, 3).map((tag: string) => (
                      <span key={tag} className="text-[8px] px-1.5 py-0.5 bg-foreground/[0.04] text-muted-foreground/50 mono uppercase tracking-[0.1em]">
                        {tag}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>
    </motion.div>
  );
}

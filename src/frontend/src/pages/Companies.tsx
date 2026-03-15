import { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, RefreshCw, ChevronDown, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CompanyCard } from "@/components/CompanyCard";
import { CompanyCardSkeleton } from "@/components/CompanyCardSkeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageTransition } from "@/components/PageTransition";
import { ChatWidget } from "@/components/ChatWidget";
import { useCompanies, useRefreshNews } from "@/hooks/useCompanies";
import type { TopicFilter } from "@/types/company";
import { cn } from "@/lib/utils";

const TOPICS: { value: TopicFilter; label: string }[] = [
  { value: "all", label: "All Sectors" },
  { value: "climate", label: "Climate" },
  { value: "consumer", label: "Consumer" },
  { value: "crypto", label: "Crypto" },
  { value: "enterprise", label: "Enterprise" },
  { value: "fintech", label: "Fintech" },
  { value: "frontier tech", label: "Frontier Tech" },
  { value: "healthcare", label: "Healthcare" },
  { value: "real estate", label: "Real Estate" },
];

function SectorDropdown({ value, onChange }: { value: TopicFilter; onChange: (v: TopicFilter) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = TOPICS.find(t => t.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 h-7 px-2.5 text-[10px] font-bold uppercase tracking-[0.1em] border border-border/40 transition-colors",
          value !== "all" ? "bg-foreground text-background border-foreground" : "text-muted-foreground hover:text-foreground hover:border-border"
        )}
      >
        {current?.label}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border shadow-lg min-w-[140px] py-1">
          {TOPICS.map(t => (
            <button
              key={t.value}
              onClick={() => { onChange(t.value); setOpen(false); }}
              className={cn(
                "block w-full text-left px-3 py-1.5 text-[10px] font-medium transition-colors",
                value === t.value ? "bg-foreground/5 text-foreground font-bold" : "text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const Companies = () => {
  const navigate = useNavigate();
  const { data: companies, isLoading, error, refetch } = useCompanies();
  const refreshMutation = useRefreshNews();

  const [search, setSearch] = useState("");
  const [sector, setSector] = useState<TopicFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "exit">("all");
  const [sortBy, setSortBy] = useState<"name" | "recent">("name");

  const lastRefreshed = useMemo(() => {
    if (!companies?.length) return null;
    const dates = companies.map(c => new Date(c.lastUpdated).getTime()).filter(Boolean);
    return dates.length ? new Date(Math.max(...dates)) : null;
  }, [companies]);

  const filtered = useMemo(() => {
    if (!companies) return [];
    return companies
      .filter(c => {
        const q = search.toLowerCase();
        const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.sector.toLowerCase().includes(q);
        const matchesSector = sector === "all" || c.sector.toLowerCase().includes(sector);
        const matchesStatus = statusFilter === "all" || (c.status ?? "active") === statusFilter;
        return matchesSearch && matchesSector && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "recent") return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
        return a.name.localeCompare(b.name);
      });
  }, [companies, search, sector, statusFilter, sortBy]);

  // Virtual grid setup
  const gridRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(3);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setCols(w >= 1024 ? 3 : w >= 640 ? 2 : 1);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows = useMemo(() => {
    const result: (typeof filtered)[] = [];
    for (let i = 0; i < filtered.length; i += cols) {
      result.push(filtered.slice(i, i + cols));
    }
    return result;
  }, [filtered, cols]);

  const parentOffsetRef = useRef(0);
  useLayoutEffect(() => {
    parentOffsetRef.current = gridRef.current?.offsetTop ?? 0;
  });

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 452,
    overscan: 3,
    scrollMargin: parentOffsetRef.current,
  });

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
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Portfolio Companies</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/30" />
              <Input
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 w-56 text-[11px] bg-foreground/[0.03] border-border/40 rounded-none focus:bg-card"
              />
            </div>

            {lastRefreshed && (
              <span className="hidden xl:block text-[9px] text-muted-foreground/60 mono uppercase tracking-[0.08em]">
                Updated {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
              </span>
            )}
            <ThemeToggle />
            <Button
              size="sm"
              className="h-8 text-[9px] font-bold uppercase tracking-[0.12em] px-4 rounded-none gap-2"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={cn("h-3 w-3", refreshMutation.isPending && "animate-spin")} />
              {refreshMutation.isPending ? "Updating" : "Update"}
            </Button>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-destructive/10 border-b border-destructive/30 px-4 py-3">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12px] text-destructive font-medium">
              <AlertCircle className="h-4 w-4" />
              Failed to load companies. Check your connection.
            </span>
            <Button size="sm" variant="outline" className="h-7 text-[10px] rounded-none" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="max-w-[1440px] mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <p className="section-label">
            Portfolio Companies{!isLoading && ` — ${filtered.length}`}
          </p>
          <div className="flex items-center gap-4">
            <SectorDropdown value={sector} onChange={setSector} />
            <div className="h-4 w-px bg-border/30" />
            <div className="flex gap-0.5">
              {(["all", "active", "exit"] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn("filter-pill text-[9px]", statusFilter === s && "filter-pill-active")}>
                  {s === "all" ? "All" : s === "active" ? "Active" : "Exited"}
                </button>
              ))}
            </div>
            <div className="h-4 w-px bg-border/30" />
            <div className="flex gap-0.5">
              {([
                { value: "name" as const, label: "A-Z" },
                { value: "recent" as const, label: "Recent" },
              ]).map(s => (
                <button key={s.value} onClick={() => setSortBy(s.value)}
                  className={cn("filter-pill text-[9px]", sortBy === s.value && "filter-pill-active")}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => <CompanyCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-28 text-center">
            <div className="h-14 w-14 border border-border/60 flex items-center justify-center mb-5">
              <Building2 className="h-5 w-5 text-muted-foreground/40" />
            </div>
            {companies && companies.length === 0 ? (
              <>
                <p className="text-[13px] font-medium text-muted-foreground">No companies tracked yet</p>
                <p className="text-[11px] text-muted-foreground/40 mt-1">Hit Update to fetch your portfolio companies</p>
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
              </>
            ) : (
              <>
                <p className="text-[13px] font-medium text-muted-foreground">No companies match</p>
                <p className="text-[11px] text-muted-foreground/40 mt-1">Adjust your search or sector filter</p>
              </>
            )}
          </motion.div>
        ) : (
          <div
            ref={gridRef}
            style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}
          >
            {virtualizer.getVirtualItems().map((vRow) => (
              <div
                key={vRow.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${vRow.start - virtualizer.options.scrollMargin}px)`,
                  paddingBottom: "32px",
                }}
              >
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rows[vRow.index].map((company) => (
                    <CompanyCard
                      key={company.id}
                      company={company}
                      onClick={() => navigate(`/company/${company.id}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      <ChatWidget />
    </PageTransition>
  );
};

export default Companies;

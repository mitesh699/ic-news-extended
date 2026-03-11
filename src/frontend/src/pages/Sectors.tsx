import { AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useSectors } from "@/hooks/useSectors";
import { SectorCard } from "@/components/SectorCard";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { PageTransition } from "@/components/PageTransition";
import { ChatWidget } from "@/components/ChatWidget";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";

export default function Sectors() {
  const { data: sectors, isLoading, error, refetch } = useSectors();

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
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50 mb-2">Intelligence</p>
          <h2 className="text-[32px] font-bold tracking-[-0.03em] headline-font text-foreground leading-[1.1] mb-1">
            Sector Briefs
          </h2>
          <p className="text-[12px] text-muted-foreground/50 mb-8">
            AI-generated sector analysis from portfolio and competitor signals.
          </p>
        </motion.div>

        {isLoading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-muted/30 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center gap-4 py-16">
            <AlertCircle className="h-6 w-6 text-destructive/60" />
            <p className="text-[13px] text-muted-foreground">Failed to load sector data</p>
            <Button size="sm" variant="outline" className="h-8 text-[10px] rounded-none" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {sectors && sectors.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[13px] text-muted-foreground/50">No sectors with data yet. Add companies with sectors to get started.</p>
          </div>
        )}

        {sectors && sectors.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectors.map((sector, i) => (
              <motion.div
                key={sector.sector}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <SectorCard sector={sector} />
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <ChatWidget />
    </PageTransition>
  );
}

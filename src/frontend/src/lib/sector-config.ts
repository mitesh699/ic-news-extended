import { TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

export const TREND_CONFIG = {
  growing: {
    icon: TrendingUp,
    color: "text-signal-positive",
    border: "border-signal-positive/30",
    bg: "bg-signal-positive/5",
    label: "Growing",
  },
  stable: {
    icon: Minus,
    color: "text-signal-neutral",
    border: "border-border/40",
    bg: "bg-muted/10",
    label: "Stable",
  },
  declining: {
    icon: TrendingDown,
    color: "text-signal-negative",
    border: "border-signal-negative/30",
    bg: "bg-signal-negative/5",
    label: "Declining",
  },
  volatile: {
    icon: Activity,
    color: "text-accent",
    border: "border-accent/30",
    bg: "bg-accent/5",
    label: "Volatile",
  },
} as const;

export type TrendDirection = keyof typeof TREND_CONFIG;

export function getTrendConfig(trend: string | undefined | null) {
  return (trend && TREND_CONFIG[trend as TrendDirection]) ?? TREND_CONFIG.stable;
}

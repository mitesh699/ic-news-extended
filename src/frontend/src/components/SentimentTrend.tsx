import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { format, parseISO } from "date-fns";

interface SentimentTrendProps {
  data: { date: string; positive: number; negative: number; neutral: number }[];
}

function formatTick(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d");
  } catch {
    return dateStr;
  }
}

interface TooltipEntry {
  color: string;
  name: string;
  value: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/60 px-3 py-2 text-[10px] shadow-lg">
      <p className="font-bold text-foreground/70 mb-1">{label ? formatTick(label) : ""}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground/60 uppercase tracking-[0.08em]">{entry.name}</span>
          <span className="font-bold mono ml-auto">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export function SentimentTrend({ data }: SentimentTrendProps) {
  if (data.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground/50 text-center py-6">
        No sentiment data available
      </div>
    );
  }

  const last7 = data.slice(-7);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={last7} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="gradPositive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(152, 55%, 36%)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(152, 55%, 36%)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gradNegative" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(0, 65%, 48%)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="hsl(0, 65%, 48%)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="gradNeutral" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(220, 10%, 50%)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(220, 10%, 50%)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis
          dataKey="date"
          tickFormatter={formatTick}
          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", opacity: 0.5 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", opacity: 0.4 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="positive"
          stroke="hsl(152, 55%, 36%)"
          strokeWidth={2}
          fill="url(#gradPositive)"
          name="Positive"
        />
        <Area
          type="monotone"
          dataKey="negative"
          stroke="hsl(0, 65%, 48%)"
          strokeWidth={2}
          fill="url(#gradNegative)"
          name="Negative"
        />
        <Area
          type="monotone"
          dataKey="neutral"
          stroke="hsl(220, 10%, 50%)"
          strokeWidth={1.5}
          fill="url(#gradNeutral)"
          name="Neutral"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

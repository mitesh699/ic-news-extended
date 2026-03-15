import { useMemo } from "react";

interface SignalHeatmapProps {
  data: { sector: string; signals: Record<string, number> }[];
}

const SIGNAL_COLS = ["funding", "hiring", "product", "regulatory", "M&A", "risk", "partnership"] as const;

function cellColor(value: number, max: number, isRisk: boolean): string {
  if (value === 0) return "bg-foreground/[0.03]";
  const ratio = max > 0 ? value / max : 0;
  if (isRisk) {
    if (ratio > 0.66) return "bg-red-500/70 text-white";
    if (ratio > 0.33) return "bg-red-400/50 text-white";
    return "bg-red-300/30 text-foreground";
  }
  if (ratio > 0.66) return "bg-blue-600/70 text-white";
  if (ratio > 0.33) return "bg-blue-400/50 text-white";
  return "bg-blue-300/30 text-foreground";
}

export function SignalHeatmap({ data }: SignalHeatmapProps) {
  const maxValue = useMemo(() => {
    let m = 0;
    for (const row of data) {
      for (const col of SIGNAL_COLS) {
        if ((row.signals[col] ?? 0) > m) m = row.signals[col] ?? 0;
      }
    }
    return m;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground/50 text-center py-6">
        No signal data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="text-left font-bold uppercase tracking-[0.12em] text-muted-foreground/50 pb-2 pr-3 min-w-[100px]">
              Sector
            </th>
            {SIGNAL_COLS.map((col) => (
              <th
                key={col}
                className="font-bold uppercase tracking-[0.08em] text-muted-foreground/50 pb-2 px-1 text-center min-w-[52px]"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.sector}>
              <td className="font-medium text-foreground/70 py-1 pr-3 truncate max-w-[140px]">
                {row.sector}
              </td>
              {SIGNAL_COLS.map((col) => {
                const val = row.signals[col] ?? 0;
                return (
                  <td key={col} className="px-0.5 py-0.5 text-center">
                    <div
                      className={`rounded-sm px-1.5 py-1 mono text-[9px] font-bold transition-colors ${cellColor(val, maxValue, col === "risk")}`}
                    >
                      {val}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

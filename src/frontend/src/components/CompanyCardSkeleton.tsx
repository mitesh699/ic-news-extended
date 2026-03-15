export function CompanyCardSkeleton() {
  return (
    <div className="glass-card overflow-hidden">
      <div className="h-[2px] shimmer" />
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <div className="h-5 w-28 shimmer rounded-sm" />
            <div className="h-2.5 w-20 shimmer rounded-sm" />
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-5 w-16 shimmer rounded-sm" />
            <div className="flex gap-2">
              <div className="h-4 w-8 shimmer rounded-sm" />
              <div className="h-4 w-8 shimmer rounded-sm" />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <div className="h-2.5 w-full shimmer rounded-sm" />
          <div className="h-2.5 w-4/5 shimmer rounded-sm" />
        </div>
        <div className="h-px bg-border/40" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="border-l-2 border-muted pl-2.5">
              <div className="h-3 w-full shimmer rounded-sm" />
              <div className="h-2.5 w-3/4 mt-1 shimmer rounded-sm" />
              <div className="h-2 w-24 mt-1 shimmer rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

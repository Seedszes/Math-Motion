import { AnimationStats } from "@workspace/api-client-react";

export default function StatsBar({ stats }: { stats: AnimationStats }) {
  return (
    <div className="flex items-center gap-6 text-sm font-mono bg-card px-4 py-2 rounded-md border border-border/50 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Total:</span>
        <span className="text-foreground font-medium">{stats.total}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
        <span className="text-muted-foreground">Active:</span>
        <span className="text-foreground font-medium">{stats.pending + stats.generating}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Done:</span>
        <span className="text-foreground font-medium">{stats.completed}</span>
      </div>
      {stats.failed > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Failed:</span>
          <span className="text-destructive font-medium">{stats.failed}</span>
        </div>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";

interface ConfidenceBarProps {
  confidence: number; // 0.0–1.0 or 0–100
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBar({ confidence, showLabel = true, className }: ConfidenceBarProps) {
  const percentage = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);

  // Color config based on score
  const config =
    percentage >= 90
      ? {
          bar: "from-accent-green to-emerald-400",
          glow: "rgba(16,185,129,0.5)",
          text: "text-accent-green",
          track: "bg-accent-green/10",
        }
      : percentage >= 75
      ? {
          bar: "from-accent-amber to-yellow-400",
          glow: "rgba(245,158,11,0.5)",
          text: "text-accent-amber",
          track: "bg-accent-amber/10",
        }
      : {
          bar: "from-accent-red to-red-400",
          glow: "rgba(239,68,68,0.5)",
          text: "text-accent-red",
          track: "bg-accent-red/10",
        };

  return (
    <div className={cn("flex flex-col gap-1.5 w-full min-w-[100px]", className)}>
      {showLabel && (
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
            AI Conf.
          </span>
          <span className={cn("text-xs font-bold font-mono tabular-nums", config.text)}>
            {percentage}%
          </span>
        </div>
      )}

      {/* Track */}
      <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full border border-border", config.track)}>
        {/* Animated fill */}
        <div
          className={cn(
            "h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out",
            config.bar
          )}
          style={{
            width: `${percentage}%`,
            boxShadow: `0 0 8px ${config.glow}`,
          }}
        />
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface ConfidenceBarProps {
  confidence: number; // 0.0 to 1.0 (or 0 to 100 if passed incorrectly, we'll handle both)
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBar({ confidence, showLabel = true, className }: ConfidenceBarProps) {
  // Normalize confidence to 0-100 percentage
  const percentage = confidence <= 1 ? useMemo(() => Math.round(confidence * 100), [confidence]) : confidence;

  let colorClass = "bg-accent-red";
  if (percentage >= 90) colorClass = "bg-accent-green";
  else if (percentage >= 75) colorClass = "bg-accent-amber";

  return (
    <div className={cn("flex flex-col gap-1 w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-xs">
          <span className="text-text-muted">AI Confidence</span>
          <span className="font-mono font-medium text-white">{percentage}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-tertiary border border-border">
        <div
          className={cn("h-full transition-all duration-1000 ease-out", colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

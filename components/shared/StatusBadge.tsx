import { cn } from "@/lib/utils";
import { ViolationType, ViolationStatus, CameraStatus } from "@prisma/client";

interface StatusBadgeProps {
  type: "violationType" | "violationStatus" | "cameraStatus";
  value: string;
  className?: string;
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  let content = value;
  let bgClass = "bg-bg-tertiary";
  let textClass = "text-text-muted";
  let borderClass = "border-border";

  if (type === "violationType") {
    const vType = value as ViolationType;
    switch (vType) {
      case "ILLEGAL_PARKING":
        content = "Parkir Liar";
        bgClass = "bg-accent-red/10";
        textClass = "text-accent-red";
        borderClass = "border-accent-red/20";
        break;
      case "BUSWAY_VIOLATION":
        content = "Jalur Busway";
        bgClass = "bg-accent-amber/10";
        textClass = "text-accent-amber";
        borderClass = "border-accent-amber/20";
        break;
      case "BICYCLE_LANE_VIOLATION":
        content = "Jalur Sepeda";
        bgClass = "bg-accent-green/10";
        textClass = "text-accent-green";
        borderClass = "border-accent-green/20";
        break;
      case "BUS_STOP_VIOLATION":
        content = "Halte Bus";
        bgClass = "bg-accent-blue/10";
        textClass = "text-accent-blue";
        borderClass = "border-accent-blue/20";
        break;
      case "WRONG_LANE":
        content = "Salah Lajur";
        bgClass = "bg-accent-cyan/10";
        textClass = "text-accent-cyan";
        borderClass = "border-accent-cyan/20";
        break;
    }
  } else if (type === "violationStatus") {
    const vStatus = value as ViolationStatus;
    switch (vStatus) {
      case "PENDING":
        content = "Menunggu";
        bgClass = "bg-bg-tertiary";
        textClass = "text-text-secondary";
        break;
      case "VERIFIED":
        content = "Terverifikasi";
        bgClass = "bg-accent-green/10";
        textClass = "text-accent-green";
        borderClass = "border-accent-green/20";
        break;
      case "EXPORTED":
        content = "Terkirim E-TLE";
        bgClass = "bg-accent-blue/10";
        textClass = "text-accent-blue";
        borderClass = "border-accent-blue/20";
        break;
      case "DISMISSED":
        content = "Ditolak";
        bgClass = "bg-bg-tertiary";
        textClass = "text-text-muted";
        break;
    }
  } else if (type === "cameraStatus") {
    const cStatus = value as CameraStatus;
    switch (cStatus) {
      case "ACTIVE":
        content = "AKTIF";
        bgClass = "bg-accent-green/10";
        textClass = "text-accent-green";
        borderClass = "border-accent-green/20";
        break;
      case "INACTIVE":
        content = "TIDAK AKTIF";
        bgClass = "bg-accent-red/10";
        textClass = "text-accent-red";
        borderClass = "border-accent-red/20";
        break;
      case "MAINTENANCE":
        content = "MAINTENANCE";
        bgClass = "bg-accent-amber/10";
        textClass = "text-accent-amber";
        borderClass = "border-accent-amber/20";
        break;
    }
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        bgClass,
        textClass,
        borderClass,
        className
      )}
    >
      {content}
    </span>
  );
}

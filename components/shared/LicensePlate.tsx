import { cn } from "@/lib/utils";

interface LicensePlateProps {
  plate: string;
  type?: "car" | "motorcycle";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LicensePlate({ plate, type = "car", size = "md", className }: LicensePlateProps) {
  // Indonesian format: B 1234 CD
  const parts = plate.split(" ");
  const prefix = parts[0] || "";
  const number = parts[1] || "";
  const suffix = parts.slice(2).join(" ") || "";

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs border-[1px]",
    md: "px-3 py-1 text-sm border-2",
    lg: "px-4 py-2 text-xl border-2",
  };

  const codeSizeStyles = {
    sm: "text-[8px]",
    md: "text-[10px]",
    lg: "text-xs",
  };

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center overflow-hidden rounded-md font-mono font-bold tracking-widest bg-white text-black border-black/80 shadow-sm",
        sizeStyles[size],
        className
      )}
    >
      <div className={cn("flex flex-col items-center justify-center border-r-2 border-black/20 pr-1.5 mr-1.5", codeSizeStyles[size])}>
        <span className="leading-none text-blue-800">12</span>
        <span className="leading-none text-blue-800">27</span>
      </div>
      <div>
        <span>{prefix}</span>
        <span className="mx-1">{number}</span>
        <span>{suffix}</span>
      </div>
    </div>
  );
}

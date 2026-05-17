import { useState, useEffect, useRef } from "react";
import { Camera, Maximize2, Minimize2, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function LiveFeed() {
  const [time, setTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update clock and set mounted state
  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "flex flex-col bg-bg-secondary overflow-hidden transition-all duration-300",
        isFullscreen 
          ? "fixed inset-0 z-[9999] h-screen w-screen rounded-none" 
          : "h-full min-h-[400px] rounded-xl border border-border"
      )}
    >
      <div className="flex items-center justify-between border-b border-border bg-bg-secondary/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-2 w-2 items-center justify-center rounded-full bg-accent-red animate-pulse"></div>
          <h3 className="font-heading font-semibold text-white">Live AI Feed</h3>
        </div>
        <button 
          onClick={toggleFullscreen}
          className="text-text-muted hover:text-white transition-colors"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        {/* Live Camera View (Real Video) */}
        <div className="absolute inset-0 bg-bg-tertiary">
          <video 
            className="absolute inset-0 h-full w-full object-cover opacity-80"
            autoPlay 
            loop 
            muted 
            playsInline 
            src="/traffic-hd.mp4" 
            style={{ objectPosition: 'center bottom' }}
          />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        {/* OSD (On-Screen Display) */}
        <div className="absolute top-4 left-4 right-4 flex justify-between text-xs font-mono text-white/80 drop-shadow-md">
          <div className="flex flex-col gap-1">
            <span className="bg-black/50 px-2 py-1 rounded">CAM-SUD-01</span>
            <span className="bg-black/50 px-2 py-1 rounded">Jl. Jend. Sudirman</span>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="bg-black/50 px-2 py-1 rounded">
              {mounted ? time.toLocaleDateString('id-ID') : "--/--/----"}
            </span>
            <span className="bg-black/50 px-2 py-1 rounded text-accent-red">
              {mounted ? time.toLocaleTimeString('id-ID') : "--:--:--"}
            </span>
          </div>
        </div>

        {/* Status Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="pt-8">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-text-muted">ANPR Confidence Level</span>
              <span className="text-xs font-mono text-accent-green">Operational</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <motion.div
                className="h-full bg-accent-cyan shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                animate={{ width: ["85%", "95%", "90%", "98%", "88%"] }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

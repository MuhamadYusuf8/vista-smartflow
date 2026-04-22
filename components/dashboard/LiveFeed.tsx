"use client";

import { useState, useEffect } from "react";
import { Camera, Maximize2, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function LiveFeed() {
  const [time, setTime] = useState(new Date());
  const [detectionVisible, setDetectionVisible] = useState(false);
  const [detectionKey, setDetectionKey] = useState(0);

  // Update clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate periodic AI detections
  useEffect(() => {
    const simulateDetection = () => {
      setDetectionVisible(true);
      setDetectionKey(prev => prev + 1);
      setTimeout(() => setDetectionVisible(false), 3000); // Hide after 3s
      
      // Schedule next detection between 5s and 10s
      const nextTime = Math.random() * 5000 + 5000;
      setTimeout(simulateDetection, nextTime);
    };
    
    const initialTimer = setTimeout(simulateDetection, 2000);
    return () => clearTimeout(initialTimer);
  }, []);

  return (
    <div className="flex h-full min-h-[400px] flex-col rounded-xl border border-border bg-bg-secondary overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-bg-secondary/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-2 w-2 items-center justify-center rounded-full bg-accent-red animate-pulse"></div>
          <h3 className="font-heading font-semibold text-white">Live AI Feed</h3>
        </div>
        <button className="text-text-muted hover:text-white transition-colors">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        {/* Placeholder camera view */}
        <div className="absolute inset-0 bg-bg-tertiary">
          <div className="absolute inset-0 bg-[url('https://picsum.photos/seed/jakarta-traffic/800/600')] bg-cover bg-center opacity-40"></div>
          <div className="absolute inset-0 bg-black/60"></div>
        </div>

        {/* OSD (On-Screen Display) */}
        <div className="absolute top-4 left-4 right-4 flex justify-between text-xs font-mono text-white/80 drop-shadow-md">
          <div className="flex flex-col gap-1">
            <span className="bg-black/50 px-2 py-1 rounded">CAM-SUD-01</span>
            <span className="bg-black/50 px-2 py-1 rounded">Jl. Jend. Sudirman</span>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="bg-black/50 px-2 py-1 rounded">
              {time.toLocaleDateString('id-ID')}
            </span>
            <span className="bg-black/50 px-2 py-1 rounded text-accent-red">
              {time.toLocaleTimeString('id-ID')}
            </span>
          </div>
        </div>

        {/* Center Camera Icon (background hint) */}
        <Camera className="absolute h-16 w-16 text-white/10" />

        {/* AI Detection Overlay */}
        <AnimatePresence>
          {detectionVisible && (
            <motion.div
              key={detectionKey}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="absolute inset-x-8 bottom-12 top-24 pointer-events-none"
            >
              <div className="absolute top-1/2 left-1/3 h-32 w-48 -translate-y-1/2 border-2 border-accent-red bg-accent-red/10 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                {/* Corner markers */}
                <div className="absolute -left-[2px] -top-[2px] h-3 w-3 border-l-2 border-t-2 border-accent-red"></div>
                <div className="absolute -right-[2px] -top-[2px] h-3 w-3 border-r-2 border-t-2 border-accent-red"></div>
                <div className="absolute -bottom-[2px] -left-[2px] h-3 w-3 border-b-2 border-l-2 border-accent-red"></div>
                <div className="absolute -bottom-[2px] -right-[2px] h-3 w-3 border-b-2 border-r-2 border-accent-red"></div>
                
                {/* Detection Label */}
                <div className="absolute -top-7 left-0 whitespace-nowrap bg-accent-red px-2 py-1 text-xs font-bold text-white shadow-lg flex items-center gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  B 1234 CD - 98.5%
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

"use client";

import { AlertCircle, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AlertBannerProps {
  message: string;
  type?: "critical" | "warning" | "info";
}

export function AlertBanner({ message, type = "critical" }: AlertBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="mb-6 rounded-lg bg-accent-red/10 border border-accent-red/20 shadow-[0_0_15px_rgba(239,68,68,0.15)] flex items-center justify-between p-4"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-accent-red/20">
            <AlertCircle className="h-5 w-5 text-accent-red" />
            <div className="absolute inset-0 rounded-full border border-accent-red animate-ping opacity-75"></div>
          </div>
          <p className="text-sm font-medium text-white">{message}</p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="p-1 text-text-muted hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

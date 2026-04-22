"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  colorTheme: "blue" | "red" | "green" | "amber";
  delay?: number;
}

export function StatsCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  colorTheme,
  delay = 0,
}: StatsCardProps) {
  const [count, setCount] = useState(0);
  const numericValue = typeof value === "number" ? value : parseFloat(value as string);
  const isNumber = !isNaN(numericValue);

  // Simple count-up animation
  useEffect(() => {
    if (!isNumber) return;
    
    let startTimestamp: number | null = null;
    const duration = 1500; // 1.5s
    
    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Easing function outQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeProgress * numericValue));
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(numericValue); // ensure it ends perfectly
      }
    };
    
    // Add small delay to start
    const timer = setTimeout(() => {
      window.requestAnimationFrame(step);
    }, delay * 1000);
    
    return () => clearTimeout(timer);
  }, [value, delay, isNumber, numericValue]);

  const displayValue = isNumber && count !== numericValue && count < numericValue
    ? count
    : value;

  const colorConfig = {
    blue: "border-t-accent-blue shadow-[0_-2px_10px_rgba(59,130,246,0.15)]",
    red: "border-t-accent-red shadow-[0_-2px_10px_rgba(239,68,68,0.15)]",
    green: "border-t-accent-green shadow-[0_-2px_10px_rgba(16,185,129,0.15)]",
    amber: "border-t-accent-amber shadow-[0_-2px_10px_rgba(245,158,11,0.15)]",
  };

  const textConfig = {
    blue: "text-accent-blue",
    red: "text-accent-red",
    green: "text-accent-green",
    amber: "text-accent-amber",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={cn(
        "relative overflow-hidden rounded-xl bg-bg-secondary p-6 border border-border border-t-[3px]",
        colorConfig[colorTheme]
      )}
    >
      <dt className="truncate text-sm font-medium text-text-secondary">{title}</dt>
      <dd className="mt-2 flex items-baseline gap-x-2">
        <span className="text-3xl font-heading font-bold tracking-tight text-white">
          {displayValue}
        </span>
        {subtitle && (
          <span className="text-sm text-text-muted">{subtitle}</span>
        )}
      </dd>
      
      {trend !== undefined && (
        <div className="mt-4 flex items-center text-sm">
          {trend > 0 ? (
            <ArrowUpRight className={cn("mr-1 h-4 w-4", textConfig[colorTheme === 'green' || colorTheme === 'blue' ? 'green' : 'red'])} />
          ) : trend < 0 ? (
            <ArrowDownRight className={cn("mr-1 h-4 w-4", textConfig[colorTheme === 'green' ? 'red' : 'green'])} />
          ) : (
            <Minus className="mr-1 h-4 w-4 text-text-muted" />
          )}
          <span
            className={cn(
              "font-medium",
              trend > 0 
                ? (colorTheme === 'green' || colorTheme === 'blue' ? "text-accent-green" : "text-accent-red")
                : trend < 0
                  ? (colorTheme === 'red' ? "text-accent-green" : "text-accent-green") 
                  : "text-text-muted"
            )}
          >
            {Math.abs(trend)}%
          </span>
          <span className="ml-2 text-text-muted">{trendLabel || "dari kemarin"}</span>
        </div>
      )}
    </motion.div>
  );
}

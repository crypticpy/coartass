"use client";

import { ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Lightweight page transition using CSS animations
 * Replaces framer-motion (12MB) with native CSS for better performance
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <div className={`page-transition ${className ?? ''}`}>
      {children}
    </div>
  );
}

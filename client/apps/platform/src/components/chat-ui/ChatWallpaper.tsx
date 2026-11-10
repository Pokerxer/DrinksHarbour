'use client';
import type { ReactNode } from 'react';

/** Subtle wallpaper-like chat backdrop, expressed entirely as static CSS — no
 * motion, no parallax, no animation, so prefers-reduced-motion is respected
 * by construction (per the redesign gate). Burgundy-tinted platform tones,
 * never Meta green. */
export default function ChatWallpaper({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className} style={{
    backgroundColor: '#f8f1ee',
    backgroundImage: 'repeating-linear-gradient(45deg, rgba(124,29,29,0.035) 0px, rgba(124,29,29,0.035) 1px, transparent 1px, transparent 10px)',
  }}>{children}</div>;
}

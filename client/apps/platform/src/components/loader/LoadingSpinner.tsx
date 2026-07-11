'use client';

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type Size = 'sm' | 'md' | 'lg' | 'xl';
type Variant = 'spinner' | 'dots' | 'pulse' | 'bounce' | 'ring' | 'glass';
type Color = 'brand' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple';

interface LoadingSpinnerProps {
  size?: Size;
  variant?: Variant;
  text?: string;
  className?: string;
  fullScreen?: boolean;
  color?: Color;
  /** Milliseconds to wait before showing — prevents a flash on fast loads. */
  delay?: number;
}

// Concrete hex values — the previous template-literal Tailwind classes
// (border-t-${color}-500 etc.) were never compiled, so pulse/ring rendered
// colorless. "rose" maps to the site red: that's what existing callers meant.
const COLORS: Record<Color, string> = {
  brand: '#b20202',
  rose: '#b20202',
  emerald: '#10b981',
  amber: '#f59e0b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
};

const PX: Record<Size, number> = { sm: 20, md: 32, lg: 48, xl: 64 };
const BORDER: Record<Size, number> = { sm: 2, md: 3, lg: 4, xl: 5 };

// ─── Wine glass (signature) ───────────────────────────────────────────────────
// A stemmed glass whose pour rises and settles, with one bubble drifting up.

function GlassLoader({ px, hex, still }: { px: number; hex: string; still: boolean }) {
  const w = px * 1.1;
  const h = px * 1.5;
  const clipId = React.useId();
  return (
    <svg width={w} height={h} viewBox="0 0 32 44" fill="none" aria-hidden="true">
      <defs>
        {/* bowl interior — the liquid is clipped to this */}
        <clipPath id={clipId}>
          <path d="M7 3 H25 C25 12 22 19 16 20 C10 19 7 12 7 3 Z" />
        </clipPath>
      </defs>

      {/* liquid */}
      <g clipPath={`url(#${clipId})`}>
        {still ? (
          <rect x="0" y="9" width="32" height="14" fill={hex} opacity="0.85" />
        ) : (
          <>
            <motion.rect
              x="-8"
              width="48"
              height="26"
              fill={hex}
              opacity="0.85"
              initial={{ y: 22 }}
              animate={{ y: [22, 7, 9, 7.5, 22] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', times: [0, 0.35, 0.55, 0.75, 1] }}
            />
            <motion.circle
              r="1.1"
              cx="14"
              fill="#fff"
              opacity="0.6"
              initial={{ cy: 19 }}
              animate={{ cy: [19, 8], opacity: [0, 0.6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
            />
          </>
        )}
      </g>

      {/* glass outline */}
      <path
        d="M7 3 H25 C25 12 22 19 16 20 C10 19 7 12 7 3 Z M16 20 V38 M9 40 H23"
        stroke={hex}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'spinner',
  text = 'Loading...',
  className = '',
  fullScreen = false,
  color = 'brand',
  delay = 0,
}) => {
  const prefersReduced = useReducedMotion();
  const still = !!prefersReduced;
  const hex = COLORS[color] ?? COLORS.brand;
  const px = PX[size];
  const border = BORDER[size];

  // Anti-flash: stay invisible until `delay` has elapsed.
  const [visible, setVisible] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return;
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!visible) return null;

  const spin = still ? {} : { rotate: 360 };
  const spinTransition = { duration: 1, repeat: Infinity, ease: 'linear' as const };

  const renderSpinner = () => (
    <motion.div
      animate={spin}
      transition={spinTransition}
      style={{
        width: px,
        height: px,
        borderWidth: border,
        borderStyle: 'solid',
        borderColor: `${hex}26`,
        borderTopColor: hex,
      }}
      className="rounded-full"
    />
  );

  const renderDots = () => (
    <div className="flex items-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={still ? {} : { scale: [0.7, 1.15, 0.7], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.14, ease: 'easeInOut' }}
          style={{ width: px / 3.6, height: px / 3.6, backgroundColor: hex }}
          className="rounded-full"
        />
      ))}
    </div>
  );

  const renderPulse = () => (
    <div className="relative" style={{ width: px, height: px }}>
      {/* expanding ripple */}
      {!still && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: `2px solid ${hex}` }}
          animate={{ scale: [1, 1.9], opacity: [0.55, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      {/* core */}
      <motion.div
        className="absolute rounded-full"
        style={{ inset: px / 5, backgroundColor: hex }}
        animate={still ? {} : { scale: [1, 0.82, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );

  const renderBounce = () => (
    <div className="flex items-end gap-1" style={{ height: px }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={still ? {} : { height: ['30%', '100%', '30%'], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
          style={{ width: px / 4, height: '60%', backgroundColor: hex }}
          className="rounded-full"
        />
      ))}
    </div>
  );

  const renderRing = () => (
    <div className="relative" style={{ width: px * 1.25, height: px * 1.25 }}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ border: `${border}px solid ${hex}22`, borderTopColor: hex }}
        animate={spin}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ inset: px / 5, border: `2px solid transparent`, borderBottomColor: `${hex}88` }}
        animate={still ? {} : { rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );

  const renderLoader = () => {
    switch (variant) {
      case 'dots': return renderDots();
      case 'pulse': return renderPulse();
      case 'bounce': return renderBounce();
      case 'ring': return renderRing();
      case 'glass': return <GlassLoader px={px} hex={hex} still={still} />;
      default: return renderSpinner();
    }
  };

  if (fullScreen) {
    return (
      <motion.div
        role="status"
        aria-live="polite"
        aria-label={text || 'Loading'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center ${className}`}
      >
        <motion.div
          initial={still ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {renderLoader()}
        </motion.div>

        {text && (
          <motion.p
            initial={still ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-6 text-gray-600 font-medium"
          >
            {text}
          </motion.p>
        )}

        {!still && (
          <motion.div
            className="mt-4 h-0.5 w-[120px] overflow-hidden rounded-full"
            style={{ backgroundColor: `${hex}1f` }}
          >
            <motion.div
              className="h-full w-1/3 rounded-full"
              style={{ backgroundColor: hex }}
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={text || 'Loading'}
      className={`flex flex-col items-center justify-center ${className}`}
    >
      {renderLoader()}
      {text && (
        <motion.p
          initial={still ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-gray-500 text-sm font-medium"
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

export default LoadingSpinner;

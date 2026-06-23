"use client";

import { useEffect, useRef, useState } from "react";

interface LazySectionProps {
  children: React.ReactNode;
  rootMargin?: string;
  fallback?: React.ReactNode;
  className?: string;
}

/**
 * Defers mounting children until the section is near the viewport.
 * This prevents below-fold components from fetching data and parsing JS on initial load.
 */
export default function LazySection({
  children,
  rootMargin = "200px",
  fallback = null,
  className,
}: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : fallback}
    </div>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';

type Direction = 'up' | 'left' | 'right';

interface RevealProps {
  children: React.ReactNode;
  direction?: Direction;
  delay?: number;
  className?: string;
  as?: React.ElementType;
}

export function RevealOnScroll({
  children,
  direction = 'up',
  delay = 0,
  className = '',
  as = 'div',
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const Tag = as as React.ElementType;

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
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const attr =
    direction === 'left'
      ? 'data-reveal-left'
      : direction === 'right'
        ? 'data-reveal-right'
        : 'data-reveal';

  return (
    <Tag
      ref={ref}
      className={`${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
      {...{ [attr]: true }}
    >
      {children}
    </Tag>
  );
}
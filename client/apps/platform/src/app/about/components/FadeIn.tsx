import React from 'react';

export function FadeIn({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      data-fade-in
      className={className}
      style={{
        animation: `fadeInUp 0.55s ease-out ${delay}s forwards`,
        opacity: 0,
      }}
    >
      {children}
    </div>
  );
}

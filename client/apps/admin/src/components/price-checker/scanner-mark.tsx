import React from 'react';
export function ScannerMark({ loading = false }: { loading?: boolean }) {
  return (
    <div className={`kiosk-scanner ${loading ? 'is-loading' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 160 130" fill="none">
        <path
          d="M30 8H8v24M130 8h22v24M8 98v24h22M152 98v24h-22"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {[28, 36, 46, 57, 65, 77, 84, 96, 108, 115, 128].map((x, i) => (
          <path key={x} d={`M${x} 35v60`} stroke="currentColor" strokeWidth={i % 3 === 0 ? 5 : 2} />
        ))}
      </svg>
      <span className="kiosk-scanline" />
    </div>
  );
}

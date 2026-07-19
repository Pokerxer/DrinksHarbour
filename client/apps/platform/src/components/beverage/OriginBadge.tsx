import React from "react";

export interface OriginBadgeProps {
  origin?: string;
  className?: string;
}

const flagEmoji = (origin: string): string | null => {
  const map: Record<string, string> = {
    nigeria: "🇳🇬",
    france: "🇫🇷",
    italy: "🇮🇹",
    spain: "🇪🇸",
    usa: "🇺🇸",
    "united states": "🇺🇸",
    "u.s.a": "🇺🇸",
    uk: "🇬🇧",
    "united kingdom": "🇬🇧",
    scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    ireland: "🇮🇪",
    germany: "🇩🇪",
    portugal: "🇵🇹",
    "south africa": "🇿🇦",
    argentina: "🇦🇷",
    chile: "🇨🇱",
    australia: "🇦🇺",
    japan: "🇯🇵",
    mexico: "🇲🇽",
    brazil: "🇧🇷",
    russia: "🇷🇺",
    netherlands: "🇳🇱",
    belgium: "🇧🇪",
    china: "🇨🇳",
    india: "🇮🇳",
    ghana: "🇬🇭",
    kenya: "🇰🇪",
  };
  const key = origin.trim().toLowerCase();
  return map[key] ?? null;
};

const OriginBadge: React.FC<OriginBadgeProps> = ({ origin, className = "" }) => {
  if (!origin || !origin.trim()) return null;
  const flag = flagEmoji(origin);

  return (
    <span
      className={`inline-flex max-w-[140px] items-center gap-1 rounded-full bg-gray-900/85 px-2 py-0.5 text-[10px] font-medium text-gray-100 backdrop-blur-sm ${className}`}
    >
      {flag && <span className="leading-none">{flag}</span>}
      <span className="truncate">{origin}</span>
    </span>
  );
};

export default OriginBadge;
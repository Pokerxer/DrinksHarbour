import React from "react";

export interface ABVBadgeProps {
  abv?: number;
  alcoholic?: boolean;
  className?: string;
}

const ABVBadge: React.FC<ABVBadgeProps> = ({ abv, alcoholic, className = "" }) => {
  if (abv === undefined || abv === null || Number.isNaN(abv)) return null;
  if (abv <= 0 && !alcoholic) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gray-900/85 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-300 backdrop-blur-sm ${className}`}
    >
      <span className="h-1 w-1 rounded-full bg-amber-400" />
      {Number(abv).toFixed(1)}% ABV
    </span>
  );
};

export default ABVBadge;
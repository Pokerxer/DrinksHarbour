import React from "react";

export interface AgeGateChipProps {
  alcoholic?: boolean;
  abv?: number;
  className?: string;
}

const AgeGateChip: React.FC<AgeGateChipProps> = ({ alcoholic, abv, className = "" }) => {
  const isAlcoholic = alcoholic === true || (abv !== undefined && abv > 0);
  if (!isAlcoholic) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 backdrop-blur-sm ${className}`}
      title="Alcoholic beverage — age verification required at checkout"
    >
      18+
    </span>
  );
};

export default AgeGateChip;
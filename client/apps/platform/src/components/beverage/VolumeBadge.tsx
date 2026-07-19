import React from "react";

export interface VolumeBadgeProps {
  volumeMl?: number;
  label?: string;
  className?: string;
}

function formatVolume(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000;
    return `${Number.isInteger(liters) ? liters : liters.toFixed(2).replace(/0$/, "")}L`;
  }
  return `${ml}ml`;
}

const VolumeBadge: React.FC<VolumeBadgeProps> = ({ volumeMl, label, className = "" }) => {
  if (!volumeMl && !label) return null;
  const display = label || (volumeMl ? formatVolume(volumeMl) : null);
  if (!display) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full bg-gray-900/85 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gray-100 backdrop-blur-sm ${className}`}
    >
      {display}
    </span>
  );
};

export default VolumeBadge;
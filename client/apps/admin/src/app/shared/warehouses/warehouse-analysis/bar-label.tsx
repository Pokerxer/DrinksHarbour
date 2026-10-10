import { fmtDataLabel, type Measure } from '../warehouse-analysis-helpers';

// Recharts' default label derives width from parentViewBox. That box can be
// incomplete while a responsive chart is measured or a preserved tab is hidden.
export function BarValueLabel({
  geometry,
  measure,
  horizontal,
}: {
  geometry: unknown;
  measure: Measure;
  horizontal: boolean;
}) {
  if (!geometry || typeof geometry !== 'object') return null;
  const props = geometry as {
    x?: unknown;
    y?: unknown;
    width?: unknown;
    height?: unknown;
    value?: unknown;
  };
  const { x, y, width, height, value } = props;
  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof y !== 'number' ||
    !Number.isFinite(y) ||
    typeof width !== 'number' ||
    !Number.isFinite(width) ||
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0
  )
    return null;
  const labelX = horizontal ? x + width + 4 : x + width / 2;
  const labelY = horizontal ? y + height / 2 : y - 4;
  if (!Number.isFinite(labelX) || !Number.isFinite(labelY)) return null;
  return (
    <text
      x={labelX}
      y={labelY}
      textAnchor={horizontal ? 'start' : 'middle'}
      dominantBaseline={horizontal ? 'middle' : 'auto'}
      fontSize={11}
      fontWeight={600}
      fill="#4a3f3a"
    >
      {fmtDataLabel(value, measure)}
    </text>
  );
}

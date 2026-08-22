import { Text, View } from 'react-native';
import { toStockStatusView, type StockStatusInput, type StockTone } from '../../lib/stock-status.ts';

/**
 * The web `<StockStatus size="sm" showProgress>` row, 1:1.
 *
 * All three product cards on the homepage render it, so its dot + 9px label +
 * 4px bar is a large part of what makes the grids look like the web's.
 */

const TEXT: Record<StockTone, string> = {
  out: 'text-red-500',
  almost: 'text-red-500',
  fast: 'text-orange-500',
  limited: 'text-yellow-600',
  in: 'text-emerald-500',
};

const DOT: Record<StockTone, string> = {
  out: 'bg-red-500',
  almost: 'bg-red-500',
  fast: 'bg-orange-500',
  limited: 'bg-yellow-500',
  in: 'bg-emerald-500',
};

export function StockStatus({
  showProgress = false,
  ...input
}: StockStatusInput & { showProgress?: boolean }) {
  const view = toStockStatusView(input);

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-1">
        <View className={`h-1.5 w-1.5 rounded-full ${DOT[view.tone]}`} />
        <Text className={`text-[9px] font-medium ${TEXT[view.tone]}`}>{view.text}</Text>
      </View>

      {showProgress ? (
        <View className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
          <View
            className={`h-full rounded-full ${DOT[view.tone]}`}
            style={{ width: `${view.remainingPct}%` }}
          />
        </View>
      ) : null}
    </View>
  );
}

import { type ReactNode, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';

/**
 * Paged horizontal scroll with dots.
 *
 * Page width is the window width rather than a measured layout: the hero spans
 * the screen edge to edge, and measuring would make the first paint jump.
 */
export function Carousel<T>({
  data,
  renderItem,
  keyExtractor,
  height,
}: {
  data: T[];
  renderItem: (item: T) => ReactNode;
  keyExtractor: (item: T) => string;
  height: number;
}) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== page) setPage(next);
  };

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ height }}
      >
        {data.map((item) => (
          <View key={keyExtractor(item)} style={{ width, height }}>
            {renderItem(item)}
          </View>
        ))}
      </ScrollView>

      {data.length > 1 ? (
        <View className="flex-row items-center justify-center gap-1.5 pt-3">
          {data.map((item, index) => (
            <View
              key={keyExtractor(item)}
              className={`h-1.5 rounded-full ${
                index === page ? 'w-4 bg-gray-900' : 'w-1.5 bg-gray-300'
              }`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

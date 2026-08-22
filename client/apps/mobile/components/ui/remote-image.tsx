import { Image } from 'expo-image';
import { View } from 'react-native';
import type { ImageStyle, StyleProp } from 'react-native';

/**
 * Every remote image in the app.
 *
 * expo-image rather than RN's Image because RN's has no disk cache policy, and
 * a product grid re-downloading its thumbnails on every scroll is the single
 * most visible way this app could feel cheap.
 *
 * `uri` is nullable on purpose: primaryImage and images[0] are both optional on
 * a product, so the missing case is normal and gets a flat placeholder rather
 * than a broken-image glyph.
 */
export function RemoteImage({
  uri,
  className = '',
  contentFit = 'cover',
  style,
}: {
  uri: string | null;
  className?: string;
  contentFit?: 'cover' | 'contain';
  style?: StyleProp<ImageStyle>;
}) {
  if (!uri) {
    return <View className={`bg-gray-100 ${className}`} style={style} />;
  }

  return (
    <Image
      source={{ uri }}
      className={className}
      style={style}
      contentFit={contentFit}
      cachePolicy="disk"
      transition={150}
    />
  );
}

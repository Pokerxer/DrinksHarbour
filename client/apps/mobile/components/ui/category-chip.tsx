import { MaterialCommunityIcons } from '@expo/vector-icons';
import { View } from 'react-native';
import { resolveCategoryIcon } from '../../lib/category-icons.ts';

/**
 * The rounded icon plate beside a category — `MobileBottomNav.tsx:66-84`.
 *
 * `size` drives both the plate and the glyph (the web draws the glyph at half
 * the plate), so one number keeps the four call sizes (32/36/40/44) in step.
 */
export function CategoryChip({
  cat,
  size = 36,
  active = false,
}: {
  cat: { slug?: string; name?: string; icon?: string; color?: string };
  size?: number;
  active?: boolean;
}) {
  const { icon, color, bgTint } = resolveCategoryIcon(cat);

  return (
    <View
      // The web marks the active chip with `ring-2 ring-orange-300`; RN has no
      // ring, so the same colour is drawn as a border.
      className={`items-center justify-center rounded-xl ${bgTint} ${
        active ? 'border-2 border-orange-300' : ''
      }`}
      style={{ width: size, height: size }}
    >
      <MaterialCommunityIcons name={icon as never} size={size * 0.5} color={color} />
    </View>
  );
}

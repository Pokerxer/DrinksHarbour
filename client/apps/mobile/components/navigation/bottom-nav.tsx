import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isNavItemActive, NAV_ITEMS, type NavItem, type NavItemId } from '../../lib/bottom-nav.ts';

/**
 * The bottom tab bar — `apps/platform/src/components/Navigation/
 * MobileBottomNav.tsx:436-458`.
 *
 * Orange for the active tab, gray-500 otherwise; a cart badge; and the small
 * dot under the label that the web keeps mounted at `opacity-0` so the row
 * never shifts height between states. That detail is reproduced rather than
 * simplified — dropping it makes the labels jump by 4px on every tab change.
 *
 * The web's `safe-area-bottom` class becomes the real inset here.
 */

const ACTIVE = '#f97316'; // orange-500
const INACTIVE = '#6b7280'; // gray-500

function NavButton({
  item,
  active,
  cartCount,
  onPress,
}: {
  item: NavItem;
  active: boolean;
  cartCount: number;
  onPress: () => void;
}) {
  const showBadge = item.id === 'cart' && cartCount > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.label}
      className="flex-1 items-center"
    >
      <View className="items-center gap-0.5 rounded-xl px-3 py-1.5">
        <View className="relative">
          <Ionicons
            name={(active ? item.activeIcon : item.icon) as never}
            size={20}
            color={active ? ACTIVE : INACTIVE}
          />
          {showBadge ? (
            <View className="absolute -right-1 -top-1 h-[13px] min-w-[13px] items-center justify-center rounded-full bg-red-500 px-0.5">
              <Text className="text-[8px] font-bold text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          className={`text-[10px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}
          style={{ color: active ? ACTIVE : INACTIVE }}
        >
          {item.label}
        </Text>

        {/* Always mounted, invisible when inactive — keeps the row height fixed. */}
        <View
          className="h-1 w-1 rounded-full"
          style={{ backgroundColor: ACTIVE, opacity: active ? 1 : 0 }}
        />
      </View>
    </Pressable>
  );
}

export function BottomNav({
  pathname,
  drawerOpen,
  cartCount = 0,
  onSelect,
}: {
  pathname: string;
  drawerOpen: boolean;
  cartCount?: number;
  onSelect: (id: NavItemId) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="border-t border-gray-200 bg-white"
      style={{ paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center justify-around px-1 py-1">
        {NAV_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={isNavItemActive(item, pathname, drawerOpen)}
            cartCount={cartCount}
            onPress={() => onSelect(item.id)}
          />
        ))}
      </View>
    </View>
  );
}

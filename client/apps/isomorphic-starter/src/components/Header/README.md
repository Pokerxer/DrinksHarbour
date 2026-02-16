# Header Component

A comprehensive, responsive header component for DrinksHarbour e-commerce platform.

## Features

### 1. Announcement Bar
- Scrolling promotional messages (marquee style)
- Dynamic data fetching from API
- Auto-fallback to default announcements
- Multiple variants (promo, info, success, warning, error)

### 2. Top Bar
- Language selector (English, Yoruba, Igbo)
- Currency selector (NGN, USD, EUR, GBP)
- Quick links (Help, Track Order, VIP Club)
- Social media links (Facebook, Instagram, Twitter)
- Promo text (Free delivery announcement)

### 3. Main Header
- Logo with brand name
- Search bar with auto-complete
- User account icon
- Wishlist with counter
- Shopping cart with counter
- Sticky header on scroll

### 4. Category Navigation
- 6 main categories (Whiskey, Wine, Beer, Vodka, Gin, Rum)
- Dropdown menus with subcategories
- Animated hover effects
- Scrollable on mobile
- Quick access to Sale & New Arrivals

### 5. Mobile Menu
- Slide-in menu
- Category accordion
- Search functionality
- Full navigation access

## Usage

### Basic Usage
```tsx
import { Header } from '@/components/Header';

<Header />
```

### With Custom Options
```tsx
import { Header } from '@/components/Header';

<Header
  variant="default" // 'default' | 'transparent' | 'dark'
  showAnnouncement={true}
/>
```

### Dark Variant
```tsx
<Header variant="dark" showAnnouncement={false} />
```

## Component Structure

```
Header/
├── Header.tsx           # Main header component
├── index.ts             # Export barrel
└── README.md            # Documentation
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | 'default' \| 'transparent' \| 'dark' | 'default' | Header color scheme |
| showAnnouncement | boolean | true | Show announcement bar |

## Categories

The header includes 6 main drink categories:

1. **Whiskey** 🥃 - Scotch, Bourbon, Irish, Japanese, Rye
2. **Wine** 🍷 - Red, White, Rosé, Sparkling, Dessert
3. **Beer** 🍺 - Lager, IPA, Stout, Wheat, Craft
4. **Vodka** 🌾 - Premium, Flavored, Economy
5. **Gin** 🌿 - London Dry, Botanical, Old Tom
6. **Rum** - White, Aged, Spiced

## Responsive Design

- **Desktop (>1024px)**: Full header with all features
- **Tablet (768-1024px)**: Simplified top bar, full navigation
- **Mobile (<768px)**: Hamburger menu, mobile search overlay

## Features

### Animations
- Smooth scroll detection
- Hover effects on categories
- Mobile menu slide-in
- Search overlay fade

### Accessibility
- Keyboard navigation
- ARIA labels
- Focus management
- Screen reader friendly

### Performance
- Lazy loaded categories
- Optimized animations
- Efficient re-renders

## API Integration

The header fetches:
- Announcements: `GET /api/banners/placement/header`
- Categories: From server configuration

## Customization

### Colors
Edit the variant prop:
- `default`: White background, dark text
- `transparent`: Transparent on scroll
- `dark`: Dark background, light text

### Categories
Edit the `categories` array in Header.tsx:

```tsx
const categories = [
  {
    name: 'Category Name',
    slug: 'category-slug',
    icon: '🎯',
    subcategories: [
      { name: 'Subcategory', slug: 'sub-slug' }
    ]
  }
];
```

## Dependencies

- `framer-motion` - Animations
- `react-icons/pi` - Phosphor icons
- `next/image` - Image optimization
- `next/link` - Navigation

## Example

```tsx
import { Header } from '@/components/Header';

export default function Layout({ children }) {
  return (
    <>
      <Header variant="default" showAnnouncement={true} />
      <main>{children}</main>
    </>
  );
}
```

## Notes

- The announcement banner has fallback data for offline use
- Categories are fully customizable
- Mobile menu supports deep linking
- Search works with the shop page
- Cart and wishlist counters update from context

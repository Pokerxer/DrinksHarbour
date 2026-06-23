# Banner Components Documentation

## Overview
A comprehensive banner system with 4 main banner types, each designed for specific use cases on the DrinksHarbour e-commerce platform.

---

## Banner Types

### 1. Hero Banner (`HeroBanner.tsx`)
**Purpose:** Large, attention-grabbing banners for homepage and featured placements.

**Features:**
- Auto-rotating carousel with multiple slides
- 6 animation types: fade, slide, slideLeft, slideRight, zoom, bounce
- 9 content positions
- Mobile-specific images
- CTA buttons with 4 styles
- Progress bar indicator
- Keyboard navigation

**Usage:**
```tsx
import { HeroBanner } from '@/components/Banner';

<HeroBanner
  placement="home_hero"
  limit={5}
  autoPlay={true}
  showControls={true}
  showIndicators={true}
/>
```

**Props:**
- `placement`: Banner placement identifier (default: 'home_hero')
- `limit`: Maximum number of banners to fetch
- `autoPlay`: Enable/disable auto-rotation
- `showControls`: Show navigation arrows
- `showIndicators`: Show slide indicators

---

### 2. Promotional Banner (`PromotionalBanner.tsx`)
**Purpose:** Sales, discounts, and special offer banners.

**Layouts:**
- **overlay** - Image with gradient overlay
- **card** - Prominent discount badge centered
- **split** - Content alongside background image
- **badge** - Compact with floating discount badge

**Features:**
- Auto-discount extraction (%, BOGO, FREE)
- Real-time countdown timers
- Priority indicators (urgent, high, medium, low)
- Responsive grid layouts (1-4 columns)

**Usage:**
```tsx
import { PromotionalBanner } from '@/components/Banner';

<PromotionalBanner
  placement="home_secondary"
  layout="overlay"
  showCountdown={true}
  columns={2}
/>
```

**Props:**
- `layout`: 'overlay' | 'card' | 'split' | 'badge'
- `showCountdown`: Display countdown timer
- `columns`: Grid columns (1-4)

---

### 3. Category Banner (`CategoryBanner.tsx`)
**Purpose:** Category page headers and navigation.

**Layouts:**
- **hero** - Full-width with subcategories
- **card** - Medium-sized with overlay
- **minimal** - Compact with icon
- **sidebar** - Tall vertical banner

**Features:**
- Dynamic category data fetching
- Product count display
- Subcategory navigation chips
- Category-specific colors and icons

**Usage:**
```tsx
import { CategoryBanner } from '@/components/Banner';

<CategoryBanner
  categorySlug="whiskey"
  layout="hero"
  showSubcategories={true}
  showStats={true}
/>
```

---

### 4. Announcement Banner (`AnnouncementBanner.tsx`)
**Purpose:** Shipping info, promo codes, alerts.

**Layouts:**
- **marquee** - Scrolling text (replaces BannerTop)
- **static** - Single line banner
- **alert** - Prominent alert box
- **toast** - Floating notification

**Features:**
- Multiple variants: info, success, warning, error, promo
- Click tracking
- Close/dismiss functionality
- Auto-fallback to default announcements

**Usage:**
```tsx
import { AnnouncementBanner } from '@/components/Banner';

<AnnouncementBanner
  placement="header"
  layout="marquee"
  variant="promo"
/>
```

---

## Data Integration

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/banners/placement/:placement` | Fetch banners by placement |
| `GET /api/banners/:id` | Fetch single banner |
| `POST /api/banners/:id/impression` | Track impression |
| `POST /api/banners/:id/click` | Track click |

### Banner Schema Types
```typescript
type BannerType = 'hero' | 'promotional' | 'category' | 'product' | 'seasonal' | 'announcement' | 'custom';
type Placement = 'home_hero' | 'home_secondary' | 'category_top' | 'product_page' | 'checkout' | 'sidebar' | 'footer' | 'popup' | 'header';
```

---

### 5. Seasonal Banner (`SeasonalBanner.tsx`)
**Purpose:** Holiday and special event banners with decorative themes.

**Themes:**
- `christmas` - 🎄🎅🎁❄️ Red/green theme
- `newyear` - 🎉✨🎊🕛 Gold/black theme
- `easter` - 🐰🥚🌸 Pastel theme
- `summer` - ☀️🏖️🍹 Orange/teal theme
- `halloween` - 🎃👻🦇 Orange/purple theme
- `valentine` - ❤️💕🌹 Pink/red theme
- `blackfriday` - 💥🔥⚡ Black/red theme

**Layouts:**
- `hero` - Full-width with animated decorations
- `card` - Grid cards with hover effects
- `minimal` - Compact banner strips
- `split` - Content/image side-by-side

**Usage:**
```tsx
import { SeasonalBanner } from '@/components/Banner';

<SeasonalBanner
  theme="christmas"
  layout="hero"
  showDecorations={true}
  showCountdown={true}
/>
```

---

### 6. Product Banner (`ProductBanner.tsx`)
**Purpose:** Product and brand-specific banners for product pages.

**Layouts:**
- `hero` - Full featured product hero with image gallery
- `featured` - Split layout with product details
- `brand` - Brand story with logo and description
- `upsell` - Cart upsell banner
- `sidebar` - Compact sidebar product card

**Features:**
- Dynamic product data fetching
- Star rating display
- Price with discount calculation
- Stock status indicator
- Image gallery (hero layout)
- Brand logos

**Usage:**
```tsx
import { ProductBanner } from '@/components/Banner';

<ProductBanner
  placement="product_page"
  productId="product-id"
  layout="hero"
  showReviews={true}
  showPrice={true}
  showAddToCart={true}
/>
```

**Props:**
- `brandSlug`: Fetch banner by brand
- `productId`: Fetch banner by product
- `showReviews`: Display star rating
- `showPrice`: Display price
- `showAddToCart`: Show add to cart button

---

### 7. Footer Banner (`FooterBanner.tsx`)
**Purpose:** Footer sections with newsletter signup, social links, and footer navigation.

**Layouts:**
- `newsletter` - Newsletter signup with email form
- `promo` - Feature highlights (free delivery, etc.)
- `links` - Footer navigation links
- `social` - Social media and copyright
- `compact` - Mini footer banner

**Features:**
- Newsletter subscription form
- Social media links
- Footer navigation (Shop, Support, Company, Legal)
- Payment method icons
- Age verification notice
- Currency/Language selectors
- Email subscription with success state

**Usage:**
```tsx
import { FooterBanner } from '@/components/Banner';

// Newsletter signup section
<FooterBanner
  placement="footer"
  layout="newsletter"
/>

// Feature highlights
<FooterBanner
  placement="footer"
  layout="promo"
/>

// Footer links
<FooterBanner
  placement="footer"
  layout="links"
  showSocial={true}
/>

// Social & copyright
<FooterBanner
  placement="footer"
  layout="social"
  showPayment={true}
/>
```

**Props:**
- `layout`: 'newsletter' | 'promo' | 'links' | 'social' | 'compact'
- `showNewsletter`: Show newsletter form
- `showSocial`: Show social media links
- `showLinks`: Show footer navigation
- `showPayment`: Show payment icons

---

## Integration Guide

### Homepage Integration
**File:** `src/app/page.tsx`

```tsx
import { AnnouncementBanner, HeroBanner, PromotionalBanner, SeasonalBanner } from '@/components/Banner';

export default function Home() {
  return (
    <>
      {/* Announcement Banner - Marquee */}
      <AnnouncementBanner
        placement="header"
        layout="marquee"
        variant="promo"
      />

      {/* Hero Banner */}
      <HeroBanner
        placement="home_hero"
        limit={5}
        autoPlay={true}
        showControls={true}
        showIndicators={true}
      />

      {/* Promotional Banners */}
      <section className="container mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6">Special Offers</h2>
        <PromotionalBanner
          placement="home_secondary"
          layout="overlay"
          showCountdown={true}
          columns={2}
        />
      </section>

      {/* Additional Sections... */}
    </>
  );
}
```

### Shop Page Integration
**File:** `src/app/shop/page.tsx`

```tsx
import { AnnouncementBanner, CategoryBanner, PromotionalBanner } from '@/components/Banner';

export default function ShopPage() {
  return (
    <>
      {/* Announcement Banner */}
      <AnnouncementBanner
        placement="header"
        layout="static"
        variant="promo"
      />

      {/* Category Banner */}
      <section className="container mx-auto px-4">
        <CategoryBanner
          categorySlug={category || subcategory || undefined}
          placement="category_top"
          layout="hero"
          showSubcategories={true}
          showStats={true}
        />
      </section>

      {/* Promotional Banner */}
      <section className="container mx-auto px-4 py-6">
        <PromotionalBanner
          placement="home_secondary"
          layout="card"
          showCountdown={true}
          columns={4}
        />
      </section>

      {/* Product Grid... */}
    </>
  );
}
```

### Product Page Integration
**File:** `src/app/product/[slug]/page.tsx`

```tsx
import { AnnouncementBanner, ProductBanner, PromotionalBanner } from '@/components/Banner';

export default function ProductPage() {
  return (
    <>
      {/* Announcement Banner */}
      <AnnouncementBanner
        placement="header"
        layout="static"
        variant="info"
      />

      {/* Product Banner - Featured */}
      <ProductBanner
        placement="product_page"
        productId={productData._id}
        layout="featured"
        showReviews={true}
        showPrice={true}
        showAddToCart={true}
      />

      {/* Upsell Banner */}
      <section className="container mx-auto px-4 py-4">
        <PromotionalBanner
          placement="product_page"
          layout="upsell"
          showCountdown={true}
          columns={1}
        />
      </section>
    </>
  );
}
```

### Checkout Page Integration
**File:** `src/app/checkout/page.tsx`

```tsx
import { AnnouncementBanner, ProductBanner } from '@/components/Banner';

export default function CheckoutPage() {
  return (
    <>
      {/* Announcement Banner */}
      <AnnouncementBanner
        placement="header"
        layout="static"
        variant="success"
      />

      {/* Product Upsell Banner */}
      <section className="container mx-auto px-4 py-4">
        <ProductBanner
          placement="checkout"
          layout="upsell"
          showPrice={true}
        />
      </section>

      {/* Checkout Form... */}
    </>
  );
}
```

### Footer Integration
**File:** `src/components/Footer/Footer.tsx`

```tsx
import { FooterBanner } from '@/components/Banner';

const Footer = () => {
  return (
    <>
      {/* Newsletter Section */}
      <FooterBanner
        placement="footer"
        layout="newsletter"
      />

      {/* Features Section */}
      <FooterBanner
        placement="footer"
        layout="promo"
      />

      {/* Main Footer Content */}
      <div className="footer-main bg-[#1A1A2E]">
        {/* Existing footer content */}
      </div>

      {/* Social & Copyright */}
      <FooterBanner
        placement="footer"
        layout="social"
        showPayment={true}
      />
    </>
  );
};
```

### Page Layout Wrapper
**File:** `src/components/Layout/PageLayout.tsx`

```tsx
import { AnnouncementBanner } from '@/components/Banner';

interface PageLayoutProps {
  children: React.ReactNode;
  showAnnouncement?: boolean;
  announcementVariant?: 'info' | 'success' | 'warning' | 'error' | 'promo';
  announcementLayout?: 'marquee' | 'static' | 'alert' | 'toast';
}

export default function PageLayout({
  children,
  showAnnouncement = true,
  announcementVariant = 'promo',
  announcementLayout = 'static',
}: PageLayoutProps) {
  return (
    <>
      {showAnnouncement && (
        <AnnouncementBanner
          placement="header"
          layout={announcementLayout}
          variant={announcementVariant}
        />
      )}
      {children}
    </>
  );
}
```

### Demo Page
**File:** `src/app/banners-demo/page.tsx`

A comprehensive demo page showcasing all banner components with live examples and API documentation.

---

## Migration Checklist

- [x] Replaced static `BannerTop` with dynamic `AnnouncementBanner`
- [x] Replaced static `Banner` with dynamic `HeroBanner`
- [x] Added `PromotionalBanner` for sales/discounts
- [x] Added `CategoryBanner` for category pages
- [x] Added `SeasonalBanner` for holiday themes
- [x] Added `ProductBanner` for product pages
- [x] Added `FooterBanner` for footer sections
- [x] Integrated banners into homepage
- [x] Integrated banners into shop page
- [x] Integrated banners into product page
- [x] Integrated banners into checkout page
- [x] Created PageLayout wrapper component
- [x] Created demo page with examples
```tsx
import { HeroBanner } from '@/components/Banner';

export default function Homepage() {
  return (
    <HeroBanner placement="home_hero" autoPlay={true} />
  );
}
```

### 2. Promotional Section
```tsx
import { PromotionalBanner } from '@/components/Banner';

export default function Promotions() {
  return (
    <PromotionalBanner
      placement="home_secondary"
      layout="card"
      showCountdown={true}
      columns={3}
    />
  );
}
```

### 3. Category Page
```tsx
import { CategoryBanner } from '@/components/Banner';

export default function CategoryPage({ params }: { params: { slug: string } }) {
  return (
    <CategoryBanner
      categorySlug={params.slug}
      layout="hero"
      showSubcategories={true}
    />
  );
}
```

### 4. Announcement Bar
```tsx
import { AnnouncementBanner } from '@/components/Banner';

export default function Layout() {
  return (
    <AnnouncementBanner
      placement="header"
      layout="marquee"
      variant="promo"
    />
  );
}
```

---

## Migration from Existing Components

### Replacing BannerTop
**Old:**
```tsx
import BannerTop from '@/components/Banner/BannerTop';
<BannerTop props="" textColor="text-gray-50" bgLine="bg-gray-50" />
```

**New:**
```tsx
import { AnnouncementBanner } from '@/components/Banner';
<AnnouncementBanner layout="marquee" variant="promo" />
```

### Replacing Static Banner Components
**Old:**
```tsx
import Banner from '@/components/Banner/Banner';
```

**New:**
```tsx
import { HeroBanner } from '@/components/Banner';
<HeroBanner placement="home_hero" />
```

---

## Animation System

All banners support Framer Motion animations:

| Animation | Description |
|-----------|-------------|
| `fade` | Opacity transition |
| `slide` | Slide from right |
| `slideLeft` | Slide from left |
| `slideRight` | Slide from right |
| `zoom` | Scale in/out |
| `bounce` | Bounce in |

**Usage:**
```tsx
<HeroBanner
  placement="home_hero"
  animation={{ type: 'fade', duration: 1000, delay: 0 }}
/>
```

---

## Responsive Design

All components are fully responsive with:
- Mobile-specific images
- Adaptive text sizes
- Touch-friendly controls
- Mobile-optimized layouts

### Breakpoint Classes
- `md:` - Tablet and up
- `lg:` - Desktop and up
- `xl:` - Large desktop

---

## Performance Optimization

1. **Image Loading**
   - Use `priority` prop for above-fold images
   - Specify `sizes` attribute for responsive images

2. **Animation**
   - Animations disabled on `prefers-reduced-motion`
   - GPU-accelerated transforms

3. **Data Fetching**
   - Server-side rendering compatible
   - Client-side caching
   - Error boundaries

---

## Accessibility

- Keyboard navigation support
- ARIA labels on all interactive elements
- Screen reader friendly content
- Focus management
- `prefers-reduced-motion` support

---

## Error Handling

- Loading skeletons
- Error states with retry
- Graceful degradation
- Server unavailable fallback

---

## Future Enhancements

- [ ] A/B testing support
- [ ] Personalization
- [ ] Analytics dashboard
- [ ] Drag-and-drop ordering
- [ ] Bulk import/export
- [ ] Banner templates library

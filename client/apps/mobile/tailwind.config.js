const sharedConfig = require('tailwind-config').default;

const sharedColors = sharedConfig.theme?.extend?.colors ?? {};

/**
 * The storefront's gray scale.
 *
 * `apps/platform/tailwind.config.ts` does NOT consume `packages/config-tailwind`
 * — it redeclares `gray` as Tailwind's own default scale. So `text-gray-500` is
 * `#6b7280` on the web but `rgb(102 102 102)` under the shared tokens, and a
 * screen written to match the web would quietly come out a different colour.
 *
 * These nine steps are copied from the platform config verbatim so the two apps
 * agree. `gray-0` / `gray-1000` (white / black) are not in the platform scale and
 * stay token-driven, which is why this merges over `sharedColors.gray` rather
 * than replacing it.
 */
const platformGray = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Only the token maps are pulled through. The shared config's plugins
      // (@tailwindcss/forms, @tailwindcss/container-queries) and its `screens`
      // target DOM elements and media queries that do not exist under
      // NativeWind — spreading the whole config breaks the build.
      colors: {
        ...sharedColors,
        gray: { ...(sharedColors.gray ?? {}), ...platformGray },
      },
      fontSize: sharedConfig.theme?.extend?.fontSize ?? {},
      borderRadius: sharedConfig.theme?.extend?.borderRadius ?? {},
    },
  },
  plugins: [],
};

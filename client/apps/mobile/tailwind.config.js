const sharedConfig = require('tailwind-config').default;

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
      colors: sharedConfig.theme?.extend?.colors ?? {},
      fontSize: sharedConfig.theme?.extend?.fontSize ?? {},
      borderRadius: sharedConfig.theme?.extend?.borderRadius ?? {},
    },
  },
  plugins: [],
};

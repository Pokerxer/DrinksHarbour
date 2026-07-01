import type { Config } from 'tailwindcss';
import sharedConfig from 'tailwind-config';

const config: Pick<Config, 'prefix' | 'presets' | 'content' | 'theme'> = {
  content: [
    './src/**/*.tsx',
    './node_modules/rizzui/dist/*.{js,ts,jsx,tsx}',
    '../../packages/isomorphic-core/src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [sharedConfig],
  theme: {
    extend: {
      colors: {
        brand: {
          lighter: 'rgb(var(--brand-lighter) / <alpha-value>)',
          DEFAULT: 'rgb(var(--brand-default) / <alpha-value>)',
          dark: 'rgb(var(--brand-dark) / <alpha-value>)',
        },
      },
    },
  },
};

export default config;

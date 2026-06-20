import { Fraunces } from 'next/font/google';

// Serif display face used for headlines and figures on the Employees page —
// pairs with the app-wide Inter body type (mirrors the Purchases pages).
export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

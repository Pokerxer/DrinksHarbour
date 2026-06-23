import { Fraunces } from 'next/font/google';

// Serif display face used for headlines and figures on the Contacts page —
// pairs with the app-wide Inter body type (mirrors the Employees pages).
export const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

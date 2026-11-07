import localFont from 'next/font/local';

export const fraunces = localFont({ src: [{ path: '../../../../packages/fonts/fraunces.woff2', weight: '100 900', style: 'normal' }, { path: '../../../../packages/fonts/fraunces-italic.woff2', weight: '100 900', style: 'italic' }], variable: '--font-fraunces', display: 'swap' });
export const inter = localFont({ src: '../../../../packages/fonts/inter.woff2', weight: '100 900', variable: '--font-inter', display: 'swap' });
export const lexendDeca = localFont({ src: '../../../../packages/fonts/lexend-deca.woff2', weight: '100 900', variable: '--font-lexend', display: 'swap' });

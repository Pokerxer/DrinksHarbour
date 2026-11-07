import localFont from 'next/font/local';

export const fraunces = localFont({ src: [{ path: '../../../../packages/fonts/fraunces.woff2', weight: '100 900', style: 'normal' }, { path: '../../../../packages/fonts/fraunces-italic.woff2', weight: '100 900', style: 'italic' }], variable: '--font-fraunces', display: 'swap' });
export const elmsSans = localFont({ src: '../../../../packages/fonts/elms-sans.woff2', weight: '100 900', variable: '--font-elms-sans', display: 'swap' });
export const kavoon = localFont({ src: '../../../../packages/fonts/kavoon.woff2', weight: '400', variable: '--font-kavoon', display: 'swap' });

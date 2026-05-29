import './src/env.mjs';
import withSerwist from '@serwist/next';
/** @type {import('next').NextConfig} */

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'randomuser.me',
        pathname: '/api/portraits/**',
      },
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/u/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 's3.amazonaws.com',
        pathname: '/redqteam.com/isomorphic-furyroad/public/**',
      },
      {
        protocol: 'https',
        hostname: 'isomorphic-furyroad.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'isomorphic-furyroad.vercel.app',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  reactStrictMode: true,
  // Serve POS terminal pages (no admin header) under /point-of-sale/* URLs.
  // beforeFiles rewrites take priority over filesystem routes so the
  // (hydrogen) layout is bypassed and only the root layout is used.
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/point-of-sale/sell',     destination: '/pos/sell'     },
        { source: '/point-of-sale/history',  destination: '/pos/orders'   },
        { source: '/point-of-sale/sessions', destination: '/pos/sessions' },
      ],
    };
  },
  transpilePackages: ['core', 'framer-motion'],
  // Ignore specific build warnings that don't break the build
  webpack: (config) => {
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /@hookform/,
      },
    ];
    return config;
  },
};

const serwist = withSerwist({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  reloadOnOnline: false,
});

export default serwist(nextConfig);

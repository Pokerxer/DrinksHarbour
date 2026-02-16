#!/bin/bash
# Script to clear Next.js cache and start dev server

echo "🧹 Clearing Next.js cache..."
sudo rm -rf .next

echo "🧹 Clearing other caches..."
rm -rf node_modules/.cache 2>/dev/null

echo "🚀 Starting dev server without cache..."
npm run dev

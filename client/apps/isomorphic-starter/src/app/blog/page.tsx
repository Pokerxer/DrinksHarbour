'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';

export default function BlogPage() {
  const posts = [
    {
      id: 1,
      title: 'Top 10 Wines for Beginners',
      excerpt: 'Starting your wine journey? Here are our recommendations for beginner-friendly wines.',
      category: 'Wine Guide',
      date: 'March 10, 2026',
      image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600',
      slug: 'top-10-wines-for-beginners'
    },
    {
      id: 2,
      title: 'The Art of Mixology: Basic Cocktail Recipes',
      excerpt: 'Learn how to make classic cocktails at home with these simple recipes.',
      category: 'Recipes',
      date: 'March 5, 2026',
      image: 'https://images.unsplash.com/photo-1514362545857-3bc16549766b?w=600',
      slug: 'art-of-mixology'
    },
    {
      id: 3,
      title: 'Understanding Beer Styles',
      excerpt: 'A comprehensive guide to different beer styles and what makes each unique.',
      category: 'Beer Guide',
      date: 'February 28, 2026',
      image: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=600',
      slug: 'understanding-beer-styles'
    },
    {
      id: 4,
      title: 'Whiskey Tasting 101',
      excerpt: 'Everything you need to know about tasting whiskey like a pro.',
      category: 'Spirits Guide',
      date: 'February 20, 2026',
      image: 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=600',
      slug: 'whiskey-tasting-101'
    },
    {
      id: 5,
      title: 'Hosting the Perfect Party',
      excerpt: 'Tips and tricks for hosting an unforgettable celebration.',
      category: 'Entertaining',
      date: 'February 15, 2026',
      image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=600',
      slug: 'hosting-perfect-party'
    },
    {
      id: 6,
      title: 'Non-Alcoholic Drink Alternatives',
      excerpt: 'Explore delicious mocktails and non-alcoholic beverages.',
      category: 'Drinks',
      date: 'February 10, 2026',
      image: 'https://images.unsplash.com/photo-1536935338788-846bb9981813?w=600',
      slug: 'non-alcoholic-drinks'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Blog</h1>
          <p className="mt-2 text-gray-600">News, tips, and guides from DrinksHarbour</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <article key={post.id} className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative h-48 bg-gray-200">
                <Image 
                  src={post.image} 
                  alt={post.title}
                  fill
                  className="object-cover"
                />
                <span className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 text-xs font-medium text-gray-900 rounded-full">
                  {post.category}
                </span>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-500 mb-2">{post.date}</p>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  <Link href={`/blog/${post.slug}`} className="hover:underline">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-gray-600 text-sm mb-4">{post.excerpt}</p>
                <Link 
                  href={`/blog/${post.slug}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 hover:underline"
                >
                  Read More <Icon.PiArrowRightBold />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
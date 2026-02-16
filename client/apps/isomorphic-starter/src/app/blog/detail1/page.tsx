'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import blogData from '@/data/Blog.json';
import NewsInsight from '@/components/Home3/NewsInsight';
import { useRouter } from 'next/navigation';
const BlogDetailOne = () => {;
const searchParams = useSearchParams();
const router = useRouter();
let blogId = searchParams.get('id');
if (blogId === null) { blogId = '14' };
const blogMain = blogData[Number(blogId) - 1];
const handleBlogClick = (category: string) => { // Go to blog detail with category selected router.push(`/blog/default?category=${category}`); };
const handleBlogDetail = (id: string) => { // Go to blog detail with id selected router.push(`/blog/detail1?id=${id}`); };
return (
className='w-full min-[1600px]:h-[800px] xl:h-[640px] lg:h-[520px] sm:h-[380px] h-[260px] object-cover' /> </div> <div className="container md:pt-20 pt-10"> <div className="blog-content flex items-center justify-center"> <div className="main md:w-5/6 w-full"> <div className="blog-tag bg-green-400 py-1 px-2.5 rounded-full text-button-uppercase inline-block">{blogMain.tag}</div> <div className="heading3 mt-3">{blogMain.title}</div> <div className="author flex items-center gap-4 mt-4"> <div className="avatar w-10 h-10 rounded-full overflow-hidden flex-shrink-0"> <Image src={blogMain.avatar} width={200} height={200} alt='avatar' className='w-full h-full object-cover' /> </div> <div className='flex items-center gap-2'> <div className="caption1 text-secondary">by {blogMain.author}</div> <div className="line w-5 h-px bg-secondary"></div> <div className="caption1 text-secondary">{blogMain.date}</div> </div> </div> <div className="content md:mt-8 mt-5"> <div className="body1">{blogMain.description}</div> <div className="body1 mt-3">I’ve always been passionate about underwear and shapewear and have a huge collection from over the years! When it came to shapewear, I could never find exactly what I was looking for and I would cut up pieces and sew them together to create the style and compression I needed.</div> <div className="grid sm:grid-cols-2 gap-[30px] md:mt-8 mt-5"> {blogMain.subImg.map((item, index) => ( <Image key={index} src={item} width={3000} height={2000} alt={item}
};

export default BlogDetailOne
'use client';
import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Breadcrumb from '@/components/Breadcrumb/Breadcrumb';
import blogData from '@/data/Blog.json';
import BlogItem from '@/components/Blog/BlogItem';
import HandlePagination from '@/components/Other/HandlePagination'
import { useRouter } from 'next/navigation';
import * as Icon from "react-icons/pi";
const BlogDefault = () => {;
const [currentPage, setCurrentPage] = useState(0);
const productsPerPage = 3;
const offset = currentPage * productsPerPage;
const router = useRouter();
const searchParams = useSearchParams();
let dataCategory = searchParams.get('category');
const [category, setCategory] = useState<string | null>(dataCategory);
const handleCategory = (category: string) => { setCategory(prevCategory => prevCategory === category ? null : category) };
const handleBlogClick = (blogId: string) => { // Go to blog detail with blogId selected router.push(`/blog/detail1?id=${blogId}`); };
let filteredData = blogData.filter(blog => {;
let isCategoryMatched = true if (category) { isCategoryMatched = blog.category === category && blog.category !== 'underwear' };
return isCategoryMatched });
if (filteredData.length === 0) { filteredData = [{ id: "no-data",
category: "no-data", tag: "no-data",
title: "no-data", date: "no-data",
author: "no-data", avatar: "no-data",
thumbImg: "", coverImg: "",
subImg: [ "", "" ], shortDesc: "no-data",
description: "no-data", slug: "no-data" }]; };
const pageCount = Math.ceil(filteredData.length / productsPerPage); // If page number 0, set current page = 0 if (pageCount === 0) { setCurrentPage(0); };
const currentProducts = filteredData.slice(offset, offset + productsPerPage);
const handlePageChange = (selected: number) => { setCurrentPage(selected); };
return (
type='style-default' /> ))} </div> {pageCount> 1 && ( <div className="list-pagination w-full flex items-center justify-center md:mt-10 mt-6"> <HandlePagination pageCount={pageCount} onPageChange={handlePageChange} /> </div> )} </div> <div className="right xl:w-1/4 md:w-1/3 xl:pl-[52px] md:pl-8"> <form className='form-search relative w-full h-12'> <input className='py-2 px-4 w-full h-full border border-line rounded-lg' type="text" placeholder='Search' /> <button> <Icon.PiMagnifyingGlass className='heading6 text-secondary hover:text-gray-900 duration-300 absolute top-1/2 -translate-y-1/2 right-4 cursor-pointer' /> </button> </form> <div className="recent md:mt-10 mt-6 pb-8 border-b border-line"> <div className="heading6">Recent Posts</div> <div className="list-recent pt-1"> {blogData.slice(12, 15).map(item => ( <div className="item flex gap-4 mt-5 cursor-pointer" key={item.id} onClick={() => handleBlogClick(item.id)}> <Image src={item.thumbImg} width={500} height={400} alt={item.thumbImg}
};

export default BlogDefault
'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import Breadcrumb from '@/components/Breadcrumb/Breadcrumb';
import blogData from '@/data/Blog.json';
import BlogItem from '@/components/Blog/BlogItem';
import HandlePagination from '@/components/Other/HandlePagination'
import { useRouter } from 'next/navigation';
const BlogGrid = () => {;
const [currentPage, setCurrentPage] = useState(0); const productsPerPage = 9; const offset = currentPage * productsPerPage; const router = useRouter();
const handleBlogClick = (blogId: string) => { // Go to blog detail with blogId selected router.push(`/blog/detail1?id=${blogId}`); };
let filteredData = blogData.filter(blog => {;
let isCategoryMatched = true isCategoryMatched = blog.category !== 'underwear' return isCategoryMatched });
if (filteredData.length === 0) { filteredData = [{ id: "no-data",
category: "no-data", tag: "no-data",
title: "no-data", date: "no-data",
author: "no-data", avatar: "no-data",
thumbImg: "", coverImg: "",
subImg: [ "", "" ], shortDesc: "no-data",
description: "no-data", slug: "no-data" }]; };
const pageCount = Math.ceil(filteredData.length / productsPerPage); // If page number 0, set current page = 0 if (pageCount === 0) { setCurrentPage(0); };
const currentProducts = filteredData.slice(offset, offset + productsPerPage); const handlePageChange = (selected: number) => { setCurrentPage(selected); };
return (
};

export default BlogGrid
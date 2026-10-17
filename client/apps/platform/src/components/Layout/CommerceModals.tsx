'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';
import { useModalSearchUIContext } from '@/context/ModalSearchUIContext';
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import { useModalCompareContext } from '@/context/ModalCompareContext';

const loading = () => <div className="fixed inset-0 z-[100] grid place-items-center bg-black/30" role="status" aria-label="Opening dialog"><span className="rounded-xl bg-white px-5 py-3 text-gray-900">Loading…</span></div>;
const Cart = dynamic(() => import('@/components/Modal/ModalCart'), { ssr: false, loading });
const Wishlist = dynamic(() => import('@/components/Modal/ModalWishlist'), { ssr: false, loading });
const Search = dynamic(() => import('@/components/Modal/ModalSearch'), { ssr: false, loading });
const Quickview = dynamic(() => import('@/components/Modal/ModalQuickview'), { ssr: false, loading });
const Compare = dynamic(() => import('@/components/Modal/ModalCompare'), { ssr: false, loading });

/** Keep a visited dialog mounted for its closing animation and local state. */
function OnFirstOpen({ open, children }: { open: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(open);
  useEffect(() => { if (open) setVisited(true); }, [open]);
  return open || visited ? children : null;
}

export default function CommerceModals() {
  const cart = useModalCartContext();
  const wishlist = useModalWishlistContext();
  const search = useModalSearchUIContext();
  const quickview = useModalQuickviewContext();
  const compare = useModalCompareContext();
  return <>
    <OnFirstOpen open={cart.isModalOpen}><Cart /></OnFirstOpen>
    <OnFirstOpen open={wishlist.isModalOpen}><Wishlist /></OnFirstOpen>
    <OnFirstOpen open={search.isModalOpen}><Search /></OnFirstOpen>
    <OnFirstOpen open={quickview.isOpen}><Quickview /></OnFirstOpen>
    <OnFirstOpen open={compare.isModalOpen}><Compare /></OnFirstOpen>
  </>;
}

'use client';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
const ShoppingChat = dynamic(() => import('./ChatbotWidget'), { ssr: false });
export default function CustomerChatbot() {
  const pathname = usePathname();
  if (pathname?.startsWith('/my-account/chat') || pathname === '/occasions' || pathname?.startsWith('/occasions/')) return null;
  return <ShoppingChat />;
}

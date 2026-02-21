// @ts-nocheck
'use client';

import Logo from '@core/components/logo';
import cn from '@core/utils/class-names';
import Link from 'next/link';
import { SidebarMenu } from './sidebar-menu';
import { PiXBold } from 'react-icons/pi';

interface SidebarProps {
  className?: string;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ className, isExpanded, onToggle }: SidebarProps) {
  return (
    <aside
      className={cn(
        'fixed bottom-0 start-0 z-50 h-full w-[270px] border-e-2 border-gray-100 bg-white dark:bg-gray-100/50 2xl:w-72 transition-transform duration-300',
        !isExpanded && 'xl:-translate-x-full',
        className
      )}
    >
      <div className="sticky top-0 z-40 flex items-center justify-between bg-gray-0/10 px-6 pb-5 pt-5 dark:bg-gray-100/5 2xl:px-8 2xl:pt-6">
        <Link
          href={'/'}
          aria-label="Site Logo"
          className="text-gray-800 hover:text-gray-900"
        >
          <Logo className="max-w-[155px]" />
        </Link>
        
        {onToggle && (
          <button
            onClick={onToggle}
            className="hidden xl:flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Close sidebar"
          >
            <PiXBold className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="custom-scrollbar h-[calc(100%-80px)] overflow-y-auto">
        <SidebarMenu />
      </div>
    </aside>
  );
}

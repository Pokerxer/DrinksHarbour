import React from 'react';
import Image from 'next/image';

interface BrowserFrameProps {
  screenshot: string;
  alt: string;
  className?: string;
}

export function BrowserFrame({ screenshot, alt, className = '' }: BrowserFrameProps) {
  return (
    <div className={`relative rounded-xl shadow-2xl border border-gray-200 overflow-hidden bg-white ${className}`}>
      {/* Browser chrome bar */}
      <div className="bg-gray-100 border-b border-gray-200 h-8 flex items-center gap-2 px-3">
        {/* Traffic-light dots */}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="w-3 h-3 rounded-full bg-amber-400" />
          <span className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        {/* Fake URL bar */}
        <div className="flex-1 flex justify-center">
          <div className="bg-white/70 rounded-md px-3 py-0.5 text-[10px] text-gray-400 font-mono border border-gray-200/60">
            drinksharbour.com/erm
          </div>
        </div>
      </div>
      {/* Screenshot image */}
      <div className="relative w-full bg-gray-50">
        <Image
          src={screenshot}
          alt={alt}
          width={1280}
          height={720}
          className="w-full h-auto object-cover object-top"
          priority={false}
        />
      </div>
    </div>
  );
}

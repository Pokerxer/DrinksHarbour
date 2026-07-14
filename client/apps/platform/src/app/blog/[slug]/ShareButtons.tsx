'use client';

import { useState } from 'react';
import * as Icon from 'react-icons/pi';

function shareUrl(platform: string): string {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const title = typeof document !== 'undefined' ? document.title : '';
  switch (platform) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(title + '\n' + url)}`;
    case 'twitter':
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    default:
      return url;
  }
}

const buttons = [
  { icon: Icon.PiWhatsappLogo, label: 'WhatsApp', platform: 'whatsapp', color: 'hover:bg-green-50 hover:text-green-700 hover:border-green-200' },
  { icon: Icon.PiTwitterLogo, label: 'Twitter', platform: 'twitter', color: 'hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200' },
  { icon: Icon.PiFacebookLogo, label: 'Facebook', platform: 'facebook', color: 'hover:bg-blue-50 hover:text-blue-800 hover:border-blue-200' },
  { icon: Icon.PiLink, label: 'Copy link', platform: null, color: 'hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300' },
];

// Inline toast — no dependency on a toast lib.
function useInlineToast() {
  const [msg, setMsg] = useState<string>('');
  const show = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(''), 2200);
  };
  return { msg, show };
}

export default function ShareButtons() {
  const { msg, show } = useInlineToast();
  const [copied, setCopied] = useState(false);

  const handleClick = (platform: string | null) => {
    if (platform) {
      window.open(shareUrl(platform), '_blank', 'noopener,noreferrer');
    } else {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      show('Link copied to clipboard');
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-6 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="font-bold text-gray-900 text-sm">Enjoyed this article?</p>
        <p className="text-xs text-gray-400 mt-0.5">Share it with your friends</p>
      </div>
      <div className="flex items-center gap-2">
        {buttons.map(({ icon: Ic, label, platform, color }) => (
          <button
            key={label}
            aria-label={label}
            title={label}
            className={`w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 transition-all duration-200 hover:scale-110 active:scale-95 ${color} ${platform === null && copied ? 'bg-gray-100 text-gray-700 border-gray-300' : ''}`}
            onClick={() => handleClick(platform)}
          >
            <Ic size={18} />
          </button>
        ))}
      </div>

      {msg ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute -top-10 right-4 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          {msg}
        </div>
      ) : null}
    </div>
  );
}

// Vertical sticky rail for desktop, shown alongside the article.
export function ShareRail() {
  const { msg, show } = useInlineToast();
  const [copied, setCopied] = useState(false);

  const handleClick = (platform: string | null) => {
    if (platform) {
      window.open(shareUrl(platform), '_blank', 'noopener,noreferrer');
    } else {
      navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
      show('Copied');
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  const railButtons = [
    { icon: Icon.PiWhatsappLogo, label: 'WhatsApp', platform: 'whatsapp', color: 'hover:bg-green-50 hover:text-green-700 hover:border-green-200' },
    { icon: Icon.PiTwitterLogo, label: 'Twitter', platform: 'twitter', color: 'hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200' },
    { icon: Icon.PiFacebookLogo, label: 'Facebook', platform: 'facebook', color: 'hover:bg-blue-50 hover:text-blue-800 hover:border-blue-200' },
    { icon: Icon.PiLink, label: 'Copy link', platform: null, color: 'hover:bg-gray-100 hover:text-gray-700 hover:border-gray-300' },
  ];

  return (
    <div className="relative sticky top-24 hidden flex-col gap-2 lg:flex">
      {railButtons.map(({ icon: Ic, label, platform, color }) => (
        <button
          key={label}
          aria-label={label}
          title={label}
          className={`flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-all duration-200 hover:scale-110 ${color} ${platform === null && copied ? 'bg-gray-100 text-gray-700 border-gray-300' : ''}`}
          onClick={() => handleClick(platform)}
        >
          <Ic size={16} />
        </button>
      ))}

      {msg ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none absolute left-12 top-0 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          {msg}
        </div>
      ) : null}
    </div>
  );
}
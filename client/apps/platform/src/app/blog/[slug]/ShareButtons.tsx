'use client';

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
  { icon: Icon.PiWhatsappLogo,  label: 'WhatsApp', platform: 'whatsapp', color: 'hover:bg-green-50 hover:text-green-700' },
  { icon: Icon.PiTwitterLogo,   label: 'Twitter',  platform: 'twitter',  color: 'hover:bg-blue-50 hover:text-blue-700' },
  { icon: Icon.PiFacebookLogo,  label: 'Facebook', platform: 'facebook', color: 'hover:bg-blue-50 hover:text-blue-800' },
  { icon: Icon.PiLink,          label: 'Copy link', platform: null,       color: 'hover:bg-gray-100 hover:text-gray-700' },
];

export default function ShareButtons() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-6 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="font-bold text-gray-900 text-sm">Enjoyed this article?</p>
        <p className="text-xs text-gray-400 mt-0.5">Share it with your friends</p>
      </div>
      <div className="flex items-center gap-2">
        {buttons.map(({ icon: Ic, label, platform, color }) => (
          <button
            key={label}
            aria-label={label}
            className={`w-12 h-12 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 transition-all duration-200 hover:scale-110 active:scale-95 ${color}`}
            onClick={() => {
              if (platform) {
                window.open(shareUrl(platform), '_blank', 'noopener,noreferrer');
              } else {
                navigator.clipboard?.writeText(window.location.href);
              }
            }}
          >
            <Ic size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

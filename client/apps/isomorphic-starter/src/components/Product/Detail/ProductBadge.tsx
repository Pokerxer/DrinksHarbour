'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';

interface ProductBadgeProps {
  badge: {
    name: string;
    color: string;
    type?: string;
  };
  className?: string;
}

const ProductBadge: React.FC<ProductBadgeProps> = React.memo(({ badge, className = '' }) => {
  if (!badge || !badge.name) {
    return null;
  }

  const getIcon = () => {
    switch (badge.type) {
      case 'new': 
        return <Icon.PiSparkleFill size={14} />;
      case 'sale': 
        return <Icon.PiTagFill size={14} />;
      case 'bestseller': 
        return <Icon.PiTrophyFill size={14} />;
      case 'limited': 
        return <Icon.PiTimerFill size={14} />;
      default: 
        return <Icon.PiStarFill size={14} />;
    }
  };

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg ${className}`}
      style={{ backgroundColor: badge.color || '#10B981' }}
    >
      {getIcon()}
      {badge.name.toUpperCase()}
    </div>
  );
});

ProductBadge.displayName = 'ProductBadge';

export default ProductBadge;

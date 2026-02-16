import React from 'react';

interface ShippingItem {
  icon: string;
  title: string;
  description: string;
}

interface ShippingSupportProps {
  items?: ShippingItem[];
};
const defaultItems: ShippingItem[] = [
  {
    icon: 'icon-delivery-truck',
    title: 'Free shipping',
    description: 'Free shipping on orders over $75.',
  },
  {
    icon: 'icon-phone-call',
    title: 'Support everyday',
    description: 'Support from 8:30 AM to 10:00 PM everyday',
  },
  {
    icon: 'icon-return',
    title: '100 Day Returns',
    description: 'Not impressed? Get a refund. You have 100 days to break our hearts.',
  },
];

const ShippingSupport: React.FC<ShippingSupportProps> = ({ items = defaultItems }) => {
return (
<div className="get-it mt-6">
      <div className="heading5">Get it today</div>
      {items.map((item, index) => (
        <div key={index} className="item flex items-center gap-3 mt-4">
          <div className={`${item.icon} text-4xl`} />
          <div>
            <div className="text-title">{item.title}</div>
            <div className="caption1 text-secondary mt-1">{item.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ShippingSupport;

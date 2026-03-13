'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface FooterBannerProps {
  placement?: string;
  layout?: 'newsletter' | 'social' | 'links' | 'promo' | 'compact';
  showNewsletter?: boolean;
  showSocial?: boolean;
  showLinks?: boolean;
  showPayment?: boolean;
}

interface BannerData {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: string;
  placement: string;
  ctaText?: string;
  ctaLink?: string;
  backgroundColor?: string;
  textColor?: string;
  image?: {
    url: string;
    alt?: string;
  };
  tags?: string[];
}

const defaultFooterBanners: BannerData[] = [
  {
    _id: 'footer-1',
    title: 'Join Our VIP Club',
    subtitle: 'Exclusive Deals & Early Access',
    description: 'Get 10% off your first order when you sign up for our newsletter.',
    type: 'announcement',
    placement: 'footer',
    ctaText: 'Sign Up Now',
    ctaLink: '/vip-signup',
    backgroundColor: '#1A1A2E',
    tags: ['newsletter', 'vip', 'discount']
  }
];

const FooterBanner: React.FC<FooterBannerProps> = ({
  placement = 'footer',
  layout = 'newsletter',
  showNewsletter = true,
  showSocial = true,
  showLinks = true,
  showPayment = true
}) => {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const fetchBanner = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5001/api/banners/placement/${placement}?limit=1`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.length > 0) {
            setBanner(data.data[0]);
          }
        }
      } catch (err) {
        console.log('Using default footer banner');
      } finally {
        setLoading(false);
      }
    };

    fetchBanner();
  }, [placement]);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setTimeout(() => {
        setSubscribed(false);
        setEmail('');
      }, 3000);
    }
  };

  const socialLinks = [
    { name: 'Facebook', icon: 'facebook', url: 'https://facebook.com', color: '#1877F2' },
    { name: 'Instagram', icon: 'instagram', url: 'https://instagram.com', color: '#E4405F' },
    { name: 'Twitter', icon: 'twitter', url: 'https://twitter.com', color: '#1DA1F2' },
    { name: 'YouTube', icon: 'youtube', url: 'https://youtube.com', color: '#FF0000' }
  ];

  const footerLinks = {
    shop: [
      { name: 'All Products', href: '/shop' },
      { name: 'Whiskey', href: '/shop?category=whiskey' },
      { name: 'Wine', href: '/shop?category=wine' },
      { name: 'Beer', href: '/shop?category=beer' },
      { name: 'Spirits', href: '/shop?category=spirits' }
    ],
    support: [
      { name: 'Contact Us', href: '/pages/contact' },
      { name: 'FAQs', href: '/pages/faqs' },
      { name: 'Shipping Info', href: '/shipping-info' },
      { name: 'Returns', href: '/returns' },
      { name: 'Track Order', href: '/order-tracking' }
    ],
    company: [
      { name: 'About Us', href: '/pages/about' },
      { name: 'Careers', href: '/careers' },
      { name: 'Press', href: '/press' },
      { name: 'Blog', href: '/blog' },
      { name: 'Sustainability', href: '/sustainability' }
    ],
    legal: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Terms of Service', href: '/terms' },
      { name: 'Cookie Policy', href: '/cookies' },
      { name: 'Responsible Drinking', href: '/responsible-drinking' },
      { name: 'Age Policy', href: '/age-policy' }
    ]
  };

  const paymentMethods = [
    { name: 'Visa', icon: 'visa' },
    { name: 'Mastercard', icon: 'mastercard' },
    { name: 'PayPal', icon: 'paypal' },
    { name: 'Verve', icon: 'verve' },
    { name: 'Bank Transfer', icon: 'bank' }
  ];

  const bgColor = banner?.backgroundColor || '#1A1A2E';
  const textColor = banner?.textColor || '#FFFFFF';

  // Compact Layout
  if (layout === 'compact') {
    return (
      <section className="footer-banner-compact py-6" style={{ backgroundColor: bgColor }}>
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-white font-bold text-lg">{banner?.title || 'DrinksHarbour'}</h3>
              <p className="text-white/70 text-sm">{banner?.subtitle || 'Premium beverages delivered to your door'}</p>
            </div>
            {showSocial && (
              <div className="flex items-center gap-4">
                {socialLinks.slice(0, 4).map((social) => (
                  <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ backgroundColor: `${social.color}20` }}>
                    <span className="text-white font-bold text-sm">{social.name[0]}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Newsletter Layout
  if (layout === 'newsletter') {
    return (
      <section className="footer-banner-newsletter py-12 md:py-16" style={{ backgroundColor: bgColor }}>
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3">
                {banner?.title || 'Join Our VIP Club'}
              </h2>
              <p className="text-white/70 text-lg mb-6 max-w-2xl mx-auto">
                {banner?.description || 'Get exclusive deals, early access to new products, and 10% off your first order.'}
              </p>

              {!subscribed ? (
                <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-5 py-3 rounded-full bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-white/40 transition-colors"
                    required
                  />
                  <button type="submit" className="px-8 py-3 rounded-full font-semibold transition-all duration-300 hover:opacity-90" style={{ backgroundColor: '#FFFFFF', color: bgColor }}>
                    Subscribe
                  </button>
                </form>
              ) : (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-lg bg-green-500/20 border border-green-500/30">
                  <p className="text-green-400 font-semibold">✓ Thank you for subscribing! Check your email for your 10% discount code.</p>
                </motion.div>
              )}

              <p className="text-white/50 text-sm mt-4">
                By subscribing, you agree to our Privacy Policy and confirm you are 18+ years old.
              </p>
            </motion.div>
          </div>
        </div>
      </section>
    );
  }

  // Promo Layout
  if (layout === 'promo') {
    return (
      <section className="footer-banner-promo py-8" style={{ backgroundColor: bgColor }}>
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🚚', title: 'Free Delivery', desc: 'Orders over ₦50,000' },
              { icon: '💯', title: 'Quality Guaranteed', desc: '100% authentic products' },
              { icon: '🔒', title: 'Secure Payment', desc: 'SSL encrypted checkout' },
              { icon: '⭐', title: '24/7 Support', desc: 'Dedicated customer service' }
            ].map((feature, index) => (
              <motion.div key={index} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="flex items-start gap-4">
                <span className="text-3xl">{feature.icon}</span>
                <div>
                  <h4 className="text-white font-semibold">{feature.title}</h4>
                  <p className="text-white/60 text-sm">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Links Layout
  if (layout === 'links') {
    return (
      <section className="footer-banner-links py-12" style={{ backgroundColor: bgColor }}>
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {/* Shop Links */}
            <div>
              <h4 className="text-white font-bold mb-4">Shop</h4>
              <ul className="space-y-2">
                {footerLinks.shop.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-white/70 hover:text-white transition-colors text-sm">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support Links */}
            <div>
              <h4 className="text-white font-bold mb-4">Support</h4>
              <ul className="space-y-2">
                {footerLinks.support.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-white/70 hover:text-white transition-colors text-sm">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Links */}
            <div>
              <h4 className="text-white font-bold mb-4">Company</h4>
              <ul className="space-y-2">
                {footerLinks.company.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-white/70 hover:text-white transition-colors text-sm">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal Links */}
            <div>
              <h4 className="text-white font-bold mb-4">Legal</h4>
              <ul className="space-y-2">
                {footerLinks.legal.map((link) => (
                  <li key={link.name}>
                    <Link href={link.href} className="text-white/70 hover:text-white transition-colors text-sm">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact & Social */}
            <div>
              <h4 className="text-white font-bold mb-4">Connect</h4>
              <p className="text-white/70 text-sm mb-4">
                Contact us: <br />
                <a href="mailto:info@drinksharbour.com" className="text-white hover:underline">info@drinksharbour.com</a>
              </p>
              <p className="text-white/70 text-sm mb-4">
                Phone: <br />
                <a href="tel:+2341234567890" className="text-white hover:underline">+234 123 456 7890</a>
              </p>
              {showSocial && (
                <div className="flex gap-2">
                  {socialLinks.map((social) => (
                    <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity text-white text-xs font-bold" style={{ backgroundColor: social.color }}>
                      {social.name[0]}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default Social Layout
  return (
    <section className="footer-banner-social py-8" style={{ backgroundColor: bgColor }}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Copyright */}
          <div className="text-center md:text-left">
            <h3 className="text-white font-bold text-xl mb-1">DrinksHarbour</h3>
            <p className="text-white/60 text-sm">© 2024 All rights reserved. Drink responsibly.</p>
          </div>

          {/* Payment Methods */}
          {showPayment && (
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-xs">We accept:</span>
              {paymentMethods.map((payment) => (
                <div key={payment.name} className="w-10 h-6 rounded bg-white/10 flex items-center justify-center">
                  <span className="text-white/80 text-xs font-bold">{payment.name[0]}</span>
                </div>
              ))}
            </div>
          )}

          {/* Social Links */}
          {showSocial && (
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a key={social.name} href={social.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity" style={{ backgroundColor: `${social.color}30` }}>
                  <span className="text-white font-bold text-sm">{social.name[0]}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Age Verification Notice */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-center gap-2 text-center">
            <span className="text-white/50 text-sm">🔞</span>
            <p className="text-white/50 text-sm">
              You must be 18+ to purchase from DrinksHarbour. Please drink responsibly.
            </p>
            <Link href="/responsible-drinking" className="text-white/70 hover:text-white text-sm underline">Learn More</Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FooterBanner;

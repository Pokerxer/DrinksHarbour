// @ts-nocheck
'use client';

import cn from '@core/utils/class-names';
import { Link } from 'react-scroll';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export const formParts = {
  identification: 'identification',
  beverageInfo: 'beverage-info',
  origin: 'origin',
  description: 'description',
  dietary: 'dietary',
  certifications: 'certifications',
  awards: 'awards',
  ratings: 'ratings',
  media: 'media',
  pricing: 'pricing',
  seo: 'seo',
  externalLinks: 'external-links',
};

export const menuItems = [
  {
    label: 'Identification',
    value: formParts.identification,
    icon: '🏷️',
    description: 'Basic product info',
  },
  {
    label: 'Beverage Info',
    value: formParts.beverageInfo,
    icon: '🍺',
    description: 'Type, ABV, volume',
  },
  {
    label: 'Origin',
    value: formParts.origin,
    icon: '🌍',
    description: 'Country, region, producer',
  },
  {
    label: 'Description',
    value: formParts.description,
    icon: '📝',
    description: 'Details & tasting notes',
  },
  {
    label: 'Dietary',
    value: formParts.dietary,
    icon: '🥗',
    description: 'Allergens & nutrition',
  },
  {
    label: 'Certifications',
    value: formParts.certifications,
    icon: '📜',
    description: 'Quality certifications',
  },
  {
    label: 'Awards',
    value: formParts.awards,
    icon: '🏆',
    description: 'Awards & recognitions',
  },
  {
    label: 'Ratings',
    value: formParts.ratings,
    icon: '⭐',
    description: 'Expert ratings',
  },
  {
    label: 'Media',
    value: formParts.media,
    icon: '📸',
    description: 'Images & videos',
  },
  {
    label: 'Pricing',
    value: formParts.pricing,
    icon: '💰',
    description: 'Prices & inventory',
  },
  {
    label: 'SEO',
    value: formParts.seo,
    icon: '🔍',
    description: 'Search optimization',
  },
  {
    label: 'External Links',
    value: formParts.externalLinks,
    icon: '🔗',
    description: 'Producer & reviews',
  },
];

interface FormNavProps {
  className?: string;
}

export default function FormNav({ className }: FormNavProps) {
  const [activeSection, setActiveSection] = useState<string>('');
  const [completedSections, setCompletedSections] = useState<string[]>([]);

  useEffect(() => {
    const handleScroll = () => {
      const sections = Object.values(formParts);
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top >= 100 && rect.top <= 400) {
            setActiveSection(section);
            setCompletedSections(prev => 
              prev.includes(section) ? prev : [...prev, section]
            );
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'sticky top-[68px] z-20 border-b border-gray-200 bg-white/95 py-0 font-medium text-gray-500 backdrop-blur-sm @2xl:top-[72px] 2xl:top-20',
        className
      )}
    >
      <div className="custom-scrollbar overflow-x-auto scroll-smooth">
        <div className="inline-flex items-center gap-1 px-4 py-2 md:gap-2">
          {menuItems.map((tab, idx) => {
            const isActive = activeSection === tab.value;
            const isCompleted = completedSections.includes(tab.value) && !isActive;
            
            return (
              <Link
                key={tab.value}
                to={tab.value}
                spy={true}
                hashSpy={true}
                smooth={true}
                offset={-200}
                duration={500}
                className="relative cursor-pointer"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 transition-all duration-200',
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm'
                      : isCompleted
                      ? 'bg-green-50 text-green-700'
                      : 'hover:bg-gray-50 hover:text-gray-700'
                  )}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <div className="hidden sm:block">
                    <div className="text-sm font-semibold">{tab.label}</div>
                    <div className="text-xs text-gray-400">{tab.description}</div>
                  </div>
                  
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-blue-600"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  
                  {/* Completed checkmark */}
                  {isCompleted && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white"
                    >
                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </motion.div>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

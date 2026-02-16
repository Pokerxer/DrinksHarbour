import React from 'react';
import Link from 'next/link';
import * as Icon from "react-icons/pi";
import { FilterState } from '@/types/filter.types';

interface BreadcrumbSectionProps {
  dataType: string | null;
  filters: FilterState;
  updateFilter: (key: keyof FilterState, value: any) => void;
  categoryTypes: string[];
}

const BreadcrumbSection: React.FC<BreadcrumbSectionProps> = ({ 
  dataType, 
  filters, 
  updateFilter, 
  categoryTypes 
}) => {
  const displayTitle = dataType?.replace(/_/g, ' ') || 'Shop';

  const handleTabClick = (item: string) => {
    updateFilter('type', filters.type === item ? null : item);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, item: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabClick(item);
    }
  };

  return (
    <div className="breadcrumb-block style-img">
      <div className="breadcrumb-main bg-linear overflow-hidden">
        <div className="container lg:pt-[134px] pt-24 pb-10 relative">
          <div className="main-content w-full h-full flex flex-col items-center justify-center relative z-[1]">
            {/* Title Section */}
            <div className="text-content">
              <h1 className="heading2 text-center capitalize">
                {displayTitle}
              </h1>
              <nav className="link flex items-center justify-center gap-1 caption1 mt-3" aria-label="Breadcrumb">
                <Link href="/" className="hover:text-gray-900 transition-colors">
                  Homepage
                </Link>
                <Icon.PiCaretRight size={14} className="text-secondary2" aria-hidden="true" />
                <span className="text-secondary2 capitalize">
                  {displayTitle}
                </span>
              </nav>
            </div>
            {/* Category Tabs */}
            {/* {categoryTypes.length > 0 && (
              <div 
                className="list-tab flex flex-wrap items-center justify-center gap-y-5 gap-8 lg:mt-[70px] mt-12 overflow-hidden" 
                role="tablist" 
                aria-label="Product categories"
              >
                {categoryTypes.map((item) => (
                  <div
                    key={item}
                    className={`tab-item text-button-uppercase cursor-pointer has-line-before line-2px transition-all hover:text-gray-900 ${filters.type === item ? 'active' : ''}`}
                    onClick={() => handleTabClick(item)}
                    onKeyDown={(e) => handleTabKeyDown(e, item)}
                    role="tab"
                    aria-selected={filters.type === item}
                    aria-label={`Filter by ${item.replace(/_/g, ' ')}`}
                    tabIndex={0}
                  >
                    {item.replace(/_/g, ' ')}
                  </div>
                ))}
              </div>
            )} */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreadcrumbSection;

import React from 'react';
import HandlePagination from '../Other/HandlePagination';

interface PaginationSectionProps {
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  /** Builds the crawlable `href` for a page control. `page` is 1-based. */
  hrefBuilder?: (page: number) => string;
}

const PaginationSection: React.FC<PaginationSectionProps> = ({
  pageCount,
  currentPage,
  onPageChange,
  hrefBuilder,
}) => {
  if (pageCount <= 1) return null;

  return (
    <nav className="list-pagination flex items-center justify-center md:mt-10 mt-7" aria-label="Product pagination">
      <HandlePagination
        pageCount={pageCount}
        onPageChange={onPageChange}
        initialPage={currentPage}
        hrefBuilder={hrefBuilder}
      />
    </nav>
  );
};

export default PaginationSection;

import React from 'react';
import HandlePagination from '../Other/HandlePagination';

interface PaginationSectionProps {
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const PaginationSection: React.FC<PaginationSectionProps> = ({ 
  pageCount, 
  currentPage, 
  onPageChange 
}) => {
  if (pageCount <= 1) return null;

  return (
    <nav className="list-pagination flex items-center justify-center md:mt-10 mt-7" aria-label="Product pagination">
      <HandlePagination pageCount={pageCount} onPageChange={onPageChange} initialPage={currentPage} />
    </nav>
  );
};

export default PaginationSection;

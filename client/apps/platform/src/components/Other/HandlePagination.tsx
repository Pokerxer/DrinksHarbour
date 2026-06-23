'use client';

import React from 'react';
import ReactPaginate from 'react-paginate';

interface Props {
  pageCount: number;
  onPageChange: (selected: number) => void;
  initialPage?: number;
}

const HandlePagination: React.FC<Props> = ({ 
  pageCount, 
  onPageChange, 
  initialPage = 0 
}) => {
  return (
    <ReactPaginate
      previousLabel="<"
      nextLabel=">"
      pageCount={pageCount}
      pageRangeDisplayed={3}
      marginPagesDisplayed={2}
      onPageChange={(selectedItem) => onPageChange(selectedItem.selected)}
      containerClassName={'pagination'}
      activeClassName={'active'}
      forcePage={initialPage}
    />
  );
};

export default HandlePagination;

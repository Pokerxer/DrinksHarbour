'use client';

import React from 'react';
import ReactPaginate from 'react-paginate';

interface Props {
  pageCount: number;
  onPageChange: (selected: number) => void;
  initialPage?: number;
  /**
   * Builds the `href` for a page control. `page` is 1-based.
   *
   * Without this the controls render as `<a role="button">` with no `href`,
   * which a crawler cannot follow — pages 2+ of a listing are then only
   * reachable by executing JavaScript. Supplying it turns them into real
   * links. react-paginate still calls `preventDefault()` on click, so
   * navigation stays client-side for users.
   *
   * Deliberately paired with react-paginate's default `hrefAllControls={false}`
   * so an `href` is emitted only for in-range pages: the disabled prev/next
   * arrows at the series boundaries stay href-less instead of pointing at
   * page 0 or page N+1.
   */
  hrefBuilder?: (page: number) => string;
}

const HandlePagination: React.FC<Props> = ({
  pageCount,
  onPageChange,
  initialPage = 0,
  hrefBuilder,
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
      {...(hrefBuilder ? { hrefBuilder: (page: number) => hrefBuilder(page) } : {})}
    />
  );
};

export default HandlePagination;

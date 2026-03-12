'use client';

import { Text, Button } from 'rizzui';
import { PiCaretLeft, PiCaretRight } from 'react-icons/pi';

interface HistoryPaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function HistoryPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: HistoryPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Calculate visible page numbers
  const getVisiblePages = () => {
    const pages: number[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else if (currentPage <= 3) {
      for (let i = 1; i <= maxVisible; i++) {
        pages.push(i);
      }
    } else if (currentPage >= totalPages - 2) {
      for (let i = totalPages - maxVisible + 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      for (let i = currentPage - 2; i <= currentPage + 2; i++) {
        pages.push(i);
      }
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
      <Text className="text-sm text-gray-500">
        Showing {startItem} to {endItem} of {totalItems} entries
      </Text>
      <div className="flex items-center gap-2">
        {/* First Page */}
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
        >
          <PiCaretLeft className="h-4 w-4" />
          <PiCaretLeft className="h-4 w-4 -ml-2" />
        </Button>

        {/* Previous Page */}
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        >
          <PiCaretLeft className="h-4 w-4" />
        </Button>

        {/* Page Numbers */}
        {getVisiblePages().map((pageNum) => (
          <Button
            key={pageNum}
            variant={currentPage === pageNum ? 'solid' : 'outline'}
            size="sm"
            onClick={() => onPageChange(pageNum)}
            className="w-8"
          >
            {pageNum}
          </Button>
        ))}

        {/* Next Page */}
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        >
          <PiCaretRight className="h-4 w-4" />
        </Button>

        {/* Last Page */}
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          <PiCaretRight className="h-4 w-4" />
          <PiCaretRight className="h-4 w-4 -ml-2" />
        </Button>
      </div>
    </div>
  );
}

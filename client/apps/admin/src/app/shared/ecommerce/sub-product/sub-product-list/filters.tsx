// @ts-nocheck
'use client';

import { type Table as ReactTableType } from '@tanstack/react-table';
import { Button, Flex } from 'rizzui';
import { PiTrash } from 'react-icons/pi';
import { motion } from 'framer-motion';

interface TableToolbarProps<T extends Record<string, any>> {
  table: ReactTableType<T>;
}

export default function Filters<TData extends Record<string, any>>({
  table,
}: TableToolbarProps<TData>) {
  const {
    options: { meta },
  } = table;

  const selectedRows = table.getSelectedRowModel().rows;
  const isMultipleSelected = selectedRows.length > 1;

  if (!isMultipleSelected) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-3 border-b border-gray-100 bg-gray-50"
    >
      <Flex align="center" justify="between">
        <span className="text-sm text-gray-600">
          {selectedRows.length} items selected
        </span>
        
        <Button
          color="danger"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() =>
            meta?.handleMultipleDelete &&
            meta.handleMultipleDelete(
              selectedRows.map((r) => r.original)
            )
          }
        >
          <PiTrash size={16} />
          Delete Selected
        </Button>
      </Flex>
    </motion.div>
  );
}

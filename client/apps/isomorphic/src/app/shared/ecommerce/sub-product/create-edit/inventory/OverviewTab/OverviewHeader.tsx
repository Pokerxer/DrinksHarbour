'use client';

import { Text, Button } from 'rizzui';
import { motion } from 'framer-motion';
import { PiArrowsLeftRight, PiStack, PiDownload } from 'react-icons/pi';
import { fieldStaggerVariants } from '../../animations';

interface OverviewHeaderProps {
  onTransferClick: () => void;
  onBatchClick: () => void;
  onExportJSON: () => void;
  onExportCSV: () => void;
}

export function OverviewHeader({
  onTransferClick,
  onBatchClick,
  onExportJSON,
  onExportCSV,
}: OverviewHeaderProps) {
  return (
    <motion.div variants={fieldStaggerVariants} custom={0}>
      <div className="flex items-center justify-between">
        <div>
          <Text className="mb-1 text-lg font-semibold">Stock Management</Text>
          <Text className="text-sm text-gray-500">Add, remove, or adjust stock levels</Text>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onTransferClick}>
            <PiArrowsLeftRight className="mr-1 h-4 w-4" /> Transfer
          </Button>
          <Button variant="outline" size="sm" onClick={onBatchClick}>
            <PiStack className="mr-1 h-4 w-4" /> Batch
          </Button>
          <div className="relative group">
            <Button variant="outline" size="sm">
              <PiDownload className="mr-1 h-4 w-4" /> Export
            </Button>
            <div className="absolute right-0 mt-1 w-40 rounded-lg border border-gray-200 bg-white shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={onExportJSON}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-t-lg"
              >
                Export JSON
              </button>
              <button
                onClick={onExportCSV}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 rounded-b-lg"
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

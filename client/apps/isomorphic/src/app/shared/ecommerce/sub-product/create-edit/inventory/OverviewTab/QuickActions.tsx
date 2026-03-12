'use client';

import { Text, Button } from 'rizzui';
import { motion } from 'framer-motion';
import { PiCube, PiArrowCounterClockwise, PiTrash } from 'react-icons/pi';
import { fieldStaggerVariants } from '../../animations';

interface QuickActionsProps {
  onAddStock: (amount: number) => void;
  onSetOutOfStock: () => void;
  onSetPreOrder: () => void;
  onDiscontinue: () => void;
}

const QUICK_ADD_AMOUNTS = [10, 50, 100, 500];

export function QuickActions({
  onAddStock,
  onSetOutOfStock,
  onSetPreOrder,
  onDiscontinue,
}: QuickActionsProps) {
  return (
    <motion.div variants={fieldStaggerVariants}>
      <Text className="mb-3 text-sm font-medium text-gray-700">Quick Actions</Text>
      <div className="flex flex-wrap gap-2">
        {/* Quick Add Buttons */}
        {QUICK_ADD_AMOUNTS.map((amt) => (
          <Button
            key={amt}
            variant="outline"
            size="sm"
            onClick={() => onAddStock(amt)}
            className="border-green-300 text-green-700 hover:bg-green-50"
          >
            +{amt}
          </Button>
        ))}

        {/* Separator */}
        <div className="h-6 w-px bg-gray-300" />

        {/* Status Actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSetOutOfStock}
          className="border-red-300 text-red-700 hover:bg-red-50"
        >
          <PiCube className="mr-1 h-4 w-4" /> Out of Stock
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSetPreOrder}
          className="border-blue-300 text-blue-700 hover:bg-blue-50"
        >
          <PiArrowCounterClockwise className="mr-1 h-4 w-4" /> Pre-Order
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDiscontinue}
          className="border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          <PiTrash className="mr-1 h-4 w-4" /> Discontinue
        </Button>
      </div>
    </motion.div>
  );
}

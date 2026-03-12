'use client';

import { Text } from 'rizzui';
import { motion } from 'framer-motion';
import { PiPlus, PiMinus, PiArrowsLeftRight } from 'react-icons/pi';
import type { InventoryMovement } from '@/services/inventory.service';

interface ServerMovementsListProps {
  movements: InventoryMovement[];
}

export function ServerMovementsList({ movements }: ServerMovementsListProps) {
  if (movements.length === 0) {
    return null;
  }

  return (
    <motion.div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Text className="font-semibold mb-3">Recent Movements</Text>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {movements.slice(0, 10).map((movement) => (
          <div
            key={movement._id}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${
                  movement.category === 'in'
                    ? 'bg-green-100 text-green-600'
                    : movement.category === 'out'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                {movement.category === 'in' ? (
                  <PiPlus className="h-4 w-4" />
                ) : movement.category === 'out' ? (
                  <PiMinus className="h-4 w-4" />
                ) : (
                  <PiArrowsLeftRight className="h-4 w-4" />
                )}
              </span>
              <div>
                <Text className="text-sm font-medium capitalize">
                  {movement.type?.replace('_', ' ')}
                </Text>
                <Text className="text-xs text-gray-500">
                  {movement.reference || movement.reason || 'No reference'} -{' '}
                  {new Date(movement.createdAt).toLocaleDateString()}
                </Text>
              </div>
            </div>
            <Text
              className={`font-semibold ${
                movement.category === 'in'
                  ? 'text-green-600'
                  : movement.category === 'out'
                  ? 'text-red-600'
                  : 'text-blue-600'
              }`}
            >
              {movement.category === 'in' ? '+' : movement.category === 'out' ? '-' : '~'}
              {movement.quantity}
            </Text>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

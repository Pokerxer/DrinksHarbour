// @ts-nocheck
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Text, Flex, Badge } from 'rizzui';
import { type Table as ReactTableType } from '@tanstack/react-table';
import cn from '@core/utils/class-names';
import {
  PiTextColumnsBold,
  PiXBold,
  PiDotsSixVerticalBold,
  PiEyeBold,
  PiEyeSlashBold,
  PiArrowCounterClockwiseBold,
  PiCheckBold,
  PiListBold,
} from 'react-icons/pi';

interface ColumnToggleProps<T extends Record<string, any>> {
  table: ReactTableType<T>;
}

interface ColumnItem {
  id: string;
  header: string;
  isVisible: boolean;
}

export default function ColumnToggle<T extends Record<string, any>>({
  table,
}: ColumnToggleProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Get all togglable columns
  const columns = useMemo(() => {
    return table.getAllLeafColumns().filter(
      col => typeof col.columnDef.header === 'string' && col.columnDef.header.length > 0
    );
  }, [table]);
  
  // Initialize column order
  useEffect(() => {
    setColumnOrder(columns.map(col => col.id));
  }, [columns]);
  
  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  const visibleCount = columns.filter(col => col.getIsVisible()).length;
  const totalCount = columns.length;
  
  const handleToggleAll = (visible: boolean) => {
    columns.forEach(col => {
      col.toggleVisibility(visible);
    });
  };
  
  const handleReset = () => {
    columns.forEach(col => col.toggleVisibility(true));
    setColumnOrder(columns.map(col => col.id));
  };
  
  const orderedColumns = useMemo(() => {
    return columnOrder
      .map(id => columns.find(col => col.id === id))
      .filter(Boolean);
  }, [columnOrder, columns]);
  
  return (
    <div className="relative" ref={panelRef}>
      {/* Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all border-2',
          isOpen
            ? 'bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-500/25'
            : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50'
        )}
      >
        <PiTextColumnsBold className="w-5 h-5" />
        <span className="hidden sm:inline">Columns</span>
        <Badge 
          size="sm" 
          variant={isOpen ? 'solid' : 'flat'}
          color={isOpen ? 'info' : 'secondary'}
          className="text-[10px]"
        >
          {visibleCount}/{totalCount}
        </Badge>
      </motion.button>
      
      {/* Column Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-white border-b border-gray-100">
              <Flex align="center" gap="2">
                <PiListBold className="w-5 h-5 text-purple-500" />
                <Text className="font-bold text-gray-800">Toggle Columns</Text>
              </Flex>
              <Flex align="center" gap="2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleReset}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-500 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <PiArrowCounterClockwiseBold className="w-3.5 h-3.5" />
                  Reset
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <PiXBold className="w-4 h-4 text-gray-500" />
                </motion.button>
              </Flex>
            </div>
            
            {/* Quick Actions */}
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <Flex gap="2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleToggleAll(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-green-300 hover:bg-green-50 transition-colors"
                >
                  <PiEyeBold className="w-4 h-4 text-green-500" />
                  Show All
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleToggleAll(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-red-300 hover:bg-red-50 transition-colors"
                >
                  <PiEyeSlashBold className="w-4 h-4 text-red-500" />
                  Hide All
                </motion.button>
              </Flex>
            </div>
            
            {/* Column List */}
            <div className="max-h-80 overflow-y-auto p-2">
              <Reorder.Group
                axis="y"
                values={columnOrder}
                onReorder={setColumnOrder}
                className="space-y-1"
              >
                {orderedColumns.map((column) => {
                  if (!column) return null;
                  const isVisible = column.getIsVisible();
                  
                  return (
                    <Reorder.Item
                      key={column.id}
                      value={column.id}
                      className="list-none"
                    >
                      <motion.div
                        whileHover={{ scale: 1.01, backgroundColor: 'rgb(249, 250, 251)' }}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-grab active:cursor-grabbing transition-all',
                          isVisible ? 'bg-white' : 'bg-gray-50 opacity-60'
                        )}
                      >
                        {/* Drag Handle */}
                        <PiDotsSixVerticalBold className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        
                        {/* Column Name */}
                        <Text className={cn(
                          "flex-1 text-sm font-medium",
                          isVisible ? "text-gray-700" : "text-gray-400"
                        )}>
                          {column.columnDef.header as string}
                        </Text>
                        
                        {/* Visibility Toggle */}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => column.toggleVisibility()}
                          className={cn(
                            'p-1.5 rounded-lg transition-all',
                            isVisible 
                              ? 'bg-green-100 text-green-600 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          )}
                        >
                          {isVisible ? (
                            <PiEyeBold className="w-4 h-4" />
                          ) : (
                            <PiEyeSlashBold className="w-4 h-4" />
                          )}
                        </motion.button>
                      </motion.div>
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            </div>
            
            {/* Footer */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <Flex align="center" justify="between">
                <Text className="text-xs text-gray-500">
                  Drag to reorder • Click to toggle
                </Text>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
                >
                  <PiCheckBold className="w-4 h-4" />
                  Done
                </motion.button>
              </Flex>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

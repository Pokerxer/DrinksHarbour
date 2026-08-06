'use client';

import { Input, Textarea } from 'rizzui';
import { motion } from 'framer-motion';

interface TemplateFormHeaderProps {
  name: string;
  description: string;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  saving: boolean;
}

export default function TemplateFormHeader({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  saving,
}: TemplateFormHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28, delay: 0.05 }}
      className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-gray-500">
          Form name
        </label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Annual Performance Review, Q3 Check-in..."
          disabled={saving}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-gray-500">
          Description
        </label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Optional context — shown to HR when choosing a form for a cycle."
          disabled={saving}
          rows={3}
        />
      </div>
    </motion.div>
  );
}

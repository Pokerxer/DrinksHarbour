// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Textarea, Text, Badge, Button, Select, type SelectOption } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import FormGroup from '@/app/shared/form-group';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Trophy, Medal, Award, Star, Plus, Trash2, Calendar } from 'lucide-react';
import { medalOptions } from './form-utils';

interface ProductAwardsProps {
  className?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ProductAwards({ className }: ProductAwardsProps) {
  const { register, watch, setValue, formState: { errors } } = useFormContext<CreateProductInput>();
  const awards = watch('awards') || [];

  const addAward = () => {
    const newAward = {
      title: '',
      organization: '',
      year: undefined as number | undefined,
      medal: '' as string | undefined,
      score: undefined as number | undefined,
    };
    setValue('awards', [...awards, newAward]);
  };

  const removeAward = (index: number) => {
    const updated = awards.filter((_, i) => i !== index);
    setValue('awards', updated);
  };

  const updateAward = (index: number, field: string, value: string | number | undefined) => {
    const updated = [...awards];
    updated[index] = { ...updated[index], [field]: value };
    setValue('awards', updated);
  };

  const getMedalColor = (medal: string) => {
    switch (medal) {
      case 'platinum': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'double_gold': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'gold': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'silver': return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'bronze': return 'bg-orange-100 text-orange-700 border-orange-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <FormGroup
      title="Awards & Recognitions"
      description="Showcase awards and accolades your product has received"
      className={cn(className)}
    >
      <motion.div
        className="space-y-4"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
        }}
        initial="hidden"
        animate="visible"
      >
        {/* Existing Awards */}
        {awards.map((award: any, index: number) => (
          <motion.div
            key={index}
            variants={itemVariants}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="font-medium text-gray-900">Award #{index + 1}</span>
                {award.medal && (
                  <Badge className={getMedalColor(award.medal)}>
                    {award.medal.replace('_', ' ').toUpperCase()}
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="text"
                color="danger"
                size="sm"
                onClick={() => removeAward(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 @md:grid-cols-2 @lg:grid-cols-4">
              <div className="col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Award Title
                </label>
                <Input
                  placeholder="e.g., Best Whisky 2023"
                  value={award.title}
                  onChange={(e) => updateAward(index, 'title', e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Organization
                </label>
                <Input
                  placeholder="e.g., World Whiskies Awards"
                  value={award.organization}
                  onChange={(e) => updateAward(index, 'organization', e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Medal
                </label>
                <Select
                  placeholder="Select medal"
                  options={medalOptions.map(m => ({ value: m.value, label: m.label }))}
                  value={award.medal}
                  onChange={(option: SelectOption) => updateAward(index, 'medal', option.value as string)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 @md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  <Calendar className="mr-1 inline h-4 w-4" />
                  Year
                </label>
                <Input
                  type="number"
                  placeholder="2023"
                  value={award.year || ''}
                  onChange={(e) => updateAward(index, 'year', parseInt(e.target.value) || undefined)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  <Star className="mr-1 inline h-4 w-4" />
                  Score (optional)
                </label>
                <Input
                  type="number"
                  placeholder="95"
                  value={award.score || ''}
                  onChange={(e) => updateAward(index, 'score', parseFloat(e.target.value) || undefined)}
                />
              </div>
            </div>
          </motion.div>
        ))}

        {/* Add Button */}
        <motion.div variants={itemVariants}>
          <Button
            type="button"
            variant="outline"
            onClick={addAward}
            className="w-full border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Award
          </Button>
        </motion.div>

        {/* Tips */}
        <motion.div
          variants={itemVariants}
          className="rounded-lg bg-yellow-50 p-4"
        >
          <h4 className="mb-2 font-medium text-yellow-800">Award Tips</h4>
          <ul className="space-y-1 text-sm text-yellow-700">
            <li>• Awards build credibility and trust with customers</li>
            <li>• Include year to show recency of recognition</li>
            <li>• Score points (e.g., 95/100) add precision</li>
          </ul>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}

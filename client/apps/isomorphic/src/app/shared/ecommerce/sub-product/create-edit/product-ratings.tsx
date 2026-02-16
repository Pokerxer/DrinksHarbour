// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Textarea, Text, Badge, Button } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import FormGroup from '@/app/shared/form-group';
import { motion } from 'framer-motion';
import { Star, TrendingUp, Average } from 'lucide-react';

interface ProductRatingsProps {
  className?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ProductRatings({ className }: ProductRatingsProps) {
  const { register, watch, setValue, formState: { errors } } = useFormContext<CreateProductInput>();
  const ratings = watch('ratings') || {};
  const averageRating = watch('averageRating') || 0;
  const reviewCount = watch('reviewCount') || 0;

  const ratingSources = [
    { key: 'wineSpectator', label: 'Wine Spectator', max: 100, icon: '🍷' },
    { key: 'robertParker', label: 'Robert Parker (WA)', max: 100, icon: '🎯' },
    { key: 'jamesSuckling', label: 'James Suckling', max: 100, icon: '👃' },
    { key: 'decanter', label: 'Decanter', max: 100, icon: '🍾' },
    { key: 'whiskyAdvocate', label: 'Whisky Advocate', max: 100, icon: '🥃' },
    { key: 'jimMurray', label: 'Jim Murray', max: 100, icon: '📝' },
    { key: 'untappd', label: 'Untappd', max: 5, icon: '🍺' },
  ];

  const updateRating = (key: string, value: string) => {
    const numValue = parseFloat(value);
    const maxValue = ratingSources.find(r => r.key === key)?.max || 100;
    setValue('ratings', {
      ...ratings,
      [key]: isNaN(numValue) ? undefined : Math.min(numValue, maxValue),
    });
  };

  const getScoreColor = (score: number | undefined, max: number) => {
    if (!score) return 'bg-gray-100 text-gray-500';
    const percentage = (score / max) * 100;
    if (percentage >= 90) return 'bg-green-100 text-green-700 border-green-300';
    if (percentage >= 80) return 'bg-blue-100 text-blue-700 border-blue-300';
    if (percentage >= 70) return 'bg-amber-100 text-amber-700 border-amber-300';
    return 'bg-red-100 text-red-700 border-red-300';
  };

  return (
    <FormGroup
      title="Expert Ratings"
      description="Add ratings from professional critics and review platforms"
      className={cn(className)}
    >
      <motion.div
        className="space-y-6"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
        }}
        initial="hidden"
        animate="visible"
      >
        {/* Average Rating Display */}
        <motion.div variants={itemVariants} className="rounded-xl border border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-md">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-xl font-bold text-gray-900">{averageRating.toFixed(1)}</span>
                  </div>
                  <span className="text-xs text-gray-500">/ 5.0</span>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Average Rating</h4>
                <p className="text-sm text-gray-600">{reviewCount} reviews</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">
                {Object.values(ratings).filter(Boolean).length > 0 
                  ? ratingSources.filter(r => ratings[r.key]).length 
                  : 0}
              </div>
              <p className="text-sm text-gray-500">sources</p>
            </div>
          </div>
        </motion.div>

        {/* Rating Sources Grid */}
        <div className="grid gap-4 @md:grid-cols-2 @lg:grid-cols-4">
          {ratingSources.map((source) => {
            const score = ratings[source.key as keyof typeof ratings];
            const percentage = source.max === 5 ? (score || 0) * 20 : score || 0;
            
            return (
              <motion.div
                key={source.key}
                variants={itemVariants}
                className="rounded-xl border border-gray-200 bg-white p-4 transition-all hover:shadow-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{source.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{source.label}</span>
                  </div>
                  {score !== undefined && score !== null && (
                    <Badge className={getScoreColor(score, source.max)}>
                      {source.max === 5 ? score.toFixed(1) : score}
                      {source.max === 5 ? '' : '/100'}
                    </Badge>
                  )}
                </div>

                <div className="relative">
                  <Input
                    type="number"
                    placeholder={`0 - ${source.max}`}
                    value={score || ''}
                    onChange={(e) => updateRating(source.key, e.target.value)}
                    min={0}
                    max={source.max}
                    step={source.max === 5 ? 0.1 : 1}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    /{source.max}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <motion.div
                    className={`h-full rounded-full transition-all ${
                      percentage >= 90 ? 'bg-green-500' :
                      percentage >= 80 ? 'bg-blue-500' :
                      percentage >= 70 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Tips */}
        <motion.div
          variants={itemVariants}
          className="rounded-lg bg-blue-50 p-4"
        >
          <h4 className="mb-2 font-medium text-blue-800">Rating Tips</h4>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>• Add ratings from trusted sources to increase product value</li>
            <li>• Scores out of 100 are standard for wine/spirits reviews</li>
            <li>• Untappd uses a 5-point scale for beers</li>
            <li>• Leave blank if no rating available from that source</li>
          </ul>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}

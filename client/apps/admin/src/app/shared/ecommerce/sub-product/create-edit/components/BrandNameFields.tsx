import { useId } from 'react';
import { Input, Button, Text } from 'rizzui';
import { PiSpinner, PiSparkle, PiCaretRight } from 'react-icons/pi';
import { motion } from 'framer-motion';
import { fieldVariants, type BrandFormData } from './brand-form-options';

export default function BrandNameFields({
  formData,
  isSubmitting,
  isGenerating,
  handleChange,
  handleAutoGenerate,
}: {
  formData: BrandFormData;
  isSubmitting: boolean;
  isGenerating: boolean;
  handleChange: (field: keyof BrandFormData, value: string) => void;
  handleAutoGenerate: () => void;
}) {
  const nameId = useId();
  const slugId = useId();
  return (
    <>
      {/* Brand Name Section */}
      <motion.div
        variants={fieldVariants}
        custom={0}
        initial="hidden"
        animate="visible"
        className="rounded-xl border border-gray-100 bg-gray-50/50 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <label
              htmlFor={nameId}
              className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700"
            >
              Brand Name <span className="text-red-500">*</span>
            </label>
            <Input
              id={nameId}
              placeholder="e.g., Glenfiddich"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              disabled={isSubmitting}
              className="w-full border-gray-200 bg-white transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div className="pt-6">
            <Button
              type="button"
              variant="outline"
              color="primary"
              disabled={
                !formData.name ||
                formData.name.length < 3 ||
                isGenerating ||
                isSubmitting
              }
              aria-label="Auto-fill brand details"
              onClick={handleAutoGenerate}
              className="gap-1.5 whitespace-nowrap border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              {isGenerating ? (
                <>
                  <PiSpinner className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">Generating...</span>
                </>
              ) : (
                <>
                  <PiSparkle className="h-4 w-4" />
                  <span className="hidden sm:inline">Auto-fill</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* URL Slug */}
      <motion.div
        variants={fieldVariants}
        custom={1}
        initial="hidden"
        animate="visible"
      >
        <label
          htmlFor={slugId}
          className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700"
        >
          <PiCaretRight className="h-3.5 w-3.5 text-gray-400" />
          URL Slug
        </label>
        <div className="relative">
          <Input
            id={slugId}
            placeholder="auto-generated-from-name"
            value={
              formData.name
                ? formData.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '')
                : ''
            }
            disabled={true}
            className="w-full border-gray-200 bg-gray-50 font-mono text-sm text-gray-500"
          />
        </div>
        <Text className="mt-1.5 flex items-center gap-1 text-xs text-gray-400">
          <PiCaretRight className="h-3 w-3" />
          Auto-generated from brand name
        </Text>
      </motion.div>
    </>
  );
}

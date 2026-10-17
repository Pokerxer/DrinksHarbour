import { useId, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import { geminiService } from '@/services/gemini.service';
import { Input, Textarea, Button, Text } from 'rizzui';
import {
  PiSpinner,
  PiSparkle,
  PiGlobe,
  PiCalendar,
  PiTag,
  PiCaretRight,
} from 'react-icons/pi';
import { motion } from 'framer-motion';
import {
  fieldVariants,
  COUNTRIES,
  BRAND_CATEGORIES,
  type BrandFormData,
} from './brand-form-options';

export default function BrandDetailsFields({
  formData,
  isSubmitting,
  isGenerating,
  handleChange,
  setFormData,
  setIsGenerating,
  token,
}: {
  formData: BrandFormData;
  isSubmitting: boolean;
  isGenerating: boolean;
  handleChange: (field: keyof BrandFormData, value: string) => void;
  setFormData: Dispatch<SetStateAction<BrandFormData>>;
  setIsGenerating: Dispatch<SetStateAction<boolean>>;
  token: string;
}) {
  const id = useId();
  return (
    <>
      {/* Description */}
      <motion.div
        variants={fieldVariants}
        custom={2}
        initial="hidden"
        animate="visible"
      >
        <label
          htmlFor={`${id}-description`}
          className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700"
        >
          <PiTag className="h-3.5 w-3.5 text-gray-400" />
          Description
        </label>
        <div className="relative">
          <Textarea
            id={`${id}-description`}
            placeholder="Brief description of the brand..."
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            disabled={isSubmitting}
            rows={3}
            className="w-full border-gray-200 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          {formData.name && (
            <Button
              aria-label="Auto-fill description"
              type="button"
              size="sm"
              variant="text"
              color="primary"
              disabled={isGenerating || isSubmitting}
              onClick={async () => {
                if (!formData.name) return;
                setIsGenerating(true);
                try {
                  const res = await geminiService.generateBrandDescription(
                    formData.name,
                    token
                  );
                  if (res.data.description) {
                    setFormData((prev) => ({
                      ...prev,
                      description: res.data.description,
                    }));
                  }
                } catch (error) {
                  toast.error('Failed to generate description');
                } finally {
                  setIsGenerating(false);
                }
              }}
              className="absolute bottom-2 right-2"
            >
              <PiSparkle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </motion.div>

      {/* Two Column: Country & Year Founded */}
      <motion.div
        variants={fieldVariants}
        custom={3}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <div>
          <label
            htmlFor={`${id}-countryOfOrigin`}
            className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700"
          >
            <PiGlobe className="h-3.5 w-3.5 text-gray-400" />
            Country of Origin
          </label>
          <div className="relative">
            <select
              id={`${id}-countryOfOrigin`}
              className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={formData.countryOfOrigin}
              onChange={(e) => handleChange('countryOfOrigin', e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Select country</option>
              {COUNTRIES.map((country) => (
                <option key={country.value} value={country.value}>
                  {country.label}
                </option>
              ))}
            </select>
            {formData.name && (
              <Button
                aria-label="Auto-fill country"
                type="button"
                size="sm"
                variant="text"
                color="primary"
                disabled={isGenerating || isSubmitting}
                onClick={async () => {
                  if (!formData.name) return;
                  setIsGenerating(true);
                  try {
                    const res = await geminiService.generateBrandCountry(
                      formData.name,
                      token
                    );
                    if (res.data.countryOfOrigin) {
                      setFormData((prev) => ({
                        ...prev,
                        countryOfOrigin: res.data.countryOfOrigin,
                      }));
                    }
                  } catch (error) {
                    toast.error('Failed to generate country');
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                <PiSparkle className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor={`${id}-founded`}
            className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700"
          >
            <PiCalendar className="h-3.5 w-3.5 text-gray-400" />
            Year Founded
          </label>
          <div className="relative">
            <Input
              id={`${id}-founded`}
              type="number"
              placeholder="e.g., 1886"
              value={formData.founded}
              onChange={(e) => handleChange('founded', e.target.value)}
              disabled={isSubmitting}
              className="w-full border-gray-200 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
            {formData.name && (
              <Button
                aria-label="Auto-fill founded"
                type="button"
                size="sm"
                variant="text"
                color="primary"
                disabled={isGenerating || isSubmitting}
                onClick={async () => {
                  if (!formData.name) return;
                  setIsGenerating(true);
                  try {
                    const res = await geminiService.generateBrandFounded(
                      formData.name,
                      token,
                      formData.countryOfOrigin
                    );
                    if (res.data.founded) {
                      setFormData((prev) => ({
                        ...prev,
                        founded: String(res.data.founded),
                      }));
                    }
                  } catch (error) {
                    toast.error('Failed to generate founded year');
                  } finally {
                    setIsGenerating(false);
                  }
                }}
                className="absolute right-1 top-1/2 -translate-y-1/2"
              >
                <PiSparkle className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Primary Category */}
      <motion.div
        variants={fieldVariants}
        custom={4}
        initial="hidden"
        animate="visible"
      >
        <label
          htmlFor={`${id}-primaryCategory`}
          className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700"
        >
          <PiTag className="h-3.5 w-3.5 text-gray-400" />
          Primary Category
        </label>
        <div className="relative">
          <select
            id={`${id}-primaryCategory`}
            className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={formData.primaryCategory}
            onChange={(e) => handleChange('primaryCategory', e.target.value)}
            disabled={isSubmitting}
          >
            <option value="">Select category</option>
            {BRAND_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {formData.name && (
            <Button
              aria-label="Auto-fill primary category"
              type="button"
              size="sm"
              variant="text"
              color="primary"
              disabled={isGenerating || isSubmitting}
              onClick={async () => {
                if (!formData.name) return;
                setIsGenerating(true);
                try {
                  const res = await geminiService.generateBrandCategory(
                    formData.name,
                    token
                  );
                  if (res.data.primaryCategory) {
                    setFormData((prev) => ({
                      ...prev,
                      primaryCategory: res.data.primaryCategory,
                    }));
                  }
                } catch (error) {
                  toast.error('Failed to generate category');
                } finally {
                  setIsGenerating(false);
                }
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2"
            >
              <PiSparkle className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </motion.div>
    </>
  );
}

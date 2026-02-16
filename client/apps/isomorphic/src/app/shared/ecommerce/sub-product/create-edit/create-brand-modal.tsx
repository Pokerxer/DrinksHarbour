// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { Input, Textarea, Button, Text } from 'rizzui';
import { Modal } from 'rizzui/modal';
import toast from 'react-hot-toast';
import { PiCheck, PiX, PiSpinner, PiSparkle, PiStorefront, PiGlobe, PiCalendar, PiTag, PiCaretRight } from 'react-icons/pi';
import { geminiService } from '@/services/gemini.service';
import { motion, AnimatePresence } from 'framer-motion';

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 25 }
  },
  exit: { opacity: 0, scale: 0.95, y: 20 }
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 }
};

const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.3 }
  })
};

interface CreateBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBrandCreated: (brandId: string) => void;
  token: string;
  productName?: string;
}

interface BrandFormData {
  name: string;
  description: string;
  countryOfOrigin: string;
  founded: string;
  primaryCategory: string;
}

const BRAND_CATEGORIES = [
  { value: 'spirits', label: 'Spirits' },
  { value: 'beer', label: 'Beer' },
  { value: 'wine', label: 'Wine' },
  { value: 'non_alcoholic', label: 'Non-Alcoholic' },
  { value: 'other', label: 'Other' },
];

const COUNTRIES = [
  { value: 'Ireland', label: 'Ireland' },
  { value: 'Scotland', label: 'Scotland' },
  { value: 'United States', label: 'United States' },
  { value: 'France', label: 'France' },
  { value: 'Italy', label: 'Italy' },
  { value: 'Spain', label: 'Spain' },
  { value: 'Sweden', label: 'Sweden' },
  { value: 'Russia', label: 'Russia' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Japan', label: 'Japan' },
  { value: 'Canada', label: 'Canada' },
  { value: 'South Africa', label: 'South Africa' },
  { value: 'Australia', label: 'Australia' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Puerto Rico', label: 'Puerto Rico' },
  { value: 'Other', label: 'Other' },
];

export default function CreateBrandModal({
  isOpen,
  onClose,
  onBrandCreated,
  token,
  productName = '',
}: CreateBrandModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState<BrandFormData>({
    name: '',
    description: '',
    countryOfOrigin: '',
    founded: '',
    primaryCategory: '',
  });

  // Pre-fill brand name from product name when modal opens
  useEffect(() => {
    if (isOpen && productName) {
      // Extract potential brand name from product name
      // Common patterns: "Brand 12 Year", "Brand Name Variant", "Brand - Type"
      const brandNameMatch = productName.match(/^([A-Z][a-zA-Z\s&-]+?)(?:\s+\d+\s*Year|\s+(?:Single|Double|Bottled|Vintage|Aged|Réserve|XO|VS|VSOP| Napoléon|Estate|Cuvee|Special|Reserve|Limited)?(?:\s+[A-Z][a-zA-Z]+)*(?:\s+(?:Malt|Bourbon|Rye|Whisky|Whiskey|Spirit|Gin|Vodka|Rum|Tequila|Brandy|Cognac|Liqueur)?)*(?:\s+\d+[A-Za-z]+)?)/);
      
      if (brandNameMatch && brandNameMatch[1]) {
        // Clean up extracted name
        const extractedName = brandNameMatch[1].trim()
          .replace(/[-&]$/, '') // Remove trailing dash or ampersand
          .trim();
        
        if (extractedName.length >= 2) {
          setFormData(prev => ({ ...prev, name: extractedName }));
        } else {
          setFormData(prev => ({ ...prev, name: productName }));
        }
      } else {
        setFormData(prev => ({ ...prev, name: productName }));
      }
    } else if (isOpen && !productName) {
      setFormData(prev => ({ ...prev, name: '' }));
    }
  }, [isOpen, productName]);

  const handleChange = (field: keyof BrandFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-generate brand details with AI using product context
  const handleAutoGenerate = async () => {
    if (!formData.name.trim() || formData.name.length < 2) {
      toast.error('Please enter a brand name first');
      return;
    }

    if (!token) {
      toast.error('Please sign in to use AI features');
      return;
    }

    setIsGenerating(true);
    toast.loading('Generating brand details with AI...', { id: 'ai-brand' });

    try {
      // Generate description - use product context for accuracy
      const descRes = await geminiService.generateBrandDescription(
        formData.name,
        token,
        productName // Pass product name for context
      );
      if (descRes.data.description) {
        setFormData((prev) => ({ ...prev, description: descRes.data.description }));
      }

      // Generate country of origin - use product context
      const countryRes = await geminiService.generateBrandCountry(
        formData.name,
        token,
        productName // Pass product name for context
      );
      if (countryRes.data.countryOfOrigin) {
        setFormData((prev) => ({ ...prev, countryOfOrigin: countryRes.data.countryOfOrigin }));
      }

      // Generate founded year - use product context and country
      const foundedRes = await geminiService.generateBrandFounded(
        formData.name,
        token,
        countryRes.data.countryOfOrigin || productName
      );
      if (foundedRes.data.founded) {
        setFormData((prev) => ({ ...prev, founded: String(foundedRes.data.founded) }));
      }

      // Generate primary category - use product context
      const categoryRes = await geminiService.generateBrandCategory(
        formData.name,
        token,
        productName // Pass product name for context
      );
      if (categoryRes.data.primaryCategory) {
        setFormData((prev) => ({ ...prev, primaryCategory: categoryRes.data.primaryCategory }));
      }

      toast.success('Brand details generated!', { id: 'ai-brand' });
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast.error(error.message || 'Failed to generate brand details', { id: 'ai-brand' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Brand name is required');
      return;
    }

    const slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    setIsSubmitting(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/brands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          slug: slug,
          description: formData.description.trim() || undefined,
          countryOfOrigin: formData.countryOfOrigin || undefined,
          founded: formData.founded ? parseInt(formData.founded) : undefined,
          primaryCategory: formData.primaryCategory || undefined,
          status: 'active',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to create brand');
      }

      toast.success('Brand created successfully!');
      onBrandCreated(result.data?._id || result.data?.brand?._id);
    } catch (error: any) {
      console.error('Failed to create brand:', error);
      toast.error(error.message || 'Failed to create brand');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size={{ 
        sm: 'max-w-sm',
        md: 'max-w-md', 
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl'
      }}
      className="[&>div]:p-0 [&>div]:rounded-2xl overflow-hidden"
      overlayClassName="bg-black/50 backdrop-blur-sm"
    >
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="overflow-hidden"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <PiStorefront className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Create New Brand</h2>
                <p className="text-xs text-white/70">Add a new brand to your catalog</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-all hover:bg-white/20 hover:text-white"
            >
              <PiX className="h-5 w-5" />
            </button>
          </div>
          {/* Decorative wave */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>

        {/* Form Content */}
        <div className="px-6 py-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Brand Name Section */}
            <motion.div 
              variants={fieldVariants}
              custom={0}
              initial="hidden"
              animate="visible"
              className="rounded-xl border border-gray-100 bg-gray-50/50 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    Brand Name <span className="text-red-500">*</span>
                  </label>
                  <Input
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
                    disabled={!formData.name || formData.name.length < 3 || isGenerating}
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
            <motion.div variants={fieldVariants} custom={1} initial="hidden" animate="visible">
              <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <PiCaretRight className="h-3.5 w-3.5 text-gray-400" />
                URL Slug
              </label>
              <div className="relative">
                <Input
                  placeholder="auto-generated-from-name"
                  value={
                    formData.name
                      ? formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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

            {/* Description */}
            <motion.div variants={fieldVariants} custom={2} initial="hidden" animate="visible">
              <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <PiTag className="h-3.5 w-3.5 text-gray-400" />
                Description
              </label>
              <div className="relative">
                <Textarea
                  placeholder="Brief description of the brand..."
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full border-gray-200 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                {formData.name && (
                  <Button
                    type="button"
                    size="sm"
                    variant="text"
                    color="primary"
                    disabled={isGenerating}
                    onClick={async () => {
                      if (!formData.name) return;
                      setIsGenerating(true);
                      try {
                        const res = await geminiService.generateBrandDescription(formData.name, token);
                        if (res.data.description) {
                          setFormData(prev => ({ ...prev, description: res.data.description }));
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
                <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <PiGlobe className="h-3.5 w-3.5 text-gray-400" />
                  Country of Origin
                </label>
                <div className="relative">
                  <select
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
                      type="button"
                      size="sm"
                      variant="text"
                      color="primary"
                      disabled={isGenerating}
                      onClick={async () => {
                        if (!formData.name) return;
                        setIsGenerating(true);
                        try {
                          const res = await geminiService.generateBrandCountry(formData.name, token);
                          if (res.data.countryOfOrigin) {
                            setFormData(prev => ({ ...prev, countryOfOrigin: res.data.countryOfOrigin }));
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
                <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                  <PiCalendar className="h-3.5 w-3.5 text-gray-400" />
                  Year Founded
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="e.g., 1886"
                    value={formData.founded}
                    onChange={(e) => handleChange('founded', e.target.value)}
                    disabled={isSubmitting}
                    className="w-full border-gray-200 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                  {formData.name && (
                    <Button
                      type="button"
                      size="sm"
                      variant="text"
                      color="primary"
                      disabled={isGenerating}
                      onClick={async () => {
                        if (!formData.name) return;
                        setIsGenerating(true);
                        try {
                          const res = await geminiService.generateBrandFounded(formData.name, token, formData.countryOfOrigin);
                          if (res.data.founded) {
                            setFormData(prev => ({ ...prev, founded: String(res.data.founded) }));
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
            <motion.div variants={fieldVariants} custom={4} initial="hidden" animate="visible">
              <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <PiTag className="h-3.5 w-3.5 text-gray-400" />
                Primary Category
              </label>
              <div className="relative">
                <select
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
                    type="button"
                    size="sm"
                    variant="text"
                    color="primary"
                    disabled={isGenerating}
                    onClick={async () => {
                      if (!formData.name) return;
                      setIsGenerating(true);
                      try {
                        const res = await geminiService.generateBrandCategory(formData.name, token);
                        if (res.data.primaryCategory) {
                          setFormData(prev => ({ ...prev, primaryCategory: res.data.primaryCategory }));
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

            {/* Footer */}
            <motion.div 
              variants={fieldVariants}
              custom={5}
              initial="hidden"
              animate="visible"
              className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-end"
            >
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-w-[140px] sm:w-auto"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <PiSpinner className="h-4 w-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <PiCheck className="h-4 w-4" />
                    Create Brand
                  </span>
                )}
              </Button>
            </motion.div>
          </form>
        </div>
      </motion.div>
    </Modal>
  );
}

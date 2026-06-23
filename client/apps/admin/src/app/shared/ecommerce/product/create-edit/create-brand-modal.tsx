// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { Input, Textarea, Button, Text } from 'rizzui';
import { Modal } from 'rizzui/modal';
import toast from 'react-hot-toast';
import { PiCheck, PiX, PiSpinner, PiSparkle } from 'react-icons/pi';
import { geminiService } from '@/services/gemini.service';

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
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Create New Brand</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Brand Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g., Glenfiddich"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                disabled={isSubmitting}
                className="w-full"
              />
            </div>
            <div className="pt-6">
              <Button
                type="button"
                variant="outline"
                color="primary"
                disabled={!formData.name || formData.name.length < 3 || isGenerating}
                onClick={handleAutoGenerate}
                className="gap-1"
              >
                {isGenerating ? (
                  <>
                    <PiSpinner className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <PiSparkle className="h-4 w-4" />
                    Auto-fill
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              URL Slug
            </label>
            <Input
              placeholder="auto-generated-from-name"
              value={
                formData.name
                  ? formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                  : ''
              }
              disabled={true}
              className="w-full bg-gray-50 font-mono text-sm"
            />
            <Text className="mt-1 text-xs text-gray-500">
              Auto-generated from brand name
            </Text>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Description
            </label>
            <div className="relative">
              <Textarea
                placeholder="Brief description of the brand..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                disabled={isSubmitting}
                rows={3}
                className="w-full"
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Country of Origin
              </label>
              <div className="relative">
                <select
                  className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <PiSparkle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Year Founded
              </label>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="e.g., 1886"
                  value={formData.founded}
                  onChange={(e) => handleChange('founded', e.target.value)}
                  disabled={isSubmitting}
                  className="w-full"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <PiSparkle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Primary Category
            </label>
            <div className="relative">
              <select
                className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <PiSparkle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px]"
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
          </div>
        </form>
      </div>
    </Modal>
  );
}

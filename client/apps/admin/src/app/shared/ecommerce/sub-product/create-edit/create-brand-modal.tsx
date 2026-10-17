// @ts-nocheck
'use client';

import { useState, useEffect, useId } from 'react';
import { Button } from 'rizzui';
import FormDialog from './components/FormDialog';
import toast from 'react-hot-toast';
import { PiCheck, PiSpinner } from 'react-icons/pi';
import { geminiService } from '@/services/gemini.service';
import BrandNameFields from './components/BrandNameFields';
import BrandDetailsFields from './components/BrandDetailsFields';
import type { BrandFormData } from './components/brand-form-options';

interface CreateBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBrandCreated: (brandId: string) => void;
  token: string;
  productName?: string;
}

export default function CreateBrandModal({
  isOpen,
  onClose,
  onBrandCreated,
  token,
  productName = '',
}: CreateBrandModalProps) {
  const formId = useId();
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
      const brandNameMatch = productName.match(
        /^([A-Z][a-zA-Z\s&-]+?)(?:\s+\d+\s*Year|\s+(?:Single|Double|Bottled|Vintage|Aged|Réserve|XO|VS|VSOP| Napoléon|Estate|Cuvee|Special|Reserve|Limited)?(?:\s+[A-Z][a-zA-Z]+)*(?:\s+(?:Malt|Bourbon|Rye|Whisky|Whiskey|Spirit|Gin|Vodka|Rum|Tequila|Brandy|Cognac|Liqueur)?)*(?:\s+\d+[A-Za-z]+)?)/
      );

      if (brandNameMatch && brandNameMatch[1]) {
        // Clean up extracted name
        const extractedName = brandNameMatch[1]
          .trim()
          .replace(/[-&]$/, '') // Remove trailing dash or ampersand
          .trim();

        if (extractedName.length >= 2) {
          setFormData((prev) => ({ ...prev, name: extractedName }));
        } else {
          setFormData((prev) => ({ ...prev, name: productName }));
        }
      } else {
        setFormData((prev) => ({ ...prev, name: productName }));
      }
    } else if (isOpen && !productName) {
      setFormData((prev) => ({ ...prev, name: '' }));
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
        setFormData((prev) => ({
          ...prev,
          description: descRes.data.description,
        }));
      }

      // Generate country of origin - use product context
      const countryRes = await geminiService.generateBrandCountry(
        formData.name,
        token,
        productName // Pass product name for context
      );
      if (countryRes.data.countryOfOrigin) {
        setFormData((prev) => ({
          ...prev,
          countryOfOrigin: countryRes.data.countryOfOrigin,
        }));
      }

      // Generate founded year - use product context and country
      const foundedRes = await geminiService.generateBrandFounded(
        formData.name,
        token,
        countryRes.data.countryOfOrigin || productName
      );
      if (foundedRes.data.founded) {
        setFormData((prev) => ({
          ...prev,
          founded: String(foundedRes.data.founded),
        }));
      }

      // Generate primary category - use product context
      const categoryRes = await geminiService.generateBrandCategory(
        formData.name,
        token,
        productName // Pass product name for context
      );
      if (categoryRes.data.primaryCategory) {
        setFormData((prev) => ({
          ...prev,
          primaryCategory: categoryRes.data.primaryCategory,
        }));
      }

      toast.success('Brand details generated!', { id: 'ai-brand' });
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast.error(error.message || 'Failed to generate brand details', {
        id: 'ai-brand',
      });
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

    const slug = formData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/brands`,
        {
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
        }
      );

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
    <FormDialog
      open={isOpen}
      onClose={onClose}
      title="Create brand"
      description="Add a brand to the central catalog. Brand name is required; the other details are optional."
      busy={isSubmitting}
      footer={
        <>
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
            form={formId}
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
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-5">
        <BrandNameFields
          formData={formData}
          isSubmitting={isSubmitting}
          isGenerating={isGenerating}
          handleChange={handleChange}
          handleAutoGenerate={handleAutoGenerate}
        />
        <BrandDetailsFields
          formData={formData}
          isSubmitting={isSubmitting}
          isGenerating={isGenerating}
          handleChange={handleChange}
          setFormData={setFormData}
          setIsGenerating={setIsGenerating}
          token={token}
        />
      </form>
    </FormDialog>
  );
}

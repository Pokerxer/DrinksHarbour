// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Textarea, Text, Badge, Button, Select, type SelectOption } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import FormGroup from '@/app/shared/form-group';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { Globe, ExternalLink, Link2, Trash2, Plus, Info } from 'lucide-react';
import { externalLinkTypes } from './form-utils';

interface ProductExternalLinksProps {
  className?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ProductExternalLinks({ className }: ProductExternalLinksProps) {
  const { register, watch, setValue, formState: { errors } } = useFormContext<CreateProductInput>();
  const externalLinks = watch('externalLinks') || [];
  const [urlError, setUrlError] = useState<string | null>(null);

  const addExternalLink = () => {
    const newLink = {
      name: '',
      url: '',
      type: '' as string | undefined,
    };
    setValue('externalLinks', [...externalLinks, newLink]);
  };

  const removeExternalLink = (index: number) => {
    const updated = externalLinks.filter((_, i) => i !== index);
    setValue('externalLinks', updated);
  };

  const updateExternalLink = (index: number, field: string, value: string) => {
    const updated = [...externalLinks];
    updated[index] = { ...updated[index], [field]: value };
    setValue('externalLinks', updated);
  };

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const getLinkTypeIcon = (type: string) => {
    switch (type) {
      case 'producer': return '🏭';
      case 'review': return '📝';
      case 'press': return '📰';
      case 'social': return '📱';
      default: return '🔗';
    }
  };

  return (
    <FormGroup
      title="External Links"
      description="Add links to producer websites, reviews, and social media"
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
        {/* Existing External Links */}
        {externalLinks.map((link: any, index: number) => (
          <motion.div
            key={index}
            variants={itemVariants}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                <span className="font-medium text-gray-900">External Link #{index + 1}</span>
                {link.type && (
                  <Badge color="primary" variant="flat">
                    {getLinkTypeIcon(link.type)} {link.type}
                  </Badge>
                )}
              </div>
              <Button
                type="button"
                variant="text"
                color="danger"
                size="sm"
                onClick={() => removeExternalLink(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 @md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Link Name
                </label>
                <Input
                  placeholder="e.g., Official Website"
                  value={link.name}
                  onChange={(e) => updateExternalLink(index, 'name', e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Link Type
                </label>
                <Select
                  placeholder="Select type"
                  options={externalLinkTypes.map(t => ({ value: t.value, label: t.label }))}
                  value={link.type}
                  onChange={(option: SelectOption) => updateExternalLink(index, 'type', option.value as string)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  URL
                </label>
                <div className="relative">
                  <Input
                    placeholder="https://..."
                    value={link.url}
                    onChange={(e) => {
                      updateExternalLink(index, 'url', e.target.value);
                      if (e.target.value && !validateUrl(e.target.value)) {
                        setUrlError('Please enter a valid URL');
                      } else {
                        setUrlError(null);
                      }
                    }}
                    error={urlError}
                  />
                  {link.url && validateUrl(link.url) && (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-700"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Add Button */}
        <motion.div variants={itemVariants}>
          <Button
            type="button"
            variant="outline"
            onClick={addExternalLink}
            className="w-full border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add External Link
          </Button>
        </motion.div>

        {/* Tips */}
        <motion.div
          variants={itemVariants}
          className="rounded-lg bg-blue-50 p-4"
        >
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <div>
              <h4 className="mb-1 font-medium text-blue-800">External Link Guidelines</h4>
              <ul className="space-y-1 text-sm text-blue-700">
                <li>• Include official producer website for authenticity</li>
                <li>• Add professional reviews to build credibility</li>
                <li>• Ensure all URLs are valid and accessible</li>
                <li>• Use HTTPS links for security</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}

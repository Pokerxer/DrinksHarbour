// @ts-nocheck
'use client';

import { useFormContext } from 'react-hook-form';
import { Input, Textarea, Text, Badge, Button, Select, type SelectOption } from 'rizzui';
import cn from '@core/utils/class-names';
import { CreateProductInput } from '@/validators/create-product.schema';
import FormGroup from '@/app/shared/form-group';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Award, Medal, BadgeCheck, Star, Plus, Trash2, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { PiSparkle, PiSpinner } from 'react-icons/pi';
import { useSession } from 'next-auth/react';
import { geminiService } from '@/services/gemini.service';
import toast from 'react-hot-toast';
import { medalOptions, externalLinkTypes, certificationOptions } from './form-utils';

interface ProductCertificationsProps {
  className?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ProductCertifications({ className }: ProductCertificationsProps) {
  const { data: session } = useSession();
  const { register, watch, setValue, formState: { errors } } = useFormContext<CreateProductInput>();
  const certifications = watch('certifications') || [];
  const [isGenerating, setIsGenerating] = useState(false);

  const addCertification = () => {
    const newCert = {
      name: '',
      issuedBy: '',
      year: undefined as number | undefined,
    };
    setValue('certifications', [...certifications, newCert]);
  };

  const removeCertification = (index: number) => {
    const updated = certifications.filter((_, i) => i !== index);
    setValue('certifications', updated);
  };

  const updateCertification = (index: number, field: string, value: string | number) => {
    const updated = [...certifications];
    updated[index] = { ...updated[index], [field]: value };
    setValue('certifications', updated);
  };

  return (
    <FormGroup
      title="Certifications"
      description="Add quality certifications and awards for your product"
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
        {/* Existing Certifications */}
        {certifications.map((cert: any, index: number) => (
          <motion.div
            key={index}
            variants={itemVariants}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-amber-500" />
                <span className="font-medium text-gray-900">Certification #{index + 1}</span>
              </div>
              <Button
                type="button"
                variant="text"
                color="danger"
                size="sm"
                onClick={() => removeCertification(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 @md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Certification Name
                </label>
                <Select
                  placeholder="Select certification"
                  options={certificationOptions.map(c => ({ value: c.value, label: c.label }))}
                  value={cert.name}
                  onChange={(option: SelectOption) => updateCertification(index, 'name', option.value as string)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Issued By
                </label>
                <Input
                  placeholder="e.g., Ecocert, USDA Organic"
                  value={cert.issuedBy}
                  onChange={(e) => updateCertification(index, 'issuedBy', e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Year
                </label>
                <Input
                  type="number"
                  placeholder="2020"
                  value={cert.year || ''}
                  onChange={(e) => updateCertification(index, 'year', parseInt(e.target.value) || undefined)}
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
            onClick={addCertification}
            className="w-full border-dashed"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Certification
          </Button>
        </motion.div>

        {/* Tips */}
        <motion.div
          variants={itemVariants}
          className="rounded-lg bg-amber-50 p-4"
        >
          <h4 className="mb-2 font-medium text-amber-800">Certification Tips</h4>
          <ul className="space-y-1 text-sm text-amber-700">
            <li>• Add recognized certifications to build customer trust</li>
            <li>• Include issuing organization for credibility</li>
            <li>• Certification year helps customers understand freshness</li>
          </ul>
        </motion.div>
      </motion.div>
    </FormGroup>
  );
}

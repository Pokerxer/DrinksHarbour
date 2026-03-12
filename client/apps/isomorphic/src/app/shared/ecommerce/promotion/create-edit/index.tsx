'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { Button, Badge, Input, Textarea, Modal } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiSpinner,
  PiCheck,
  PiArrowLeft,
  PiArrowRight,
  PiFloppyDisk,
  PiTag,
  PiPercent,
  PiCurrencyNgn,
  PiCalendar,
  PiUsers,
  PiEye,
  PiEyeClosed,
  PiGift,
  PiLightning,
  PiStar,
  PiTimer,
  PiXBold,
  PiInfo,
  PiCheckCircle,
  PiWarningCircle,
  PiList,
  PiDesktop,
  PiPencil,
  PiTrash,
  PiCaretLeft,
  PiCaretRight,
  PiCaretDown,
  PiFunnel,
  PiMagnifyingGlass,
  PiX,
  PiTrendUp,
  PiCalendarPlus,
  PiRocketLaunch,
  PiWarning,
  PiTarget,
  PiMedal,
  PiChartBar,
  PiCurrencyCircleDollar,
  PiShoppingCart,
  PiPackage,
  PiCopy,
  PiEraser,
  PiFlask,
  PiThumbsUp,
  PiTrophy,
  PiArrowsDownUp,
  PiCurrencyDollar,
  PiClock,
} from 'react-icons/pi';
import { promotionService } from '@/services/promotion.service';
import { subproductService } from '@/services/subproduct.service';

type FormPart = 'basicInfo' | 'products' | 'discount' | 'schedule' | 'display';

interface Step {
  key: FormPart;
  label: string;
  icon: React.ElementType;
}

const STEPS: Step[] = [
  { key: 'basicInfo', label: 'Basic Info', icon: PiTag },
  { key: 'products', label: 'Products', icon: PiUsers },
  { key: 'discount', label: 'Discount', icon: PiPercent },
  { key: 'schedule', label: 'Schedule', icon: PiCalendar },
  { key: 'display', label: 'Display', icon: PiEye },
];

const promotionTypes = [
  { 
    value: 'percentage_discount', 
    label: 'Percentage', 
    icon: PiPercent, 
    color: 'blue',
    description: 'Discount by percentage off',
    example: '20% off'
  },
  { 
    value: 'fixed_discount', 
    label: 'Fixed', 
    icon: PiCurrencyNgn, 
    color: 'green',
    description: 'Fixed amount discount',
    example: '₦500 off'
  },
  { 
    value: 'buy_x_get_y', 
    label: 'Buy X Get Y', 
    icon: PiGift, 
    color: 'purple',
    description: 'Buy items, get free',
    example: 'Buy 2 Get 1'
  },
  { 
    value: 'bundle', 
    label: 'Bundle', 
    icon: PiGift, 
    color: 'orange',
    description: 'Bundle multiple items',
    example: '3 for ₦1000'
  },
  { 
    value: 'flash_sale', 
    label: 'Flash Sale', 
    icon: PiLightning, 
    color: 'red',
    description: 'Limited time offer',
    example: 'Ends soon!'
  },
  { 
    value: 'loyalty', 
    label: 'Loyalty', 
    icon: PiStar, 
    color: 'yellow',
    description: 'Reward loyal customers',
    example: 'Points doubled'
  },
];

interface Props {
  id?: string;
}

interface ValidationErrors {
  name?: string;
  code?: string;
  discountValue?: string;
  startDate?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 12,
    },
  },
};

export default function CreateEditPromotion({ id: propId }: Props) {
  const router = useRouter();
  const params = useParams();
  const { data: session } = useSession();
  const token = session?.user?.token as string;
  
  const promotionId = propId || (params?.id as string);
  const isEdit = !!promotionId;

  const [activePart, setActivePart] = useState<FormPart>('basicInfo');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [showSummary, setShowSummary] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [formData, setFormData] = useState<any>({
    name: '',
    description: '',
    code: '',
    type: 'percentage_discount',
    discountValue: 10,
    discountType: 'percentage',
    applyTo: 'all',
    isActive: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    minPurchaseAmount: 0,
    minQuantity: 1,
    stackable: false,
    priority: 0,
    badge: { enabled: true, text: 'SALE' },
    usageLimit: '',
    maxDiscountAmount: '',
    buyQuantity: 2,
    getQuantity: 1,
    getDiscountPercentage: 100,
    bundlePrice: 0,
    isScheduled: false,
    showCountdown: false,
    showRemainingStock: false,
    highlightOnProductPage: true,
    selectedProducts: [],
    selectedCategories: [],
    selectedSubcategories: [],
    selectedBrands: [],
  });

  useEffect(() => {
    if (isEdit && token) {
      const fetchPromotion = async () => {
        try {
          const res = await promotionService.getPromotionById(promotionId, token);
          const data = (res as any)?.data;
          if (data) {
            setFormData({
              ...data,
              startDate: data.startDate ? String(data.startDate).split('T')[0] : '',
              endDate: data.endDate ? String(data.endDate).split('T')[0] : '',
            });
          }
        } catch (error: any) {
          toast.error(error.message || 'Failed to load promotion');
          router.push('/ecommerce/promotions');
        } finally {
          setInitialLoading(false);
        }
      };
      fetchPromotion();
    } else {
      setInitialLoading(false);
    }
  }, [isEdit, promotionId, token, router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePart, formData]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
    setIsDirty(true);
    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  };

  const validateField = useCallback((field: string) => {
    const newErrors: ValidationErrors = { ...errors };
    
    switch (field) {
      case 'name':
        if (!formData.name?.trim()) {
          newErrors.name = 'Promotion name is required';
        } else if (formData.name.length < 3) {
          newErrors.name = 'Name must be at least 3 characters';
        }
        break;
      case 'code':
        if (formData.code && formData.code.length < 3) {
          newErrors.code = 'Code must be at least 3 characters';
        }
        break;
      case 'discountValue':
        if (['percentage_discount', 'fixed_discount', 'flash_sale', 'loyalty'].includes(formData.type)) {
          if (!formData.discountValue || formData.discountValue <= 0) {
            newErrors.discountValue = 'Discount value must be greater than 0';
          } else if (formData.discountType === 'percentage' && formData.discountValue > 100) {
            newErrors.discountValue = 'Percentage cannot exceed 100%';
          }
        }
        break;
      case 'startDate':
        if (!formData.startDate) {
          newErrors.startDate = 'Start date is required';
        }
        break;
    }
    
    setErrors(newErrors);
    return !newErrors[field as keyof ValidationErrors];
  }, [formData, errors]);

  const validateStep = (step: FormPart): boolean => {
    const stepErrors: ValidationErrors = {};
    let isValid = true;

    if (step === 'basicInfo') {
      if (!formData.name?.trim()) {
        stepErrors.name = 'Promotion name is required';
        isValid = false;
      }
      if (formData.name.length < 3) {
        stepErrors.name = 'Name must be at least 3 characters';
        isValid = false;
      }
    }

    if (step === 'discount') {
      if (['percentage_discount', 'fixed_discount', 'flash_sale', 'loyalty'].includes(formData.type)) {
        if (!formData.discountValue || formData.discountValue <= 0) {
          stepErrors.discountValue = 'Discount value is required';
          isValid = false;
        }
      }
    }

    if (step === 'schedule') {
      if (!formData.startDate) {
        stepErrors.startDate = 'Start date is required';
        isValid = false;
      }
    }

    setErrors(stepErrors);
    return isValid;
  };

  const currentStepIndex = STEPS.findIndex(s => s.key === activePart);
  const progress = useMemo(() => ((currentStepIndex + 1) / STEPS.length) * 100, [currentStepIndex]);

  const handleNext = () => {
    if (validateStep(activePart)) {
      setDirection('forward');
      if (currentStepIndex < STEPS.length - 1) {
        setActivePart(STEPS[currentStepIndex + 1].key);
      }
    } else {
      setTouched({ name: true, code: true, discountValue: true, startDate: true });
    }
  };

  const handlePrev = () => {
    setDirection('backward');
    if (currentStepIndex > 0) {
      setActivePart(STEPS[currentStepIndex - 1].key);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(activePart)) {
      setTouched({ name: true, code: true, discountValue: true, startDate: true });
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate) : new Date(),
        endDate: formData.endDate ? new Date(formData.endDate) : undefined,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
        maxDiscountAmount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount) : undefined,
      };
      
      if (isEdit) {
        await promotionService.updatePromotion(promotionId, payload, token);
        toast.success('Promotion updated successfully');
      } else {
        await promotionService.createPromotion(payload, token);
        toast.success('Promotion created successfully');
      }
      setIsDirty(false);
      router.push('/ecommerce/promotions');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save promotion');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowExitDialog(true);
    } else {
      router.push('/ecommerce/promotions');
    }
  };

  const slideVariants = {
    enter: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? 50 : -50,
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? -50 : 50,
      opacity: 0,
      scale: 0.98,
    }),
  };

  if (initialLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <PiSpinner className="h-10 w-10 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Floating Summary Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowSummary(!showSummary)}
        className="fixed right-6 top-24 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90"
      >
        <PiList className="h-6 w-6" />
      </motion.button>

      {/* Summary Sidebar */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 z-40 h-screen w-80 overflow-y-auto border-l border-gray-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 p-4">
              <h3 className="font-semibold text-gray-900">Promotion Summary</h3>
              <button onClick={() => setShowSummary(false)} className="rounded-lg p-1 hover:bg-gray-200">
                <PiX className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                <div className="text-xs font-medium uppercase tracking-wider text-primary/70">Status</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${formData.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="font-semibold text-gray-900">{formData.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Name</div>
                  <div className="font-medium text-gray-900">{formData.name || '—'}</div>
                </div>
                {formData.code && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Code</div>
                    <div className="inline-block rounded-lg bg-gray-100 px-3 py-1 font-mono font-medium text-gray-900">
                      {formData.code}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Type</div>
                  <div className="capitalize text-gray-900">{formData.type?.replace(/_/g, ' ')}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Schedule</div>
                  <div className="text-sm text-gray-900">
                    {formData.startDate ? new Date(formData.startDate).toLocaleDateString() : '—'}
                    {formData.endDate && ` → ${new Date(formData.endDate).toLocaleDateString()}`}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Apply To</div>
                  <div className="text-sm capitalize text-gray-900">{formData.applyTo?.replace(/_/g, ' ')}</div>
                </div>
                {formData.badge?.enabled && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Badge</div>
                    <Badge variant="flat" className="mt-1 bg-red-100 text-red-700 font-bold">
                      {formData.badge.text}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Form Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all ${showSummary ? 'mr-80' : ''}`}
      >
        {/* Header */}
        <div className="relative overflow-hidden border-b border-gray-200 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 px-6 py-6">
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 1px, transparent 1px)`,
              backgroundSize: '30px 30px'
            }} />
          </div>
          
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <motion.h2 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xl font-bold text-white"
                >
                  {isEdit ? 'Edit Promotion' : 'Create New Promotion'}
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mt-1 text-sm text-gray-300"
                >
                  {isEdit ? 'Update your promotion details' : 'Set up a new promotion for your store'}
                </motion.p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="flat" className="bg-white/10 text-white border-0">
                  Step {currentStepIndex + 1} of {STEPS.length}
                </Badge>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-5">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-white/20">
                <motion.div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-green-400 to-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Step Navigation Pills */}
        <div className="bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PiCaretLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              {STEPS.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => {
                    if (index <= currentStepIndex) {
                      setDirection(index > currentStepIndex ? 'forward' : 'backward');
                      setActivePart(step.key);
                    }
                  }}
                  disabled={index > currentStepIndex}
                  className={`group relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                    activePart === step.key
                      ? 'bg-primary text-white shadow-md'
                      : index <= currentStepIndex
                      ? 'cursor-pointer bg-white text-gray-700 hover:bg-gray-100'
                      : 'cursor-not-allowed text-gray-400'
                  }`}
                >
                  <motion.div
                    initial={false}
                    animate={{
                      scale: activePart === step.key ? 1.1 : 1,
                    }}
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      activePart === step.key
                        ? 'bg-white/20'
                        : index <= currentStepIndex
                        ? 'bg-primary/10 text-primary'
                        : 'bg-gray-100'
                    }`}
                  >
                    {index < currentStepIndex ? (
                      <PiCheck className="h-3.5 w-3.5" />
                    ) : (
                      <step.icon className="h-3.5 w-3.5" />
                    )}
                  </motion.div>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={handleNext}
              disabled={currentStepIndex === STEPS.length - 1}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-all hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PiCaretRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="min-h-[450px] overflow-hidden p-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activePart}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {activePart === 'basicInfo' && (
                  <BasicInfoSection 
                    formData={formData} 
                    onChange={handleFieldChange}
                    onBlur={handleBlur}
                    errors={errors}
                    touched={touched}
                  />
                )}
                {activePart === 'products' && (
                  <ProductsSection 
                    formData={formData} 
                    onChange={handleFieldChange}
                    token={token}
                  />
                )}
                {activePart === 'discount' && (
                  <DiscountSection 
                    formData={formData} 
                    onChange={handleFieldChange}
                    errors={errors}
                    touched={touched}
                  />
                )}
                {activePart === 'schedule' && (
                  <ScheduleSection 
                    formData={formData} 
                    onChange={handleFieldChange}
                    errors={errors}
                    touched={touched}
                  />
                )}
                {activePart === 'display' && (
                  <DisplaySection formData={formData} onChange={handleFieldChange} />
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={handlePrev} 
              disabled={currentStepIndex === 0}
              className="gap-1"
            >
              <PiArrowLeft className="h-4 w-4" />
              Previous
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="mr-2 text-xs text-gray-500 hidden sm:inline">
              Press Ctrl+Arrow to navigate
            </span>
            <Button 
              variant="outline" 
              onClick={handleCancel}
              className="border-gray-300 text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </Button>
            
            {currentStepIndex < STEPS.length - 1 ? (
              <Button 
                onClick={handleNext}
                className="gap-1 bg-primary hover:bg-primary/90"
              >
                Next
                <PiArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                isLoading={loading}
                className="gap-1 bg-primary hover:bg-primary/90"
              >
                <PiFloppyDisk className="h-4 w-4" />
                {isEdit ? ' Update' : ' Create'}
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Exit Confirmation Modal */}
      <Modal isOpen={showExitDialog} onClose={() => setShowExitDialog(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900">Discard Changes?</h3>
          <p className="mt-2 text-sm text-gray-500">
            You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Keep Editing
            </Button>
            <Button onClick={() => router.push('/ecommerce/promotions')}>
              Discard Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface SectionProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  onBlur?: (field: string) => void;
  errors?: ValidationErrors;
  touched?: Record<string, boolean>;
  preview?: { original: number; discount: number; final: number };
  token?: string;
}

function BasicInfoSection({ formData, onChange, onBlur, errors, touched }: SectionProps) {
  const [showTypeInfo, setShowTypeInfo] = useState<string | null>(null);

  // Enhanced promotion presets for quick setup
  const promotionPresets: Record<string, {
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
    options: { name: string; discount: number; duration: number; type: string }[];
  }> = {
    seasonal: {
      label: 'Seasonal Promotions',
      icon: PiCalendarPlus,
      color: 'from-amber-400 to-orange-500',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-300',
      options: [
        { name: 'Summer Sale', discount: 20, duration: 30, type: 'percentage_discount' },
        { name: 'Holiday Special', discount: 25, duration: 14, type: 'percentage_discount' },
        { name: 'Back to School', discount: 15, duration: 21, type: 'percentage_discount' },
        { name: 'End of Season', discount: 30, duration: 7, type: 'percentage_discount' },
      ]
    },
    customer_segments: {
      label: 'Customer Segments',
      icon: PiUsers,
      color: 'from-purple-400 to-violet-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-300',
      options: [
        { name: 'VIP Members Only', discount: 10, duration: 365, type: 'loyalty' },
        { name: 'First-Time Buyers', discount: 15, duration: 30, type: 'percentage_discount' },
        { name: 'Repeat Customers', discount: 8, duration: 60, type: 'loyalty' },
        { name: 'Bulk Purchasers', discount: 12, duration: 90, type: 'buy_x_get_y' },
      ]
    },
    inventory_clearance: {
      label: 'Inventory Clearance',
      icon: PiTarget,
      color: 'from-red-400 to-rose-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-300',
      options: [
        { name: 'Clearance Sale', discount: 40, duration: 7, type: 'percentage_discount' },
        { name: 'Overstock Special', discount: 35, duration: 14, type: 'fixed_discount' },
        { name: 'Discontinued Items', discount: 50, duration: 3, type: 'flash_sale' },
        { name: 'Warehouse Clearance', discount: 45, duration: 10, type: 'bundle' },
      ]
    },
  };

  const generateCode = () => {
    const prefixes = ['SAVE', 'DEAL', 'PROMO', 'DISCOUNT', 'SALE', 'OFFER'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(Math.random() * 900) + 100;
    const code = `${randomPrefix}${randomNum}`;
    onChange('code', code);
    toast.success(`Generated code: ${code}`);
  };

  const copyCode = () => {
    if (formData.code) {
      navigator.clipboard.writeText(formData.code);
      toast.success('Code copied to clipboard!');
    }
  };

  const selectedType = promotionTypes.find(t => t.value === formData.type);

  // Enhanced preset selection state
  const [selectedPresetCategory, setSelectedPresetCategory] = useState<string | null>(null);

  return (
    <motion.div variants={containerVariants} className="space-y-6">
      {/* Header Card */}
      <motion.div 
        variants={itemVariants}
        className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20 p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
            <PiTag className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            <p className="text-sm text-gray-600 mt-1">Set up the core details of your promotion</p>
          </div>
          <Badge variant="flat" className="bg-primary/10 text-primary">
            Step 1 of 5
          </Badge>
        </div>
      </motion.div>

      {/* Enhanced Promotion Type Selection */}
      <motion.div 
        variants={itemVariants}
        className="rounded-2xl bg-gradient-to-br from-white to-gray-50 border border-gray-200 p-6 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="flex items-center gap-2 font-semibold text-gray-900">
            <PiLightning className="h-5 w-5 text-primary" />
            Promotion Type
          </h4>
          <Badge variant="flat" className="bg-primary/10 text-primary">
            Choose wisely
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {promotionTypes.map((type) => {
            const Icon = type.icon;
            return (
              <motion.button
                key={type.value}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onChange('type', type.value)}
                className={`rounded-xl p-4 text-center transition-all ${
                  formData.type === type.value
                    ? `bg-gradient-to-br ${type.color === 'blue' ? 'from-blue-500 to-indigo-600 text-white shadow-md' :
                       type.color === 'green' ? 'from-green-500 to-emerald-600 text-white shadow-md' :
                       type.color === 'purple' ? 'from-purple-500 to-violet-600 text-white shadow-md' :
                       type.color === 'orange' ? 'from-orange-500 to-amber-600 text-white shadow-md' :
                       type.color === 'red' ? 'from-red-500 to-rose-600 text-white shadow-md' :
                       'from-yellow-500 to-amber-600 text-white shadow-md'}`
                    : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <Icon className={`mx-auto h-6 w-6 mb-2 ${
                  formData.type === type.value ? 'text-white' : 
                  type.color === 'blue' ? 'text-blue-500' :
                  type.color === 'green' ? 'text-green-500' :
                  type.color === 'purple' ? 'text-purple-500' :
                  type.color === 'orange' ? 'text-orange-500' :
                  type.color === 'red' ? 'text-red-500' : 'text-yellow-500'
                }`} />
                <div className={`font-medium text-sm ${
                  formData.type === type.value ? 'text-white' : 'text-gray-700'
                }`}>
                  {type.label}
                </div>
                <div className={`text-xs mt-1 ${
                  formData.type === type.value ? 'text-white/80' : 'text-gray-500'
                }`}>
                  {type.example}
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Enhanced Promotion Presets */}
      <motion.div 
        variants={itemVariants}
        className="rounded-2xl bg-gradient-to-br from-slate-50 to-gray-50 border border-gray-200 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="flex items-center gap-2 font-semibold text-gray-900">
            <PiRocketLaunch className="h-5 w-5 text-slate-600" />
            Quick Setup Presets
          </h4>
          <Button
            type="button"
            variant="text"
            size="sm"
            onClick={() => setSelectedPresetCategory(selectedPresetCategory ? null : 'seasonal')}
            className="gap-1"
          >
            {selectedPresetCategory ? <PiEyeClosed className="h-4 w-4" /> : <PiEye className="h-4 w-4" />}
            {selectedPresetCategory ? 'Hide' : 'Show'} Presets
          </Button>
        </div>
        
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(promotionPresets).map(([key, preset]) => {
            const Icon = preset.icon;
            const isActive = selectedPresetCategory === key;
            
            return (
              <motion.button
                key={key}
                type="button"
                onClick={() => setSelectedPresetCategory(isActive ? null : key)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                  isActive
                    ? `${preset.borderColor} ${preset.bgColor} shadow-md`
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${preset.color} text-white shadow-sm`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">{preset.label}</div>
                    <div className="text-xs text-gray-500">{preset.options.length} options</div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Expanded Preset Options */}
        <AnimatePresence>
          {selectedPresetCategory && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 overflow-hidden"
            >
              <div className={`rounded-xl border p-4 ${promotionPresets[selectedPresetCategory].borderColor} ${promotionPresets[selectedPresetCategory].bgColor}`}>
                <h5 className="mb-3 font-medium text-gray-800">
                  {promotionPresets[selectedPresetCategory].label} Options
                </h5>
                <div className="grid gap-3 sm:grid-cols-2">
                  {promotionPresets[selectedPresetCategory].options.map((option, idx) => {
                    const typeInfo = promotionTypes.find(t => t.value === option.type);
                    const Icon = typeInfo?.icon || PiTag;
                    
                    return (
                      <motion.button
                        key={idx}
                        type="button"
                        onClick={() => {
                          // Apply the preset
                          onChange('name', option.name);
                          onChange('type', option.type);
                          if (option.discount) {
                            onChange('discountValue', option.discount);
                            onChange('discountType', 'percentage'); // Default to percentage for presets
                          }
                          
                          // Set dates
                          const startDate = new Date();
                          const endDate = new Date();
                          endDate.setDate(startDate.getDate() + option.duration);
                          
                          onChange('startDate', startDate.toISOString().split('T')[0]);
                          onChange('endDate', endDate.toISOString().split('T')[0]);
                          
                          toast.success(`Applied ${option.name} preset`);
                          setSelectedPresetCategory(null);
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="rounded-lg border border-white/50 bg-white/80 p-3 text-left transition-all hover:bg-white shadow-sm"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className="h-4 w-4 text-primary" />
                              <span className="font-medium text-gray-800">{option.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge size="sm" variant="flat" color={(typeInfo?.color as 'primary' | 'secondary' | 'danger' | 'success' | 'warning' | 'info') || 'primary'}>
                                {option.discount}% {typeInfo?.label || 'Discount'}
                              </Badge>
                              <span className="text-xs text-gray-600">
                                {option.duration} days
                              </span>
                            </div>
                          </div>
                          <PiCheck className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Name & Code Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Promotion Name */}
        <div className="group space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            Promotion Name 
            <span className="text-red-500">*</span>
            <span className="ml-auto text-xs font-normal text-gray-400">
              {(formData.name || '').length}/60
            </span>
          </label>
          <div className="relative">
            <Input
              type="text"
              value={formData.name || ''}
              onChange={(e) => onChange('name', e.target.value.slice(0, 60))}
              onBlur={() => onBlur?.('name')}
              placeholder="e.g., Summer Sale 2025"
              className={`h-12 ${errors?.name && touched?.name ? 'border-red-500 ring-2 ring-red-500/20' : 'focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {formData.name && !errors?.name && (
                <PiCheckCircle className="h-5 w-5 text-green-500" />
              )}
            </div>
          </div>
          {errors?.name && touched?.name ? (
            <motion.p 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1 text-sm text-red-500"
            >
              <PiWarningCircle className="h-4 w-4" />
              {errors.name}
            </motion.p>
          ) : (
            <p className="text-xs text-gray-400">Give your promotion a catchy name</p>
          )}
        </div>

        {/* Promotion Code */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            Promotion Code
            <span className="text-xs font-normal text-gray-400">(optional)</span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                value={formData.code || ''}
                onChange={(e) => onChange('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))}
                onBlur={() => onBlur?.('code')}
                placeholder="e.g., SUMMER25"
                className={`h-12 uppercase font-mono ${errors?.code && touched?.code ? 'border-red-500' : ''}`}
              />
              {formData.code && (
                <button
                  type="button"
                  onClick={copyCode}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                >
                  <PiCheckCircle className="h-5 w-5" />
                </button>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={generateCode}
              className="h-12 px-4"
            >
              Generate
            </Button>
          </div>
          <p className="text-xs text-gray-400">Leave empty for automatic discount (no code required)</p>
        </div>
      </motion.div>

      {/* Status Card */}
      <motion.div variants={itemVariants} className="space-y-3">
        <label className="text-sm font-semibold text-gray-700">Status</label>
        <div className="grid grid-cols-2 gap-4">
          {[
            { value: true, label: 'Active', icon: PiCheckCircle, color: 'green', desc: 'Customers can use this promo' },
            { value: false, label: 'Inactive', icon: PiXBold, color: 'gray', desc: 'Draft mode - not visible yet' },
          ].map((status) => (
            <motion.button
              key={String(status.value)}
              type="button"
              onClick={() => onChange('isActive', status.value)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`relative flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                formData.isActive === status.value 
                  ? 'border-green-500 bg-green-50/50 shadow-md' 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                formData.isActive === status.value 
                  ? 'bg-green-100' 
                  : 'bg-gray-100'
              }`}>
                <status.icon className={`h-5 w-5 ${
                  formData.isActive === status.value 
                    ? 'text-green-600' 
                    : 'text-gray-400'
                }`} />
              </div>
              <div className="flex-1">
                <div className={`font-semibold ${
                  formData.isActive === status.value 
                    ? 'text-green-700' 
                    : 'text-gray-700'
                }`}>
                  {status.label}
                </div>
                <div className="text-xs text-gray-500">{status.desc}</div>
              </div>
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                formData.isActive === status.value 
                  ? 'border-green-500 bg-green-500' 
                  : 'border-gray-300'
              }`}>
                {formData.isActive === status.value && (
                  <PiCheck className="h-3 w-3 text-white" />
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Description */}
      <motion.div variants={itemVariants} className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-700">Description</label>
          <span className="text-xs text-gray-400">{(formData.description || '').length}/500</span>
        </div>
        <Textarea
          value={formData.description || ''}
          onChange={(e) => onChange('description', e.target.value.slice(0, 500))}
          placeholder="Describe your promotion to help customers understand it. This will be displayed on the promotion banner..."
          rows={4}
          className="resize-none"
        />
      </motion.div>

      {/* Promotion Type */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-700">Promotion Type</label>
          {selectedType && (
            <Badge variant="flat" className={`bg-${selectedType.color}-100 text-${selectedType.color}-700`}>
              {selectedType.description}
            </Badge>
          )}
        </div>
        
        {/* Selected Type Preview */}
        {selectedType && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`rounded-xl bg-${selectedType.color}-50 border border-${selectedType.color}-200 p-4 mb-4`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${selectedType.color}-100`}>
                <selectedType.icon className={`h-5 w-5 text-${selectedType.color}-600`} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{selectedType.label} Discount</div>
                <div className="text-sm text-gray-600">Example: <span className="font-mono font-semibold">{selectedType.example}</span></div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {promotionTypes.map((type, idx) => (
            <motion.button
              key={type.value}
              type="button"
              onClick={() => {
                onChange('type', type.value);
                setShowTypeInfo(type.value);
              }}
              onMouseEnter={() => setShowTypeInfo(type.value)}
              onMouseLeave={() => setShowTypeInfo(null)}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className={`group relative flex flex-col items-center justify-center rounded-xl border-2 p-4 text-center transition-all ${
                formData.type === type.value 
                  ? `border-${type.color}-500 bg-${type.color}-50 shadow-md` 
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
            >
              <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full ${
                formData.type === type.value ? `bg-${type.color}-500` : 'bg-transparent'
              }`} />
              <type.icon className={`mb-2 h-6 w-6 transition-colors ${
                formData.type === type.value ? `text-${type.color}-600` : 'text-gray-400 group-hover:text-gray-600'
              }`} />
              <span className={`text-xs font-semibold ${
                formData.type === type.value ? `text-${type.color}-700` : 'text-gray-600'
              }`}>{type.label}</span>
              
              {/* Tooltip */}
              {showTypeInfo === type.value && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 rounded-lg bg-gray-800 p-2 text-xs text-white z-10"
                >
                  {type.description}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-gray-800" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Quick Tips */}
      <motion.div 
        variants={itemVariants}
        className="rounded-xl bg-blue-50 border border-blue-200 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
            <PiInfo className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-sm text-blue-800">
            <span className="font-semibold">Pro Tips:</span>
            <ul className="mt-1 space-y-1 text-blue-700">
              <li>• Use clear, memorable promo codes like "SUMMER20"</li>
              <li>• Set a minimum purchase to encourage higher order values</li>
              <li>• Flash sales create urgency - use countdown timers</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DiscountSection({ formData, onChange, errors, touched }: SectionProps) {
  const showDiscountValue = ['percentage_discount', 'fixed_discount', 'flash_sale', 'loyalty'].includes(formData.type || '');
  const showBuyXGetY = formData.type === 'buy_x_get_y';
  const showBundle = formData.type === 'bundle';

  // Find selected type info
  const selectedType = promotionTypes.find(t => t.value === formData.type);

  // Show loading/error state
  if (!formData.type) {
    return (
      <div className="text-center py-12">
        <PiWarningCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Promotion Type Selected</h3>
        <p className="text-gray-500">Please go to the Basic Info section to select a promotion type</p>
      </div>
    );
  }

  // Enhanced preview calculation with actual product prices
  // Enhanced preview calculation with actual product prices
  const calculatePreview = useMemo(() => {
    // Get selected products
    const selectedProducts = formData.selectedProducts || [];
    const hasSelectedProducts = selectedProducts.length > 0;
    
    // Calculate average price from selected products, or fallback to sample
    const averagePrice = hasSelectedProducts 
      ? selectedProducts.reduce((sum: number, product: any) => sum + (product.price || product.basePrice || 1000), 0) / selectedProducts.length
      : 5000;
      
    const samplePrice = Math.round(averagePrice);
    let discount = 0;
    let finalPrice = samplePrice;
    let savingsBreakdown = [] as { type: string; amount: number; description: string }[];
    
    // Regular discount
    if (formData.type === 'percentage_discount' && formData.discountValue) {
      discount = (samplePrice * formData.discountValue) / 100;
      finalPrice = samplePrice - discount;
      savingsBreakdown.push({
        type: 'Regular Discount',
        amount: discount,
        description: `${formData.discountValue}% off original price`
      });
    } else if (formData.type === 'fixed_discount' && formData.discountValue) {
      discount = Math.min(formData.discountValue, samplePrice);
      finalPrice = samplePrice - discount;
      savingsBreakdown.push({
        type: 'Fixed Discount',
        amount: discount,
        description: `₦${formData.discountValue.toLocaleString()} off original price`
      });
    }
    
    // Flash sale discount
    if (formData.type === 'flash_sale' && formData.flashDiscountPercentage) {
      const flashDiscount = (samplePrice * formData.flashDiscountPercentage) / 100;
      finalPrice -= flashDiscount;
      savingsBreakdown.push({
        type: 'Flash Sale',
        amount: flashDiscount,
        description: `${formData.flashDiscountPercentage}% flash discount`
      });
    }
    
    // Loyalty discount
    if (formData.type === 'loyalty' && formData.loyaltyDiscountPercentage) {
      const loyaltyDiscount = (samplePrice * formData.loyaltyDiscountPercentage) / 100;
      finalPrice -= loyaltyDiscount;
      savingsBreakdown.push({
        type: 'Loyalty Discount',
        amount: loyaltyDiscount,
        description: `${formData.loyaltyDiscountPercentage}% for ${formData.loyaltyTierRequirement || 'members'}`
      });
    }
    
    // Buy X Get Y discount
    if (formData.type === 'buy_x_get_y' && formData.buyQuantity && formData.getQuantity) {
      const buyQty = formData.buyQuantity;
      const getQty = formData.getQuantity;
      const totalItems = buyQty + getQty;
      const freeItemsRatio = getQty / totalItems;
      
      // More realistic calculation: price of free items discounted
      const yDiscount = samplePrice * freeItemsRatio;
      finalPrice -= yDiscount;
      
      savingsBreakdown.push({
        type: 'Buy X Get Y',
        amount: yDiscount,
        description: `Buy ${buyQty}, Get ${getQty} Free`
      });
    }
    
    // Ensure final price doesn't go negative
    finalPrice = Math.max(0, finalPrice);
    
    return {
      original: samplePrice,
      discount: Math.round(samplePrice - finalPrice),
      final: Math.round(finalPrice),
      savingsPercentage: Math.round(((samplePrice - finalPrice) / samplePrice) * 100),
      savingsBreakdown,
      averagePrice: samplePrice,
      productCount: selectedProducts.length
    };
  }, [formData.type, formData.discountValue, formData.flashDiscountPercentage, formData.loyaltyDiscountPercentage, formData.buyQuantity, formData.getQuantity, formData.selectedProducts]);

  return (
    <motion.div variants={containerVariants} className="space-y-8">
      {/* Promotion Type Badge */}
      {selectedType ? (
        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-2xl bg-gradient-to-r border p-5"
          style={{
            background: selectedType.color === 'blue' ? `linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)` :
                        selectedType.color === 'green' ? `linear-gradient(135deg, #dcfce7 0%, #f0fdf4 100%)` :
                        selectedType.color === 'purple' ? `linear-gradient(135deg, #f3e8ff 0%, #faf5ff 100%)` :
                        selectedType.color === 'orange' ? `linear-gradient(135deg, #ffedd5 0%, #fff7ed 100%)` :
                        selectedType.color === 'red' ? `linear-gradient(135deg, #fee2e2 0%, #fef2f2 100%)` :
                        `linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)`,
            borderColor: selectedType.color === 'blue' ? '#93c5fd' :
                         selectedType.color === 'green' ? '#86efac' :
                         selectedType.color === 'purple' ? '#c4b5fd' :
                         selectedType.color === 'orange' ? '#fdba74' :
                         selectedType.color === 'red' ? '#fca5a5' : '#fcd34d'
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{
                backgroundColor: selectedType.color === 'blue' ? '#3b82f6' :
                               selectedType.color === 'green' ? '#10b981' :
                               selectedType.color === 'purple' ? '#8b5cf6' :
                               selectedType.color === 'orange' ? '#f97316' :
                               selectedType.color === 'red' ? '#ef4444' : '#f59e0b'
              }}
            >
              <selectedType.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">{selectedType.label} Promotion</h4>
              <p className="text-sm text-gray-600">{formData.name || 'Configure your discount'}</p>
              {formData.selectedProducts?.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Applied to {formData.selectedProducts.length} product{formData.selectedProducts.length !== 1 ? 's' : ''}
                </p>
              )}
              {formData.applyTo === 'all' && (
                <p className="text-xs text-gray-500 mt-1">
                  Applied to all products in your store
                </p>
              )}
            </div>
          </div>
           <Badge 
             variant="flat" 
             style={{
               backgroundColor: selectedType.color === 'blue' ? '#3b82f6' :
                            selectedType.color === 'green' ? '#10b981' :
                            selectedType.color === 'purple' ? '#8b5cf6' :
                            selectedType.color === 'orange' ? '#f97316' :
                            selectedType.color === 'red' ? '#ef4444' : '#f59e0b',
               color: 'white'
             }}
           >
             {formData.applyTo === 'all' ? 'All Products' : `${formData.selectedProducts?.length || 0} Products`}
           </Badge>
        </motion.div>
      ) : (
        <div className="text-center py-8">
          <PiWarningCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Promotion Type Selected</h3>
          <p className="text-gray-500">Please go to the Basic Info section to select a promotion type</p>
        </div>
      )}

      {showDiscountValue && (
        <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">
              Discount {formData.discountType === 'percentage' ? '(%)' : '(₦)'}
            </label>
            <Input
              type="number"
              min={0}
              max={formData.discountType === 'percentage' ? 100 : undefined}
              value={formData.discountValue || 0}
              onChange={(e) => onChange('discountValue', parseFloat(e.target.value) || 0)}
              className={errors?.discountValue && touched?.discountValue ? 'border-red-500' : ''}
            />
            {errors?.discountValue && touched?.discountValue && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1 text-sm text-red-500"
              >
                <PiWarningCircle className="h-4 w-4" />
                {errors.discountValue}
              </motion.p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Discount Type</label>
            <div className="flex rounded-xl border border-gray-200 p-1.5">
              {[
                { value: 'percentage', label: 'Percentage', icon: PiPercent },
                { value: 'fixed', label: 'Fixed', icon: PiCurrencyNgn },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => onChange('discountType', type.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                    formData.discountType === type.value 
                      ? 'bg-primary text-white shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <type.icon className="h-4 w-4" />
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700">Max Discount (₦)</label>
            <Input 
              type="number" 
              min={0} 
              value={formData.maxDiscountAmount || ''} 
              onChange={(e) => onChange('maxDiscountAmount', e.target.value ? parseFloat(e.target.value) : '')} 
              placeholder="Optional cap" 
            />
            <p className="text-xs text-gray-500">Cap the maximum discount amount</p>
          </div>
        </motion.div>
      )}

      {showDiscountValue && (
        <motion.div 
          variants={itemVariants}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6"
        >
           <div className="flex items-center justify-between mb-4">
             <h4 className="font-semibold text-gray-900">Live Preview</h4>
             <div className="flex items-center gap-3">
               <Badge variant="flat" className="bg-primary/10 text-primary">
                 Avg: ₦{calculatePreview.averagePrice?.toLocaleString()}
               </Badge>
               {calculatePreview.productCount > 0 && (
                 <Badge variant="flat" className="bg-green-100 text-green-700">
                   {calculatePreview.productCount} Product{calculatePreview.productCount !== 1 ? 's' : ''}
                 </Badge>
               )}
             </div>
           </div>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-400 line-through">₦{calculatePreview.original.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Original</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
                <PiArrowRight className="h-5 w-5" />
              </div>
              {formData.discountValue ? (
                <div className="text-center">
                  <div className="text-sm font-semibold text-primary">
                    {formData.discountType === 'percentage' ? `${formData.discountValue}% OFF` : `₦${formData.discountValue.toLocaleString()} OFF`}
                  </div>
                  {calculatePreview.savingsPercentage && (
                    <div className="text-xs text-gray-500">
                      You save {calculatePreview.savingsPercentage}%
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">₦{calculatePreview.final.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Final Price</div>
            </div>
          </div>
          {/* Savings Breakdown */}
          {calculatePreview.savingsBreakdown.length > 0 && (
            <div className="mt-6">
              <h5 className="text-sm font-semibold text-gray-700 mb-2">Savings Breakdown</h5>
              <div className="space-y-2">
                {calculatePreview.savingsBreakdown.map((saving, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500"></div>
                      <span className="text-gray-600">{saving.type}</span>
                    </div>
                    <span className="font-medium text-green-700">₦{Math.round(saving.amount).toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-bold pt-2 border-t border-gray-200">
                  <span>Total Savings</span>
                  <span className="text-green-700">₦{calculatePreview.discount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
          {formData.discountValue && (
            <div className="mt-4 flex justify-center">
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full">
                <PiTrendUp className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">
                  Save ₦{calculatePreview.discount.toLocaleString()} (~{calculatePreview.savingsPercentage}%)
                </span>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {showBuyXGetY && (
        <motion.div 
          variants={itemVariants}
          className="rounded-xl border-2 border-purple-200 bg-purple-50/50 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <PiGift className="h-5 w-5 text-purple-600" />
            <h4 className="font-semibold text-purple-900">Buy X Get Y Offer</h4>
          </div>
           <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
             <div className="space-y-2">
               <label className="text-sm font-medium text-gray-700">Buy Quantity</label>
               <Input type="number" min={1} value={formData.buyQuantity || 2} onChange={(e) => onChange('buyQuantity', parseInt(e.target.value) || 1)} />
             </div>
             <div className="space-y-2">
               <label className="text-sm font-medium text-gray-700">Get Quantity</label>
               <Input type="number" min={1} value={formData.getQuantity || 1} onChange={(e) => onChange('getQuantity', parseInt(e.target.value) || 1)} />
             </div>
             <div className="space-y-2">
               <label className="text-sm font-medium text-gray-700">Discount on Free (%)</label>
               <Input type="number" min={0} max={100} value={formData.getDiscountPercentage || 100} onChange={(e) => onChange('getDiscountPercentage', parseInt(e.target.value) || 100)} />
             </div>
           </div>
           <p className="text-xs text-purple-600 mt-3">
             Example: Buy {formData.buyQuantity || 2}, Get {formData.getQuantity || 1} - 
             {formData.getDiscountPercentage || 100}% off the additional items.
           </p>
        </motion.div>
      )}

      {showBundle && (
        <motion.div 
          variants={itemVariants}
          className="rounded-xl border-2 border-orange-200 bg-orange-50/50 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <PiGift className="h-5 w-5 text-orange-600" />
            <h4 className="font-semibold text-orange-900">Bundle Offer</h4>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Bundle Price (₦)</label>
            <Input type="number" min={0} value={formData.bundlePrice || 0} onChange={(e) => onChange('bundlePrice', parseFloat(e.target.value) || 0)} className="max-w-xs" />
          </div>
          <p className="text-xs text-orange-600 mt-3">Set the fixed price for the entire bundle.</p>
        </motion.div>
      )}

      {/* Flash Sale Section - Enhanced */}
      {formData.type === 'flash_sale' && (
        <motion.div 
          variants={itemVariants}
          className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <PiLightning className="h-5 w-5 text-amber-600" />
            <h4 className="font-semibold text-amber-900">Flash Sale Settings</h4>
          </div>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Flash Discount (%)</label>
              <Input 
                type="number" 
                min="0" 
                max="100" 
                value={formData.flashDiscountPercentage || 20} 
                onChange={(e) => onChange('flashDiscountPercentage', parseInt(e.target.value) || 20)} 
              />
              <p className="text-xs text-gray-500">Percentage discount for flash sale</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Limited Quantity</label>
              <Input 
                type="number" 
                min="0" 
                value={formData.flashQuantityLimit || ''} 
                onChange={(e) => onChange('flashQuantityLimit', e.target.value ? parseInt(e.target.value) : '')} 
                placeholder="Unlimited" 
              />
              <p className="text-xs text-gray-500">Maximum items available at flash price</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Flash Start Time</label>
              <Input 
                type="datetime-local" 
                value={formData.flashStartTime || ''} 
                onChange={(e) => onChange('flashStartTime', e.target.value)} 
              />
              <p className="text-xs text-gray-500">When the flash sale begins</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Flash End Time</label>
              <Input 
                type="datetime-local" 
                value={formData.flashEndTime || ''} 
                onChange={(e) => onChange('flashEndTime', e.target.value)} 
              />
              <p className="text-xs text-gray-500">When the flash sale ends</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-amber-100 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 text-amber-800">
              <PiWarning className="h-4 w-4" />
              <span className="text-sm font-medium">Flash Sale Tip</span>
            </div>
            <p className="text-xs text-amber-700 mt-1">
              Flash sales create urgency and boost immediate sales. Consider offering 15-30% discounts for 24-48 hours.
            </p>
          </div>
        </motion.div>
      )}

      {/* Loyalty Program Section - Enhanced */}
      {formData.type === 'loyalty' && (
        <motion.div 
          variants={itemVariants}
          className="rounded-xl border-2 border-yellow-200 bg-yellow-50/50 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <PiStar className="h-5 w-5 text-yellow-600" />
            <h4 className="font-semibold text-yellow-900">Loyalty Program Settings</h4>
          </div>
          
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Loyalty Discount (%)</label>
              <Input 
                type="number" 
                min="0" 
                max="50" 
                value={formData.loyaltyDiscountPercentage || 5} 
                onChange={(e) => onChange('loyaltyDiscountPercentage', parseInt(e.target.value) || 5)} 
              />
              <p className="text-xs text-gray-500">Percentage discount for loyalty members</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Required Tier</label>
              <select
                value={formData.loyaltyTierRequirement || ''}
                onChange={(e) => onChange('loyaltyTierRequirement', e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">All Members</option>
                <option value="bronze">Bronze Tier</option>
                <option value="silver">Silver Tier</option>
                <option value="gold">Gold Tier</option>
                <option value="platinum">Platinum Tier</option>
              </select>
              <p className="text-xs text-gray-500">Minimum tier required for this discount</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Points Multiplier</label>
              <Input 
                type="number" 
                min="1" 
                max="10" 
                step="0.5"
                value={formData.loyaltyPointsMultiplier || 1} 
                onChange={(e) => onChange('loyaltyPointsMultiplier', parseFloat(e.target.value) || 1)} 
              />
              <p className="text-xs text-gray-500">Multiply points earned during this promotion</p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Bonus Points</label>
              <Input 
                type="number" 
                min="0" 
                value={formData.loyaltyBonusPoints || 0} 
                onChange={(e) => onChange('loyaltyBonusPoints', parseInt(e.target.value) || 0)} 
              />
              <p className="text-xs text-gray-500">Additional points for using this promotion</p>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-yellow-100 rounded-lg border border-yellow-200">
            <div className="flex items-center gap-2 text-yellow-800">
              <PiStar className="h-4 w-4" />
              <span className="text-sm font-medium">Loyalty Strategy</span>
            </div>
            <p className="text-xs text-yellow-700 mt-1">
              Loyalty discounts help retain customers. Consider 5-15% discounts with tier-based exclusivity.
            </p>
          </div>
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Min. Purchase (₦)</label>
          <Input type="number" min={0} value={formData.minPurchaseAmount || 0} onChange={(e) => onChange('minPurchaseAmount', parseFloat(e.target.value) || 0)} placeholder="0 = No minimum" />
          <p className="text-xs text-gray-500">Minimum order amount to qualify</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Min. Quantity</label>
          <Input type="number" min={1} value={formData.minQuantity || 1} onChange={(e) => onChange('minQuantity', parseInt(e.target.value) || 1)} />
          <p className="text-xs text-gray-500">Minimum quantity to apply discount</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Usage Limit</label>
          <Input 
            type="number" 
            min={0} 
            value={formData.usageLimit || ''} 
            onChange={(e) => onChange('usageLimit', e.target.value ? parseInt(e.target.value) : '')} 
            placeholder="0 = Unlimited" 
          />
          <p className="text-xs text-gray-500">How many times this promo can be used</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Priority</label>
          <Input 
            type="number" 
            value={formData.priority || 0} 
            onChange={(e) => onChange('priority', parseInt(e.target.value) || 0)} 
          />
          <p className="text-xs text-gray-500">Higher = applies first when stacked</p>
        </div>
      </motion.div>

      <motion.label 
        variants={itemVariants}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="flex cursor-pointer items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-5"
      >
        <input 
          type="checkbox" 
          checked={formData.stackable || false} 
          onChange={(e) => onChange('stackable', e.target.checked)} 
          className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" 
        />
        <div className="flex-1">
          <span className="text-sm font-medium text-gray-700">Allow stacking with other promotions</span>
          <p className="text-xs text-gray-500">Customers can combine this with other discounts</p>
        </div>
        <Badge variant="flat" className={formData.stackable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
          {formData.stackable ? 'Stackable' : 'Single'}
        </Badge>
      </motion.label>
    </motion.div>
  );
}

function ProductsSection({ formData, onChange, token }: SectionProps & { token?: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterBrand, setFilterBrand] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [selectAll, setSelectAll] = useState(false);
  const [openSizeDropdown, setOpenSizeDropdown] = useState<string | null>(null);

  // Helper functions for selection counts
  const getSelectionCount = useCallback(() => {
    if (formData.applyTo === 'specific_products') return formData.selectedProducts?.length || 0;
    if (formData.applyTo === 'specific_categories') return (formData.selectedCategories?.length || 0) + (formData.selectedSubcategories?.length || 0);
    if (formData.applyTo === 'specific_brands') return formData.selectedBrands?.length || 0;
    return 0;
  }, [formData.applyTo, formData.selectedProducts, formData.selectedCategories, formData.selectedSubcategories, formData.selectedBrands]);

  const getAllItemCount = useCallback(() => {
    if (formData.applyTo === 'specific_products') return products.length;
    if (formData.applyTo === 'specific_categories') return categories.length + subcategories.length;
    if (formData.applyTo === 'specific_brands') return brands.length;
    return 0;
  }, [formData.applyTo, products.length, categories.length, subcategories.length, brands.length]);

  // Fetch data when applyTo changes
  useEffect(() => {
    if (formData.applyTo === 'specific_products') {
      fetchProducts();
    }
    if (formData.applyTo === 'specific_categories') {
      fetchCategories();
      fetchSubcategories();
    }
    if (formData.applyTo === 'specific_brands') {
      fetchBrands();
    }
  }, [formData.applyTo, token]);

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      // Use subproductService like in sub-product-list
      let subProductsData: any[] = [];
      
      if (token) {
        const response = await subproductService.getSubProducts(token, { limit: 500 }) as { success: boolean; data?: { subProducts?: any[] }; subProducts?: any[] };
        
        if (response.success) {
          subProductsData = response.data?.subProducts || response.subProducts || [];
        }
      }
      
      // Use subproducts if we got data, otherwise fallback to products API
      if (subProductsData.length > 0) {
        // Transform subproducts to include product info AND sizes - ensure IDs are strings
        const transformedProducts = subProductsData.map((sub: any) => ({
          ...sub,
          _id: sub._id?.toString() || sub._id,
          id: sub._id?.toString() || sub._id,
          name: sub.product?.name || sub.name || 'Unknown Product',
          basePrice: sub.baseSellingPrice || sub.sellingPrice,
          price: sub.baseSellingPrice || sub.sellingPrice,
          images: sub.imagesOverride || sub.product?.images || [],
          // Ensure category is always a string
          category: typeof sub.product?.category === 'object' 
            ? sub.product?.category?.name || String(sub.product?.category)
            : sub.product?.category,
          categoryId: typeof sub.product?.category === 'object'
            ? sub.product?.category?._id?.toString() || sub.product?.category
            : sub.product?.category,
          // Ensure brand is always a string
          brand: typeof sub.product?.brand === 'object'
            ? sub.product?.brand?.name || String(sub.product?.brand)
            : sub.product?.brand,
          brandId: typeof sub.product?.brand === 'object'
            ? sub.product?.brand?._id?.toString() || sub.product?.brand
            : sub.product?.brand,
          stockQuantity: sub.totalStock || sub.stockQuantity || 0,
          sellingPrice: sub.baseSellingPrice || sub.sellingPrice,
          costPrice: sub.costPrice,
          // Include sizes from subproduct
          sizes: (sub.sizes || []).map((size: any) => ({
            ...size,
            _id: size._id?.toString() || size._id,
          })),
          sku: sub.sku,
        }));
        
        setProducts(transformedProducts);
      } else {
        // Fallback to products API - get ALL products including pending/rejected (not just approved)
        const productRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products?limit=500&inStock=false&status=`);
        if (productRes.ok) {
          const productData = await productRes.json() as { data?: { products?: any[] }; products?: any[] };
          const productsArray: any[] = Array.isArray(productData?.data?.products) ? productData.data.products : 
                              Array.isArray(productData?.data) ? productData.data : [];
          const prods = productsArray.map((p: any) => ({
            ...p,
            _id: p._id?.toString() || p._id,
            id: p._id?.toString() || p._id,
            // Ensure category is always a string
            category: typeof p.category === 'object' 
              ? p.category?.name || String(p.category)
              : p.category,
            // Ensure brand is always a string
            brand: typeof p.brand === 'object'
              ? p.brand?.name || String(p.brand)
              : p.brand,
          }));
          setProducts(prods);
        }
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      // Try fallback on error - get all products including pending/rejected
      try {
        const productRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products?limit=500&inStock=false&status=`);
        if (productRes.ok) {
          const productData = await productRes.json() as { data?: { products?: any[] }; products?: any[] };
          const productsArray: any[] = Array.isArray(productData?.data?.products) ? productData.data.products : 
                              Array.isArray(productData?.data) ? productData.data : [];
          const prods = productsArray.map((p: any) => ({
            ...p,
            _id: p._id?.toString() || p._id,
            id: p._id?.toString() || p._id,
            category: typeof p.category === 'object' 
              ? p.category?.name || String(p.category)
              : p.category,
            brand: typeof p.brand === 'object'
              ? p.brand?.name || String(p.brand)
              : p.brand,
          }));
          setProducts(prods);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json() as { data?: { categories?: any[] }; categories?: any[] };
        const categoriesArray: any[] = Array.isArray(data?.data?.categories) ? data.data.categories : 
                                Array.isArray(data?.data) ? data.data : [];
        const cats = categoriesArray.map((cat: any) => ({
          ...cat,
          _id: cat._id?.toString() || cat._id,
          id: cat._id?.toString() || cat._id,
        }));
        setCategories(cats);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  const fetchSubcategories = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/subcategories`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json() as { data?: any[] };
        const subcategoriesArray: any[] = Array.isArray(data?.data) ? data.data : [];
        const subs = subcategoriesArray.map((sub: any) => ({
          ...sub,
          _id: sub._id?.toString() || sub._id,
          id: sub._id?.toString() || sub._id,
        }));
        setSubcategories(subs);
      }
    } catch (error) {
      console.error('Failed to fetch subcategories:', error);
    }
  };

  const fetchBrands = async () => {
    setLoadingBrands(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/brands?limit=500&status=active`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json() as { data?: { brands?: any[] }; brands?: any[] };
        const brandsArray: any[] = Array.isArray(data?.data?.brands) ? data.data.brands : 
                          Array.isArray(data?.data) ? data.data : [];
        const brds = brandsArray.map((brand: any) => ({
          ...brand,
          _id: brand._id?.toString() || brand._id,
          id: brand._id?.toString() || brand._id,
        }));
        setBrands(brds);
      }
    } catch (error) {
      console.error('Failed to fetch brands:', error);
    } finally {
      setLoadingBrands(false);
    }
  };

  const handleSelectItem = (type: 'products' | 'categories' | 'subcategories' | 'brands', item: any, selectedSizes?: string[]) => {
    const fieldMap: Record<string, string> = {
      products: 'selectedProducts',
      categories: 'selectedCategories',
      subcategories: 'selectedSubcategories',
      brands: 'selectedBrands',
    };
    
    const fieldKey = fieldMap[type];
    const current = formData[fieldKey] || [];
    
    // Get a consistent ID for comparison
    const itemId = item._id || item.id || item._id?.toString() || item.id?.toString();
    
    // Check if item is already selected by comparing IDs
    const isSelected = current.some((i: any) => {
      const currentId = i._id || i.id || i._id?.toString() || i.id?.toString();
      return currentId === itemId;
    });
    
    let updated;
    if (isSelected) {
      // Remove item from selection
      updated = current.filter((i: any) => {
        const currentId = i._id || i.id || i._id?.toString() || i.id?.toString();
        return currentId !== itemId;
      });
    } else {
      // Add item to selection with all needed data
      const newItem = {
        _id: itemId,
        id: itemId,
        name: item.name,
        price: item.basePrice || item.price,
        image: item.images?.[0]?.url || item.image || item.logo,
        // For categories/subcategories
        description: item.description,
        // For brands
        logo: item.logo,
        countryOfOrigin: item.countryOfOrigin,
        // For products with sizes - store selected sizes or null for all sizes
        sizes: selectedSizes || null, // null means all sizes
        selectedSizes: selectedSizes, // specific sizes array
      };
      updated = [...current, newItem];
    }
    
    onChange(fieldKey, updated);
    setOpenSizeDropdown(null);
  };

  // Handle selecting specific sizes for a product
  const handleSizeSelection = (product: any, sizes: string[]) => {
    handleSelectItem('products', product, sizes);
  };

  // Check if a specific size is selected for a product
  const isSizeSelected = (productId: string, sizeId: string): boolean => {
    const current = formData.selectedProducts || [];
    const product = current.find((p: any) => {
      const currentId = p._id || p.id || p._id?.toString() || p.id?.toString();
      return currentId === productId;
    });
    if (!product) return false;
    // If selectedSizes is null, all sizes are selected
    if (!product.selectedSizes) return true;
    return product.selectedSizes.includes(sizeId);
  };

  // Check if all sizes are selected for a product
  const isAllSizesSelected = (productId: string): boolean => {
    const current = formData.selectedProducts || [];
    const product = current.find((p: any) => {
      const currentId = p._id || p.id || p._id?.toString() || p.id?.toString();
      return currentId === productId;
    });
    if (!product) return false;
    // null means all sizes are selected
    return product.selectedSizes === null || product.selectedSizes === undefined;
  };

  // Filter products based on search and filters
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !filterCategory || p.categoryId === filterCategory || p.category === filterCategory;
    const matchesBrand = !filterBrand || p.brandId === filterBrand || p.brand === filterBrand;
    return matchesSearch && matchesCategory && matchesBrand;
  });

  const filteredCategories = categories.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredSubcategories = subcategories.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (!filterCategory || s.parent === filterCategory)
  );
  const filteredBrands = brands.filter(b => b.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  // Check if item is selected
  const isSelected = (type: 'products' | 'categories' | 'subcategories' | 'brands', item: any): boolean => {
    const fieldMap: Record<string, string> = {
      products: 'selectedProducts',
      categories: 'selectedCategories',
      subcategories: 'selectedSubcategories',
      brands: 'selectedBrands',
    };
    
    const fieldKey = fieldMap[type];
    const current = formData[fieldKey] || [];
    
    const itemId = item._id || item.id || item._id?.toString() || item.id?.toString();
    
    return current.some((i: any) => {
      const currentId = i._id || i.id || i._id?.toString() || i.id?.toString();
      return currentId === itemId;
    });
  };

  // Remove item from selection
  const removeSelection = (type: 'products' | 'categories' | 'subcategories' | 'brands', id: string) => {
    const fieldMap: Record<string, string> = {
      products: 'selectedProducts',
      categories: 'selectedCategories',
      subcategories: 'selectedSubcategories',
      brands: 'selectedBrands',
    };
    
    const fieldKey = fieldMap[type];
    const current = formData[fieldKey] || [];
    
    const updated = current.filter((i: any) => {
      const currentId = i._id || i.id || i._id?.toString() || i.id?.toString();
      return currentId !== id && currentId !== id.toString();
    });
    
    onChange(fieldKey, updated);
  };

  // Handle select all
  const handleSelectAll = (type: 'products' | 'categories' | 'brands') => {
    let items: any[] = [];
    let fieldMap = '';
    
    if (type === 'products') {
      items = filteredProducts;
      fieldMap = 'selectedProducts';
    } else if (type === 'categories') {
      items = filteredCategories;
      fieldMap = 'selectedCategories';
    } else if (type === 'brands') {
      items = filteredBrands;
      fieldMap = 'selectedBrands';
    }
    
    if (items.length > 0) {
      const selectedItems = items.map(item => ({
        _id: item._id || item.id,
        name: item.name,
        price: item.basePrice || item.price,
        image: item.images?.[0]?.url || item.image
      }));
      onChange(fieldMap, selectedItems);
    }
    setSelectAll(!selectAll);
  };

  // Render selected items summary
  const renderSelectedItems = (type: 'products' | 'categories' | 'subcategories' | 'brands', items: any[], color: string) => {
    if (items.length === 0) return null;
    
    return (
      <motion.div 
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-gray-500 uppercase">
            Selected ({items.length})
          </div>
          <button
            onClick={() => {
              if (type === 'products') onChange('selectedProducts', []);
              else if (type === 'categories') { onChange('selectedCategories', []); onChange('selectedSubcategories', []); }
              else if (type === 'subcategories') onChange('selectedSubcategories', []);
              else onChange('selectedBrands', []);
            }}
            className="text-xs text-red-500 hover:text-red-700"
          >
            Clear all
          </button>
        </div>
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {items.map((item: any) => {
            const sizeText = type === 'products' && item.sizes !== null && item.selectedSizes 
              ? (
                item.selectedSizes.length === 0 
                  ? ' (All sizes)' 
                  : ` (${item.selectedSizes.length} size${item.selectedSizes.length !== 1 ? 's' : ''})`
              )
              : '';
              
            const isPartialSelection = type === 'products' && 
              item.selectedSizes && 
              item.selectedSizes.length > 0 && 
              item.sizes && 
              item.selectedSizes.length < item.sizes.length;
              
            const colorMap: Record<string, { bg: string; text: string }> = {
              blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
              orange: { bg: 'bg-orange-100', text: 'text-orange-700' },
              purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
              green: { bg: 'bg-green-100', text: 'text-green-700' },
            };
            const styles = colorMap[color] || colorMap.blue;
              
            return (
              <motion.span
                key={item._id || item.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-all ${
                  isPartialSelection ? 'ring-2 ring-yellow-400 ring-opacity-50' : ''
                } ${styles.bg} ${styles.text}`}
              >
                {item.image && (
                  <img src={item.image} alt="" className="h-5 w-5 rounded-full object-cover" />
                )}
                <span>{item.name}{sizeText}</span>
                <button 
                  onClick={() => removeSelection(type, item._id || item.id)} 
                  className="hover:opacity-70"
                >
                  <PiX className="h-3.5 w-3.5" />
                </button>
              </motion.span>
            );
          })}
        </div>
        
        {type === 'products' && items.length > 0 && (
          <div className="text-xs text-gray-500 mt-2 flex items-center gap-4 flex-wrap">
            <span>
              Total products: <span className="font-medium">{items.length}</span>
            </span>
            {items.some(item => item.selectedSizes && item.selectedSizes.length > 0) && (
              <span>
                Sizes selected: <span className="font-medium">
                  {items.reduce((total, item) => 
                    total + (item.selectedSizes ? item.selectedSizes.length : 0), 0)
                  }
                </span>
              </span>
            )}
            {items.some(item => item.selectedSizes && item.selectedSizes.length === 0) && (
              <span className="flex items-center gap-1">
                <PiWarning className="h-3 w-3 text-amber-500" />
                Some products apply to all sizes
              </span>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  // Options for applyTo
  const options = [
    { 
      value: 'all', 
      label: 'All Products', 
      description: 'Apply to entire store', 
      icon: PiDesktop,
      color: 'green'
    },
    { 
      value: 'specific_products', 
      label: 'Specific Products', 
      description: 'Select individual products', 
      icon: PiPencil,
      color: 'blue'
    },
    { 
      value: 'specific_categories', 
      label: 'Categories', 
      description: 'Target product categories', 
      icon: PiFunnel,
      color: 'orange'
    },
    { 
      value: 'specific_brands', 
      label: 'Brands', 
      description: 'Target specific brands', 
      icon: PiTag,
      color: 'purple'
    },
  ];

  const renderSelector = () => {
    if (formData.applyTo === 'specific_products' && loadingProducts) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <PiSpinner className="h-10 w-10 text-primary" />
          </motion.div>
          <p className="mt-4 text-sm text-gray-500">Loading products...</p>
        </div>
      );
    }

    if (formData.applyTo === 'specific_categories' && loadingCategories) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <PiSpinner className="h-10 w-10 text-primary" />
          </motion.div>
          <p className="mt-4 text-sm text-gray-500">Loading categories...</p>
        </div>
      );
    }

    if (formData.applyTo === 'specific_brands' && loadingBrands) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <PiSpinner className="h-10 w-10 text-primary" />
          </motion.div>
          <p className="mt-4 text-sm text-gray-500">Loading brands...</p>
        </div>
      );
    }

    // Show empty state if no data
    if (formData.applyTo === 'specific_products' && products.length === 0) {
      return (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <PiWarningCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No products found</p>
          <p className="text-xs text-gray-400 mt-1">Create products in your inventory to see them here</p>
        </div>
      );
    }

    if (formData.applyTo === 'specific_categories' && categories.length === 0 && subcategories.length === 0) {
      return (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <PiWarningCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No categories found</p>
        </div>
      );
    }

    if (formData.applyTo === 'specific_brands' && brands.length === 0) {
      return (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <PiWarningCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No brands found</p>
        </div>
      );
    }

    // Products Selector
    if (formData.applyTo === 'specific_products') {
       return (
         <div className="space-y-4">
           {/* Selected Items */}
           {renderSelectedItems('products', formData.selectedProducts || [], 'blue')}
           
           {/* Filters */}
          <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-xl">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-200 pl-10 pr-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">All Brands</option>
              {brands.map(brand => (
                <option key={brand._id} value={brand._id}>{brand.name}</option>
              ))}
            </select>
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('list')}
                className={`h-10 w-10 flex items-center justify-center rounded-lg border ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-white text-gray-500'}`}
              >
                <PiList className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`h-10 w-10 flex items-center justify-center rounded-lg border ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-white text-gray-500'}`}
              >
                <PiDesktop className="h-4 w-4" />
              </button>
            </div>
          </div>

        {/* Enhanced Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <PiFunnel className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Filters:</span>
          </div>
          
          {formData.applyTo === 'specific_products' && (
            <>
              {filterCategory && (
                <Badge variant="flat" className="bg-blue-100 text-blue-700">
                  Category: {categories.find(c => c._id === filterCategory)?.name || filterCategory}
                  <button 
                    onClick={() => setFilterCategory('')} 
                    className="ml-1 hover:text-blue-900"
                  >
                    <PiX className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {filterBrand && (
                <Badge variant="flat" className="bg-purple-100 text-purple-700">
                  Brand: {brands.find(b => b._id === filterBrand)?.name || filterBrand}
                  <button 
                    onClick={() => setFilterBrand('')} 
                    className="ml-1 hover:text-purple-900"
                  >
                    <PiX className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              
              {searchQuery && (
                <Badge variant="flat" className="bg-green-100 text-green-700">
                  Search: "{searchQuery}"
                  <button 
                    onClick={() => setSearchQuery('')} 
                    className="ml-1 hover:text-green-900"
                  >
                    <PiX className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </>
          )}
          
          {formData.applyTo === 'specific_categories' && filterCategory && (
            <Badge variant="flat" className="bg-orange-100 text-orange-700">
              Parent: {categories.find(c => c._id === filterCategory)?.name || filterCategory}
              <button 
                onClick={() => setFilterCategory('')} 
                className="ml-1 hover:text-orange-900"
              >
                <PiX className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {formData.selectedProducts?.length > 0 && (
            <button
              onClick={() => {
                // Clear all selections except the applyTo setting
                onChange('selectedProducts', []);
                onChange('selectedCategories', []);
                onChange('selectedSubcategories', []);
                onChange('selectedBrands', []);
              }}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <PiEraser className="h-3 w-3" />
              Clear All Selections
            </button>
          )}
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-blue-50 rounded-lg p-2">
            <div className="font-medium text-blue-800">Total Items</div>
            <div className="text-blue-600">
              {formData.applyTo === 'specific_products' && products.length}{' '}
              {formData.applyTo === 'specific_categories' && (categories.length + subcategories.length)}{' '}
              {formData.applyTo === 'specific_brands' && brands.length}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-2">
            <div className="font-medium text-green-800">Selected</div>
            <div className="text-green-600">
              {getSelectionCount()} of {getAllItemCount()} items
            </div>
          </div>
        </div>

          {/* Results Count */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Showing {filteredProducts.length} of {products.length} products</span>
            <button
              onClick={() => handleSelectAll('products')}
              className="text-primary hover:underline"
            >
              {selectAll ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Product List/Grid */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <PiWarningCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No products found</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-xl">
              {filteredProducts.map((product) => (
                <motion.div
                  key={product._id || product.id}
                  initial={{ scale: 1 }}
                  whileHover={{ scale: 1.005 }}
                  whileTap={{ scale: 0.995 }}
                  className={`w-full flex items-center justify-between p-4 text-left transition-all ${
                    isSelected('products', product) 
                      ? 'bg-blue-50 border border-blue-300' 
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                  onClick={() => handleSelectItem('products', product)}
                >
                  <div className="flex items-center gap-4">
                    {product.images?.[0] ? (
                      <img src={product.images[0].url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-gray-100 flex items-center justify-center">
                        <PiGift className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">{product.category}</span>
                          {product.brand && (
                            <span className="text-xs text-gray-400">• {product.brand}</span>
                          )}
                          {product.sizes?.length > 0 && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-blue-500">• {product.sizes.length} size{product.sizes.length > 1 ? 's' : ''}</span>
                              <div className="relative z-10">
                                <motion.button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenSizeDropdown(openSizeDropdown === product._id ? null : product._id);
                                  }}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                                >
                                  <PiCaretDown className={`w-3 h-3 transition-transform ${openSizeDropdown === product._id ? 'rotate-180' : ''}`} />
                                  Select
                                </motion.button>

                                {/* Size dropdown */}
                                <AnimatePresence>
                                  {openSizeDropdown === product._id && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.9, y: -5 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.9, y: -5 }}
                                      transition={{ duration: 0.15 }}
                                      className="absolute top-full right-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
                                    >
                                      <div className="p-3 bg-blue-50 border-b border-blue-100">
                                        <p className="font-medium text-blue-800 text-sm">Select sizes for {product.name}</p>
                                      </div>
                                      <div className="max-h-48 overflow-y-auto">
                                        <div className="p-2">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleSizeSelection(product, []); // Empty array means all sizes
                                            }}
                                            className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-colors ${
                                              isAllSizesSelected(product._id) 
                                                ? 'bg-green-50 text-green-700 border border-green-200'
                                                : 'hover:bg-gray-50'
                                            }`}
                                          >
                                            <span className="font-medium">All sizes</span>
                                            {isAllSizesSelected(product._id) && <PiCheck className="w-4 h-4 text-green-600" />}
                                          </button>
                                          <div className="h-px bg-gray-200 my-2" />
                                          {product.sizes.map((size: any) => (
                                            <button
                                              key={size._id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const currentSizes = isSelected('products', product) && formData.selectedProducts.find((p: any) => p._id === product._id)?.selectedSizes || [];
                                                const updatedSizes = isSizeSelected(product._id, size._id)
                                                  ? currentSizes.filter((id: string) => id !== size._id)
                                                  : [...currentSizes, size._id];
                                                handleSizeSelection(product, updatedSizes);
                                              }}
                                              className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-colors ${
                                                isSizeSelected(product._id, size._id)
                                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                  : 'hover:bg-gray-50'
                                              }`}
                                            >
                                              <span className="font-medium">{size.displayName || size.size}</span>
                                              <span className="text-gray-500 text-xs">₦{size.sellingPrice?.toLocaleString() || '0'}</span>
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      <div className="p-3 border-t border-gray-100 bg-gray-50">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelectItem('products', product);
                                          }}
                                          className="w-full px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
                                        >
                                          {isSelected('products', product) ? 'Remove from selection' : 'Add to selection'}
                                        </button>
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          )}
                    </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        ₦{product.basePrice?.toLocaleString() || product.price?.toLocaleString() || '0'}
                      </div>
                      {product.stockQuantity !== undefined && (
                        <div className={`text-xs ${product.stockQuantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {product.stockQuantity > 0 ? `${product.stockQuantity} in stock` : 'Out of stock'}
                        </div>
                      )}
                      {product.sizes?.length > 0 && (
                        <div className="text-xs text-gray-400">
                          Min: ₦{Math.min(...product.sizes.map((s: any) => s.sellingPrice || 0)).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected('products', product) ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {isSelected('products', product) && <PiCheck className="h-4 w-4 text-white" />}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto p-2">
              {filteredProducts.map((product) => (
                <motion.div
                  key={product._id || product.id}
                  initial={{ scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative rounded-xl border-2 p-3 text-left transition-all ${
                    isSelected('products', product) 
                      ? 'border-blue-500 bg-blue-50 shadow-md' 
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}
                  onClick={() => handleSelectItem('products', product)}
                >
                  {product.images?.[0] ? (
                    <img src={product.images[0].url} alt="" className="h-24 w-full rounded-lg object-cover mb-2" />
                  ) : (
                    <div className="h-24 w-full rounded-lg bg-gray-100 flex items-center justify-center mb-2">
                      <PiGift className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div className="font-medium text-gray-900 text-sm truncate">{product.name}</div>
                  <div className="font-semibold text-gray-900 mt-1">
                    ₦{product.basePrice?.toLocaleString() || product.price?.toLocaleString() || '0'}
                  </div>
                  {product.sizes?.length > 0 && (
                    <div className="mt-1">
                      <motion.button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenSizeDropdown(openSizeDropdown === product._id ? null : product._id);
                        }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                      >
                        <PiCaretDown className={`w-3 h-3 transition-transform ${openSizeDropdown === product._id ? 'rotate-180' : ''}`} />
                        Sizes
                      </motion.button>

                      {/* Size dropdown */}
                      <AnimatePresence>
                        {openSizeDropdown === product._id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50"
                          >
                            <div className="p-3 bg-blue-50 border-b border-blue-100">
                              <p className="font-medium text-blue-800 text-sm">Select sizes for {product.name}</p>
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              <div className="p-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSizeSelection(product, []); // Empty array means all sizes
                                  }}
                                  className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-colors ${
                                    isAllSizesSelected(product._id) 
                                      ? 'bg-green-50 text-green-700 border border-green-200'
                                      : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <span className="font-medium">All sizes</span>
                                  {isAllSizesSelected(product._id) && <PiCheck className="w-4 h-4 text-green-600" />}
                                </button>
                                <div className="h-px bg-gray-200 my-2" />
                                {product.sizes.map((size: any) => (
                                  <button
                                    key={size._id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const currentSizes = isSelected('products', product) && formData.selectedProducts.find((p: any) => p._id === product._id)?.selectedSizes || [];
                                      const updatedSizes = isSizeSelected(product._id, size._id)
                                        ? currentSizes.filter((id: string) => id !== size._id)
                                        : [...currentSizes, size._id];
                                      handleSizeSelection(product, updatedSizes);
                                    }}
                                    className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-colors ${
                                      isSizeSelected(product._id, size._id)
                                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                        : 'hover:bg-gray-50'
                                    }`}
                                  >
                                    <span className="font-medium">{size.displayName || size.size}</span>
                                    <span className="text-gray-500 text-xs">₦{size.sellingPrice?.toLocaleString() || '0'}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="p-3 border-t border-gray-100 bg-gray-50">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectItem('products', product);
                                }}
                                className="w-full px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors"
                              >
                                {isSelected('products', product) ? 'Remove from selection' : 'Add to selection'}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  {isSelected('products', product) && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <PiCheck className="h-3 w-3 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Categories Selector
    if (formData.applyTo === 'specific_categories') {
      return (
        <div className="space-y-4">
          {/* Selected Items */}
          {renderSelectedItems('categories', formData.selectedCategories || [], 'orange')}
          {formData.selectedSubcategories?.length > 0 && renderSelectedItems('subcategories', formData.selectedSubcategories, 'orange')}

          {/* Categories with Subcategories */}
          <div className="space-y-6">
            {filteredCategories.map((cat) => {
              const catSubcategories = filteredSubcategories.filter(s => s.parent === cat._id || s.parent === cat._id?.toString());
              return (
                <div key={cat._id} className="space-y-2">
                  <motion.button
                    type="button"
                    onClick={() => handleSelectItem('categories', cat)}
                    whileHover={{ scale: 1.01 }}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected('categories', cat) 
                        ? 'bg-orange-50 border-orange-400' 
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        isSelected('categories', cat) ? 'bg-orange-100' : 'bg-gray-100'
                      }`}>
                        <PiFunnel className={`h-5 w-5 ${isSelected('categories', cat) ? 'text-orange-600' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{cat.name}</div>
                        <div className="text-xs text-gray-500">{cat.description || 'No description'}</div>
                      </div>
                    </div>
                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected('categories', cat) ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                    }`}>
                      {isSelected('categories', cat) && <PiCheck className="h-4 w-4 text-white" />}
                    </div>
                  </motion.button>

                  {/* Subcategories */}
                  {catSubcategories.length > 0 && (
                    <div className="ml-8 grid grid-cols-2 md:grid-cols-3 gap-2">
                      {catSubcategories.map((sub) => (
                        <motion.button
                          key={sub._id}
                          type="button"
                          onClick={() => handleSelectItem('subcategories', sub)}
                          whileHover={{ scale: 1.02 }}
                          className={`p-3 rounded-lg border text-left text-sm transition-all ${
                            isSelected('subcategories', sub)
                              ? 'bg-orange-100 border-orange-400 text-orange-800'
                              : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {sub.name}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Brands Selector
    if (formData.applyTo === 'specific_brands') {
      return (
        <div className="space-y-4">
          {/* Selected Items */}
          {renderSelectedItems('brands', formData.selectedBrands || [], 'purple')}

          {/* Brands Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredBrands.map((brand) => (
              <motion.button
                key={brand._id}
                type="button"
                onClick={() => handleSelectItem('brands', brand)}
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={`relative rounded-xl border-2 p-4 text-center transition-all ${
                  isSelected('brands', brand) 
                    ? 'bg-purple-50 border-purple-400 shadow-md' 
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                {brand.logo ? (
                  <img src={brand.logo} alt={brand.name} className="h-16 w-16 mx-auto rounded-lg object-contain bg-white mb-2" />
                ) : (
                  <div className="h-16 w-16 mx-auto rounded-lg bg-gray-100 flex items-center justify-center mb-2">
                    <PiTag className="h-8 w-8 text-gray-400" />
                  </div>
                )}
                <div className="font-medium text-gray-900 text-sm">{brand.name}</div>
                {brand.countryOfOrigin && (
                  <div className="text-xs text-gray-500 mt-1">{brand.countryOfOrigin}</div>
                )}
                {isSelected('brands', brand) && (
                  <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-purple-500 flex items-center justify-center">
                    <PiCheck className="h-3 w-3 text-white" />
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <motion.div variants={containerVariants} className="space-y-6">
      {/* Header Card */}
      <motion.div 
        variants={itemVariants}
        className="rounded-2xl bg-gradient-to-r from-blue-50 via-blue-25 to-blue-50 border border-blue-200/50 p-6"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <PiUsers className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Target Products</h3>
              <p className="text-sm text-gray-600 mt-1">Choose which products this promotion applies to</p>
            </div>
          </div>
          <Badge variant="flat" className="bg-blue-100 text-blue-700">
            Step 2 of 5
          </Badge>
        </div>
      </motion.div>

      {/* Apply To Options */}
      <motion.div variants={itemVariants} className="space-y-4">
        <label className="text-sm font-semibold text-gray-700">Apply Promotion To</label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {options.map((option, idx) => (
            <motion.button
              key={option.value}
              type="button"
              onClick={() => {
                onChange('applyTo', option.value);
                setSearchQuery('');
                setFilterCategory('');
                setFilterBrand('');
              }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className={`relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all ${
                formData.applyTo === option.value 
                  ? `border-${option.color}-500 bg-${option.color}-50 shadow-md` 
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
              }`}
              style={{
                borderColor: formData.applyTo === option.value ? `var(--${option.color}-500)` : undefined,
                backgroundColor: formData.applyTo === option.value ? `var(--${option.color}-50)` : undefined,
              }}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg mb-3 ${
                formData.applyTo === option.value ? `bg-${option.color}-100` : 'bg-gray-100'
              }`} style={{
                backgroundColor: formData.applyTo === option.value ? `var(--${option.color}-100)` : undefined,
              }}>
                <option.icon className={`h-5 w-5 ${
                  formData.applyTo === option.value ? `text-${option.color}-600` : 'text-gray-500'
                }`} style={{
                  color: formData.applyTo === option.value ? `var(--${option.color}-600)` : undefined,
                }} />
              </div>
              <span className={`font-semibold ${
                formData.applyTo === option.value ? `text-${option.color}-700` : 'text-gray-700'
              }`} style={{
                color: formData.applyTo === option.value ? `var(--${option.color}-700)` : undefined,
              }}>
                {option.label}
              </span>
              <span className="text-xs text-gray-500 mt-1">{option.description}</span>
              
              {formData.applyTo === option.value && (
                <motion.div
                  layoutId="selectedIndicator"
                  className={`absolute top-2 right-2 h-3 w-3 rounded-full bg-${option.color}-500`}
                  style={{ backgroundColor: `var(--${option.color}-500)` }}
                />
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Selector Panel */}
      {formData.applyTo !== 'all' ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border-2 border-gray-200 bg-white overflow-hidden"
        >
          {/* Panel Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <h4 className="font-semibold text-gray-900">
                Select {formData.applyTo === 'specific_products' ? 'Products' : 
                       formData.applyTo === 'specific_categories' ? 'Categories' : 'Brands'}
              </h4>
              <Badge variant="flat" className="bg-gray-200 text-gray-700">
                {getSelectionCount()} selected
              </Badge>
            </div>
            {getSelectionCount() > 0 && (
              <button
                onClick={() => {
                  if (formData.applyTo === 'specific_products') onChange('selectedProducts', []);
                  else if (formData.applyTo === 'specific_categories') { onChange('selectedCategories', []); onChange('selectedSubcategories', []); }
                  else onChange('selectedBrands', []);
                }}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Panel Content */}
          <div className="p-6">
            {renderSelector()}
          </div>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 p-6"
        >
          <div className="flex items-center gap-4">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100"
            >
              <PiCheckCircle className="h-7 w-7 text-green-600" />
            </motion.div>
            <div className="flex-1">
              <h4 className="font-semibold text-green-900">All Products Eligible</h4>
              <p className="text-sm text-green-700 mt-1">This promotion will automatically apply to all products in your store</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">{products.length}</div>
              <div className="text-xs text-green-600">Products</div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function ScheduleSection({ formData, onChange, errors, touched }: SectionProps) {
  // Calculate duration in days
  const duration = useMemo(() => {
    if (!formData.startDate || !formData.endDate) return null;
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  }, [formData.startDate, formData.endDate]);

  // Enhanced time validation
  const validateSchedule = useCallback(() => {
    if (!formData.startDate || !formData.endDate) return true;
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    
    return end >= start;
  }, [formData.startDate, formData.endDate]);

  return (
    <motion.div variants={containerVariants} className="space-y-8">
      <motion.div variants={itemVariants} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">Start Date</label>
          <Input
            type="date"
            value={String(formData.startDate || '')}
            onChange={(e) => onChange('startDate', e.target.value)}
            className={!validateSchedule() && formData.startDate && formData.endDate ? 'border-red-500' : ''}
          />
          {errors?.startDate && touched?.startDate && (
            <motion.p 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1 text-sm text-red-500"
            >
              <PiWarningCircle className="h-4 w-4" />
              {errors.startDate}
            </motion.p>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">End Date</label>
          <Input
            type="date"
            value={String(formData.endDate || '')}
            onChange={(e) => onChange('endDate', e.target.value)}
            min={formData.startDate}
            className={!validateSchedule() && formData.startDate && formData.endDate ? 'border-red-500' : ''}
          />
          <p className="text-xs text-gray-500">Leave empty for no expiration</p>
          {!validateSchedule() && formData.startDate && formData.endDate && (
            <motion.p 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-1 text-sm text-red-500"
            >
              <PiWarningCircle className="h-4 w-4" />
              End date must be after start date
            </motion.p>
          )}
        </div>
      </motion.div>

      <motion.label 
        variants={itemVariants}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="flex cursor-pointer items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-5"
      >
        <input 
          type="checkbox" 
          checked={formData.isScheduled || false} 
          onChange={(e) => onChange('isScheduled', e.target.checked)} 
          className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" 
        />
        <div className="flex-1">
          <span className="text-sm font-medium text-gray-700">Schedule for future activation</span>
          <p className="text-xs text-gray-500">Auto-activate at start date, auto-deactivate at end date</p>
        </div>
      </motion.label>

      <motion.div 
        variants={itemVariants}
        className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h4 className="flex items-center gap-2 font-semibold text-gray-900">
            <PiTimer className="h-5 w-5 text-primary" />
            Schedule Preview
          </h4>
          {duration && (
            <Badge variant="flat" className="bg-primary/10 text-primary">
              {duration} days
            </Badge>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {formData.startDate && (
            <div className="flex items-center gap-2">
              <Badge variant="flat" color="success">
                Start: {new Date(formData.startDate).toLocaleDateString()}
              </Badge>
            </div>
          )}
          
          {formData.endDate && (
            <div className="flex items-center gap-2">
              <Badge variant="flat" color="warning">
                End: {new Date(formData.endDate).toLocaleDateString()}
              </Badge>
            </div>
          )}
          
          {!formData.startDate && !formData.endDate && (
            <p className="text-sm text-gray-500">No dates selected - promotion activates immediately</p>
          )}
        </div>
        
        {formData.isScheduled && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 text-blue-700">
              <PiClock className="h-4 w-4" />
              <span className="text-sm font-medium">Scheduled Activation Enabled</span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              This promotion will automatically activate on {formData.startDate ? new Date(formData.startDate).toLocaleDateString() : 'the set start date'} 
              {formData.endDate && ` and deactivate on ${new Date(formData.endDate).toLocaleDateString()}`}
            </p>
          </div>
        )}
      </motion.div>

      {/* Enhanced Schedule Presets */}
      <motion.div 
        variants={itemVariants}
        className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="flex items-center gap-2 font-semibold text-purple-900">
            <PiLightning className="h-5 w-5 text-purple-600" />
            Quick Schedule Presets
          </h4>
          <Badge variant="flat" className="bg-purple-100 text-purple-700">
            Recommended
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Today Only', days: 0, color: 'from-red-500 to-orange-500' },
            { label: 'This Week', days: 7, color: 'from-blue-500 to-cyan-500' },
            { label: 'Two Weeks', days: 14, color: 'from-green-500 to-emerald-500' },
            { label: 'One Month', days: 30, color: 'from-purple-500 to-violet-500' },
          ].map((preset, index) => (
            <motion.button
              key={preset.label}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                const startDate = new Date();
                const endDate = new Date();
                endDate.setDate(startDate.getDate() + preset.days);
                
                onChange('startDate', startDate.toISOString().split('T')[0]);
                onChange('endDate', endDate.toISOString().split('T')[0]);
                toast.success(`Applied ${preset.label} schedule`);
              }}
              className={`rounded-xl bg-gradient-to-br ${preset.color} p-3 text-center text-white shadow-md transition-all hover:shadow-lg`}
            >
              <div className="font-bold text-sm">{preset.label}</div>
              <div className="text-xs opacity-90 mt-1">{preset.days > 0 ? `${preset.days} days` : '24 hours'}</div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Advanced Scheduling */}
      <motion.div 
        variants={itemVariants}
        className="rounded-xl border border-gray-200 bg-gray-50 p-5"
      >
        <details className="group">
          <summary className="flex cursor-pointer items-center justify-between list-none">
            <div className="flex items-center gap-2">
              <PiFlask className="h-5 w-5 text-gray-500" />
              <span className="font-medium text-gray-700">Advanced Scheduling</span>
            </div>
            <PiCaretDown className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" />
          </summary>
          
          <div className="mt-4 space-y-4 pl-7">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Daily Start Time
                </label>
                <Input
                  type="time"
                  value={formData.dailyStartTime || ''}
                  onChange={(e) => onChange('dailyStartTime', e.target.value)}
                  placeholder="09:00"
                />
                <p className="text-xs text-gray-500 mt-1">Daily activation time</p>
              </div>
              
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Daily End Time
                </label>
                <Input
                  type="time"
                  value={formData.dailyEndTime || ''}
                  onChange={(e) => onChange('dailyEndTime', e.target.value)}
                  placeholder="17:00"
                />
                <p className="text-xs text-gray-500 mt-1">Daily deactivation time</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    const activeDays = formData.weeklySchedule || [];
                    const newDays = activeDays.includes(day) 
                      ? activeDays.filter((d: string) => d !== day)
                      : [...activeDays, day];
                    onChange('weeklySchedule', newDays);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    (formData.weeklySchedule || []).includes(day)
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {day.substring(0, 3)}
                </button>
              ))}
              <div className="flex-1 text-xs text-gray-500">
                Select days when this promotion should be active
              </div>
            </div>
          </div>
        </details>
      </motion.div>
    </motion.div>
  );
}

function DisplaySection({ formData, onChange }: SectionProps) {
  return (
    <motion.div variants={containerVariants} className="space-y-8">
      <motion.div variants={itemVariants} className="space-y-4">
        <label className="text-sm font-semibold text-gray-700">Badge Display</label>
        <div className="rounded-xl border border-gray-200 p-5">
          <label className="flex cursor-pointer items-start gap-4">
            <input 
              type="checkbox" 
              checked={formData.badge?.enabled ?? true} 
              onChange={(e) => onChange('badge', { ...formData.badge, enabled: e.target.checked })} 
              className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" 
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-700">Show badge on products</span>
              <p className="text-xs text-gray-500">Display a visual badge on products with this promotion</p>
            </div>
            {formData.badge?.enabled && (
              <Badge variant="flat" className="bg-red-100 text-red-700 font-bold">
                {formData.badge.text || 'SALE'}
              </Badge>
            )}
          </label>
          
          <AnimatePresence>
            {formData.badge?.enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5 pl-9"
              >
                <Input
                  type="text"
                  value={formData.badge?.text || ''}
                  onChange={(e) => onChange('badge', { ...formData.badge, text: e.target.value })}
                  placeholder="SALE"
                  className="max-w-xs"
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {['SALE', 'DEAL', 'HOT', 'NEW', 'OFF', '50% OFF'].map((preset) => (
                    <motion.button
                      key={preset}
                      type="button"
                      onClick={() => onChange('badge', { ...formData.badge, text: preset })}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                        formData.badge?.text === preset 
                          ? 'bg-primary text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {preset}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-4">
        <label className="text-sm font-semibold text-gray-700">Display Options</label>
        <div className="space-y-3 rounded-xl border border-gray-200 p-4">
          {[
            { key: 'showCountdown', label: 'Show countdown timer', description: 'Display time remaining until promotion ends', icon: PiTimer },
            { key: 'showRemainingStock', label: 'Show remaining stock', description: 'Display available quantity', icon: PiUsers },
            { key: 'highlightOnProductPage', label: 'Highlight on product pages', description: 'Add visual emphasis to promoted products', icon: PiStar },
          ].map((option, index) => (
            <motion.label
              key={option.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex cursor-pointer items-start gap-3 rounded-lg p-2 -mx-2 hover:bg-gray-50"
            >
              <input 
                type="checkbox" 
                checked={!!formData[option.key]} 
                onChange={(e) => onChange(option.key, e.target.checked)} 
                className="mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary" 
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700">{option.label}</span>
                <p className="text-xs text-gray-500">{option.description}</p>
              </div>
              <option.icon className="h-5 w-5 text-gray-400" />
            </motion.label>
          ))}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <h4 className="mb-4 font-semibold text-gray-900">Live Preview</h4>
        <motion.div 
          whileHover={{ scale: 1.01 }}
          className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm border border-gray-100"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-gray-100 to-gray-200">
            <PiGift className="h-8 w-8 text-gray-400" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900">{formData.name || 'Promotion Name'}</div>
            <div className="text-sm text-gray-500">{formData.description || 'No description'}</div>
            {formData.showCountdown && (
              <div className="mt-1 flex items-center gap-1 text-xs text-orange-600">
                <PiTimer className="h-3 w-3" />
                Ends in 2 days
              </div>
            )}
          </div>
          {formData.badge?.enabled && formData.badge?.text && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-bold text-white shadow-md"
            >
              {formData.badge.text}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  PiArrowRightBold, 
  PiEye, 
  PiEyeSlash, 
  PiEnvelope, 
  PiLockKey, 
  PiUser, 
  PiPhone,
  PiCheckCircle,
  PiWarningCircle,
} from 'react-icons/pi';
import { Button, Text } from 'rizzui';
import { Form } from '@core/ui/form';
import { routes } from '@/config/routes';
import { SignUpSchema, signUpSchema } from '@/validators/signup.schema';
import toast from 'react-hot-toast';
import { SubmitHandler } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';

// Server API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const initialValues: SignUpSchema = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
  isAgreed: false,
};

export default function SignUpForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'verification'>('form');
  const [formData, setFormData] = useState<SignUpSchema | null>(null);

  const onSubmit: SubmitHandler<SignUpSchema> = async (data) => {
    setIsLoading(true);
    setAuthError(null);
    
    try {
      // Step 1: Send verification code
      const response = await fetch(`${API_URL}/api/verification/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          password: data.password,
          phoneNumber: data.phoneNumber,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setIsLoading(false);
        const errorMessage = result.message || 'Failed to send verification code. Please try again.';
        setAuthError(errorMessage);
        return;
      }

      // Store form data for later
      setFormData(data);
      
      // Move to verification step
      setStep('verification');
      setIsLoading(false);
      
      toast.success('Verification code sent! Please check your email.');
      
      // In development, show the code
      if (result.data.code) {
        console.log('Development mode - Verification code:', result.data.code);
      }
    } catch (error: any) {
      setIsLoading(false);
      setAuthError('An unexpected error occurred. Please try again.');
      console.error('Sign up error:', error);
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {step === 'verification' && formData ? (
          <motion.div
            key="verification"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <VerificationStep
              email={formData.email}
              onBack={() => setStep('form')}
              onSuccess={() => {
                toast.success('Account created successfully! Welcome to Drinksharbour.');
                router.push(routes.signIn);
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Error Alert */}
            {authError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
              >
                <PiWarningCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">Registration Error</p>
                  <p className="text-sm text-red-600 mt-0.5">{authError}</p>
                </div>
                <button 
                  onClick={() => setAuthError(null)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </motion.div>
            )}

            <Form<SignUpSchema>
              validationSchema={signUpSchema}
              onSubmit={onSubmit}
              useFormProps={{
                defaultValues: initialValues,
              }}
            >
              {({ register, formState: { errors }, watch }) => (
                <div className="space-y-5">
                  {/* Name Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* First Name */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <PiUser className="w-4 h-4 text-gray-400" />
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="John"
                          className={`
                            w-full px-4 py-3.5 rounded-xl border-2 bg-white
                            transition-all duration-200 ease-in-out
                            placeholder:text-gray-400
                            focus:outline-none focus:ring-0
                            ${errors.firstName
                              ? 'border-red-300 focus:border-red-500 bg-red-50/30' 
                              : 'border-gray-200 focus:border-blue-500 hover:border-gray-300'
                            }
                            ${watch('firstName') && !errors.firstName ? 'border-green-300 bg-green-50/10' : ''}
                          `}
                          {...register('firstName')}
                          disabled={isLoading}
                        />
                        {watch('firstName') && !errors.firstName && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {errors.firstName && (
                        <p className="text-sm text-red-600 flex items-center gap-1.5">
                          <PiWarningCircle className="w-4 h-4" />
                          {errors.firstName.message}
                        </p>
                      )}
                    </div>

                    {/* Last Name */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <PiUser className="w-4 h-4 text-gray-400" />
                        Last Name
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Doe"
                          className={`
                            w-full px-4 py-3.5 rounded-xl border-2 bg-white
                            transition-all duration-200 ease-in-out
                            placeholder:text-gray-400
                            focus:outline-none focus:ring-0
                            ${errors.lastName
                              ? 'border-red-300 focus:border-red-500 bg-red-50/30' 
                              : 'border-gray-200 focus:border-blue-500 hover:border-gray-300'
                            }
                            ${watch('lastName') && !errors.lastName ? 'border-green-300 bg-green-50/10' : ''}
                          `}
                          {...register('lastName')}
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <PiEnvelope className="w-4 h-4 text-gray-400" />
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        placeholder="admin@company.com"
                        className={`
                          w-full px-4 py-3.5 rounded-xl border-2 bg-white
                          transition-all duration-200 ease-in-out
                          placeholder:text-gray-400
                          focus:outline-none focus:ring-0
                          ${errors.email
                            ? 'border-red-300 focus:border-red-500 bg-red-50/30' 
                            : 'border-gray-200 focus:border-blue-500 hover:border-gray-300'
                          }
                          ${watch('email') && !errors.email ? 'border-green-300 bg-green-50/10' : ''}
                        `}
                        {...register('email')}
                        disabled={isLoading}
                      />
                      {watch('email') && !errors.email && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {errors.email && (
                      <p className="text-sm text-red-600 flex items-center gap-1.5">
                        <PiWarningCircle className="w-4 h-4" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <PiPhone className="w-4 h-4 text-gray-400" />
                      Phone Number
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        placeholder="+234 800 000 0000"
                        className={`
                          w-full px-4 py-3.5 rounded-xl border-2 bg-white
                          transition-all duration-200 ease-in-out
                          placeholder:text-gray-400
                          focus:outline-none focus:ring-0
                          ${errors.phoneNumber
                            ? 'border-red-300 focus:border-red-500 bg-red-50/30' 
                            : 'border-gray-200 focus:border-blue-500 hover:border-gray-300'
                          }
                          ${watch('phoneNumber') && !errors.phoneNumber ? 'border-green-300 bg-green-50/10' : ''}
                        `}
                        {...register('phoneNumber')}
                        disabled={isLoading}
                      />
                    </div>
                    {errors.phoneNumber && (
                      <p className="text-sm text-red-600 flex items-center gap-1.5">
                        <PiWarningCircle className="w-4 h-4" />
                        {errors.phoneNumber.message}
                      </p>
                    )}
                  </div>

                  {/* Password Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Password */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <PiLockKey className="w-4 h-4 text-gray-400" />
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min. 8 characters"
                          className={`
                            w-full px-4 py-3.5 rounded-xl border-2 bg-white
                            transition-all duration-200 ease-in-out
                            placeholder:text-gray-400
                            focus:outline-none focus:ring-0
                            ${errors.password
                              ? 'border-red-300 focus:border-red-500 bg-red-50/30' 
                              : 'border-gray-200 focus:border-blue-500 hover:border-gray-300'
                            }
                          `}
                          {...register('password')}
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <PiEyeSlash className="w-5 h-5" />
                          ) : (
                            <PiEye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p className="text-sm text-red-600 flex items-center gap-1.5">
                          <PiWarningCircle className="w-4 h-4" />
                          {errors.password.message}
                        </p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <PiLockKey className="w-4 h-4 text-gray-400" />
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          className={`
                            w-full px-4 py-3.5 rounded-xl border-2 bg-white
                            transition-all duration-200 ease-in-out
                            placeholder:text-gray-400
                            focus:outline-none focus:ring-0
                            ${errors.confirmPassword
                              ? 'border-red-300 focus:border-red-500 bg-red-50/30' 
                              : watch('confirmPassword') && watch('password') === watch('confirmPassword')
                              ? 'border-green-300 bg-green-50/10'
                              : 'border-gray-200 focus:border-blue-500 hover:border-gray-300'
                            }
                          `}
                          {...register('confirmPassword')}
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                          tabIndex={-1}
                        >
                          {showConfirmPassword ? (
                            <PiEyeSlash className="w-5 h-5" />
                          ) : (
                            <PiEye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      {errors.confirmPassword && (
                        <p className="text-sm text-red-600 flex items-center gap-1.5">
                          <PiWarningCircle className="w-4 h-4" />
                          {errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Terms Agreement */}
                  <div className="space-y-1.5">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative mt-0.5">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          {...register('isAgreed')}
                          disabled={isLoading}
                        />
                        <div className={`w-5 h-5 border-2 rounded-md transition-all flex items-center justify-center ${
                          errors.isAgreed 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-300 peer-checked:bg-blue-500 peer-checked:border-blue-500'
                        }`}>
                          <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <span className={`text-sm leading-relaxed ${errors.isAgreed ? 'text-red-600' : 'text-gray-600 group-hover:text-gray-800'} transition-colors`}>
                        I agree to the{' '}
                        <Link href="/terms" className="font-semibold text-blue-600 hover:text-blue-700 underline">
                          Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link href="/privacy" className="font-semibold text-blue-600 hover:text-blue-700 underline">
                          Privacy Policy
                        </Link>
                      </span>
                    </label>
                    {errors.isAgreed && (
                      <p className="text-sm text-red-600 flex items-center gap-1.5 ml-8">
                        <PiWarningCircle className="w-4 h-4" />
                        {errors.isAgreed.message}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <Button 
                    className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all mt-2"
                    type="submit" 
                    size="lg"
                    isLoading={isLoading}
                    disabled={isLoading}
                  >
                    <span>{isLoading ? 'Sending Code...' : 'Continue'}</span>
                    {!isLoading && <PiArrowRightBold className="ms-2 h-5 w-5" />}
                  </Button>
                </div>
              )}
            </Form>

            {/* Sign In Link */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <Text className="text-center text-sm text-gray-500">
                Already have an admin account?{' '}
                <Link
                  href={routes.signIn}
                  className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Sign In
                </Link>
              </Text>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Verification Step Component with improved animations
function VerificationStep({ 
  email, 
  onBack, 
  onSuccess 
}: { 
  email: string; 
  onBack: () => void; 
  onSuccess: () => void;
}) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(60);
  const [showSuccessPulse, setShowSuccessPulse] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect - properly restart when timer changes
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resendTimer === 60]); // Restart when timer is reset to 60

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if all digits entered
    if (index === 5 && value) {
      const fullCode = [...newCode.slice(0, 5), value].join('');
      if (fullCode.length === 6) {
        // Small delay for better UX
        setTimeout(() => handleVerify(fullCode), 300);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      setError(null);
      
      // Focus last input
      inputRefs.current[5]?.focus();
      
      // Auto-verify after paste
      setTimeout(() => handleVerify(pastedData), 300);
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join('');
    
    if (codeToVerify.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/verification/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          code: codeToVerify,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setIsLoading(false);
        setError(result.message || 'Invalid verification code. Please try again.');
        // Shake animation trigger
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Success!
      setShowSuccessPulse(true);
      setTimeout(() => {
        setIsLoading(false);
        onSuccess();
      }, 500);
    } catch (err) {
      setIsLoading(false);
      setError('An error occurred. Please try again.');
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || isResending) return;

    setIsResending(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_URL}/api/verification/resend-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (result.success) {
        // Reset code inputs
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        
        // Restart timer properly
        setResendTimer(60);
        
        toast.success('New verification code sent! Check your email.');
        
        if (result.data?.code) {
          console.log('Development mode - New code:', result.data.code);
        }
      } else {
        setError(result.message || 'Failed to resend code. Please try again.');
      }
    } catch (err) {
      setError('Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <motion.div 
      className="text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, type: "spring", stiffness: 100 }}
    >
      {/* Animated Icon */}
      <motion.div 
        className="relative mx-auto mb-6"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ 
          type: "spring",
          stiffness: 260,
          damping: 20,
          delay: 0.1 
        }}
      >
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/30">
          <motion.div
            animate={showSuccessPulse ? { 
              scale: [1, 1.2, 1],
              opacity: [1, 0.8, 1]
            } : {}}
            transition={{ duration: 0.5 }}
          >
            <PiEnvelope className="w-10 h-10 text-white" />
          </motion.div>
        </div>
        
        {/* Pulsing rings */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-blue-400"
          animate={{
            scale: [1, 1.3, 1.3],
            opacity: [0.5, 0, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeOut"
          }}
        />
      </motion.div>
      
      <motion.h3 
        className="text-2xl font-bold text-gray-900 mb-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Verify Your Email
      </motion.h3>
      
      <motion.p 
        className="text-gray-600 mb-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        We&apos;ve sent a 6-digit verification code to<br />
        <motion.strong 
          className="text-gray-900 bg-blue-50 px-2 py-1 rounded-lg inline-block mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {email}
        </motion.strong>
      </motion.p>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 overflow-hidden"
          >
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-600">
              <PiWarningCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Code Input */}
      <motion.div 
        className="flex justify-center gap-3 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {code.map((digit, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ 
              delay: 0.5 + index * 0.05,
              type: "spring",
              stiffness: 300
            }}
          >
            <input
              ref={(el) => { inputRefs.current[index] = el; }}
              id={`code-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className={`
                w-14 h-16 text-center text-2xl font-bold rounded-xl border-2
                transition-all duration-200 bg-white
                focus:outline-none focus:ring-4 focus:ring-blue-100
                ${digit ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200'}
                ${error ? 'border-red-300 bg-red-50 focus:ring-red-100' : ''}
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              disabled={isLoading}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Verify Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Button
          onClick={() => handleVerify()}
          className="w-full h-12 text-base font-semibold rounded-xl mb-6 shadow-lg shadow-blue-500/25"
          size="lg"
          isLoading={isLoading}
          disabled={isLoading || code.join('').length !== 6}
        >
          <span>{isLoading ? 'Verifying...' : 'Verify Email'}</span>
          {!isLoading && <PiCheckCircle className="ms-2 h-5 w-5" />}
        </Button>
      </motion.div>

      {/* Resend Code Section */}
      <motion.div 
        className="text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <div className="text-gray-600 mb-2">
          Did not receive the code?
        </div>
        
        <AnimatePresence mode="wait">
          {resendTimer > 0 ? (
            <motion.div
              key="timer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 text-gray-500"
            >
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Resend available in {resendTimer}s</span>
            </motion.div>
          ) : (
            <motion.button
              key="resend"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={handleResend}
              disabled={isResending}
              className="text-blue-600 font-semibold hover:text-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isResending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Resend Code
                </>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Back Button */}
      <motion.button
        onClick={onBack}
        className="mt-8 text-sm text-gray-500 hover:text-gray-700 transition-colors inline-flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        whileHover={{ x: -4 }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Go back to edit details
      </motion.button>
    </motion.div>
  );
}

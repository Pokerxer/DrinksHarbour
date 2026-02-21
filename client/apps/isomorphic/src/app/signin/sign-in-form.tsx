'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiArrowRightBold, 
  PiEye, 
  PiEyeSlash, 
  PiEnvelope, 
  PiLockKey, 
  PiWarningCircle,
  PiShieldCheck,
  PiSpinner
} from 'react-icons/pi';
import { Button, Text } from 'rizzui';
import { Form } from '@core/ui/form';
import { routes } from '@/config/routes';
import { loginSchema, LoginSchema } from '@/validators/login.schema';
import toast from 'react-hot-toast';
import { SubmitHandler } from 'react-hook-form';

const initialValues: LoginSchema = {
  email: '',
  password: '',
  rememberMe: false,
};

// Animation variants
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
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

const errorVariants = {
  hidden: { opacity: 0, height: 0, y: -10 },
  visible: { 
    opacity: 1, 
    height: 'auto', 
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    }
  },
  exit: { 
    opacity: 0, 
    height: 0,
    transition: { duration: 0.2 }
  }
};

const inputVariants = {
  focus: { scale: 1.02, transition: { type: 'spring', stiffness: 400 } },
  blur: { scale: 1 },
};

const shakeVariants = {
  shake: {
    x: [-5, 5, -5, 5, 0],
    transition: { duration: 0.4 }
  }
};

export default function SignInForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [reset, setReset] = useState({});

  const onSubmit: SubmitHandler<LoginSchema> = async (data) => {
    setIsLoading(true);
    setAuthError(null);
    
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
        callbackUrl: routes.dashboard,
      });

      if (result?.error) {
        setIsLoading(false);
        setShake(true);
        setTimeout(() => setShake(false), 400);
        
        // Handle specific error cases
        if (result.error === 'CredentialsSignin') {
          setAuthError('Invalid email or password. Please check your credentials and try again.');
        } else if (result.error.includes('locked')) {
          setAuthError('Your account has been temporarily locked due to multiple failed attempts. Please try again later.');
        } else if (result.error.includes('suspended')) {
          setAuthError('Your account has been suspended. Please contact support.');
        } else if (result.error.includes('inactive')) {
          setAuthError('Your account is inactive. Please contact support to reactivate.');
        } else {
          setAuthError(result.error || 'Authentication failed. Please try again.');
        }
      } else if (result?.ok) {
        toast.success('Welcome back, Admin!');
        router.push(routes.dashboard);
        router.refresh();
      }
    } catch (error) {
      setIsLoading(false);
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setAuthError('An unexpected error occurred. Please try again.');
      console.error('Sign in error:', error);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Error Alert */}
      <AnimatePresence>
        {authError && (
          <motion.div 
            variants={errorVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mb-5 overflow-hidden"
          >
            <motion.div 
              variants={shakeVariants}
              animate={shake ? 'shake' : ''}
              className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
            >
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <PiWarningCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              </motion.div>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Authentication Error</p>
                <p className="text-sm text-red-600 mt-0.5">{authError}</p>
              </div>
              <motion.button 
                onClick={() => setAuthError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <span className="sr-only">Dismiss</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Form<LoginSchema>
        validationSchema={loginSchema}
        resetValues={reset}
        onSubmit={onSubmit}
        useFormProps={{
          defaultValues: initialValues,
        }}
      >
        {({ register, formState: { errors }, watch }) => (
          <motion.div className="space-y-5" variants={containerVariants}>
            {/* Email Field */}
            <motion.div variants={itemVariants} className="space-y-1.5">
              <motion.label 
                className="text-sm font-semibold text-gray-700 flex items-center gap-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <PiEnvelope className="w-4 h-4 text-gray-400" />
                </motion.div>
                Email Address
              </motion.label>
              <motion.div 
                className="relative group"
                whileFocus="focus"
                variants={inputVariants}
              >
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className={`
                    w-full px-4 py-3.5 rounded-xl border-2 bg-white
                    transition-all duration-200 ease-in-out
                    placeholder:text-gray-400
                    focus:outline-none focus:ring-0 focus:scale-[1.01]
                    ${errors.email || authError
                      ? 'border-red-300 focus:border-red-500 bg-red-50/30' 
                      : 'border-gray-200 focus:border-blue-500 hover:border-gray-300'
                    }
                    ${watch('email') && !errors.email ? 'border-green-300 bg-green-50/10' : ''}
                  `}
                  {...register('email')}
                  disabled={isLoading}
                />
                <AnimatePresence>
                  {watch('email') && !errors.email && (
                    <motion.div 
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      initial={{ opacity: 0, scale: 0, x: 10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0, x: 10 }}
                      transition={{ type: 'spring', stiffness: 500 }}
                    >
                      <motion.svg 
                        className="w-5 h-5 text-green-500" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.3 }}
                      >
                        <motion.path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M5 13l4 4L19 7"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                        />
                      </motion.svg>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p 
                    variants={errorVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="text-sm text-red-600 flex items-center gap-1.5"
                  >
                    <PiWarningCircle className="w-4 h-4" />
                    {errors.email.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Password Field */}
            <motion.div variants={itemVariants} className="space-y-1.5">
              <motion.label 
                className="text-sm font-semibold text-gray-700 flex items-center gap-2"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <PiLockKey className="w-4 h-4 text-gray-400" />
                </motion.div>
                Password
              </motion.label>
              <motion.div 
                className="relative group"
                variants={inputVariants}
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className={`
                    w-full px-4 py-3.5 rounded-xl border-2 bg-white
                    transition-all duration-200 ease-in-out
                    placeholder:text-gray-400
                    focus:outline-none focus:ring-0 focus:scale-[1.01]
                    ${errors.password || authError
                      ? 'border-red-300 focus:border-red-500 bg-red-50/30' 
                      : 'border-gray-200 focus:border-blue-500 hover:border-gray-300'
                    }
                    ${watch('password') && !errors.password ? 'border-green-300 bg-green-50/10' : ''}
                  `}
                  {...register('password')}
                  disabled={isLoading}
                />
                <motion.button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                  tabIndex={-1}
                  whileHover={{ scale: 1.1, rotate: 15 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={showPassword ? 'eye' : 'eye-slash'}
                      initial={{ opacity: 0, scale: 0, rotate: -180 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0, rotate: 180 }}
                      transition={{ duration: 0.2 }}
                    >
                      {showPassword ? (
                        <PiEyeSlash className="w-5 h-5" />
                      ) : (
                        <PiEye className="w-5 h-5" />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </motion.button>
              </motion.div>
              <AnimatePresence>
                {errors.password && (
                  <motion.p 
                    variants={errorVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="text-sm text-red-600 flex items-center gap-1.5"
                  >
                    <PiWarningCircle className="w-4 h-4" />
                    {errors.password.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Remember Me & Forgot Password */}
            <motion.div variants={itemVariants} className="flex items-center justify-between">
              <motion.label 
                className="flex items-center gap-2 cursor-pointer group"
                whileHover={{ x: 2 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <div className="relative">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    {...register('rememberMe')}
                    disabled={isLoading}
                  />
                  <motion.div 
                    className="w-5 h-5 border-2 border-gray-300 rounded-md peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all flex items-center justify-center"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <motion.svg 
                      className="w-3 h-3 text-white" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ 
                        pathLength: watch('rememberMe') ? 1 : 0,
                        opacity: watch('rememberMe') ? 1 : 0
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </motion.svg>
                  </motion.div>
                </div>
                <span className="text-sm font-medium text-gray-600 group-hover:text-gray-800 transition-colors">Remember Me</span>
              </motion.label>
              <motion.div
                whileHover={{ x: 2 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Link
                  href={routes.auth.forgotPassword1}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors hover:underline underline-offset-2"
                >
                  Forgot Password?
                </Link>
              </motion.div>
            </motion.div>

            {/* Submit Button */}
            <motion.div variants={itemVariants}>
              <motion.div
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Button 
                  className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all relative overflow-hidden"
                  type="submit" 
                  size="lg"
                  isLoading={isLoading}
                  disabled={isLoading}
                >
                  <AnimatePresence mode="wait">
                    {isLoading ? (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex items-center gap-2"
                      >
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <PiSpinner className="w-5 h-5" />
                        </motion.div>
                        <span>Signing in...</span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="submit"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex items-center"
                      >
                        <span>Sign in to Dashboard</span>
                        <motion.div
                          animate={{ x: [0, 4, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          <PiArrowRightBold className="ms-2 h-5 w-5" />
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </Form>

      {/* Security Notice */}
      <motion.div 
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100"
      >
        <div className="flex items-start gap-3">
          <motion.div 
            className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0"
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            <PiShieldCheck className="w-5 h-5 text-blue-600" />
          </motion.div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Secure Admin Access</p>
            <p className="text-sm text-gray-600 mt-1">
              This is a secure area. Only authorized administrators can access this dashboard.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div 
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="mt-6 pt-6 border-t border-gray-100"
      >
        <Text className="text-center text-sm text-gray-500">
          Need help?{' '}
          <motion.span
            whileHover={{ scale: 1.05 }}
            className="inline-block"
          >
            <Link
              href="mailto:support@drinksharbour.com"
              className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Contact Support
            </Link>
          </motion.span>
        </Text>
      </motion.div>

      {/* Demo Credentials */}
      <motion.div 
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200"
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ type: 'spring', stiffness: 400 }}
      >
        <p className="text-xs text-amber-800 text-center flex items-center justify-center gap-2">
          <motion.svg 
            className="w-4 h-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 5 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </motion.svg>
          <span><strong>Demo:</strong> admin@drinksharbour.com / Admin@123!SecurePassword</span>
        </p>
      </motion.div>
    </motion.div>
  );
}

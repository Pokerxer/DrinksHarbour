'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber: string;
  dateOfBirth: string;
  agreeTerms: boolean;
  agreeAge: boolean;
}

interface ApiResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      _id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      isEmailVerified: boolean;
      isAgeVerified: boolean;
    };
    token: string;
    verificationToken?: string;
  };
}

const Register = () => {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    dateOfBirth: '',
    agreeTerms: false,
    agreeAge: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // First name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    } else if (formData.firstName.trim().length < 2) {
      newErrors.firstName = 'First name must be at least 2 characters';
    } else if (formData.firstName.length > 50) {
      newErrors.firstName = 'First name cannot exceed 50 characters';
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    } else if (formData.lastName.trim().length < 2) {
      newErrors.lastName = 'Last name must be at least 2 characters';
    } else if (formData.lastName.length > 50) {
      newErrors.lastName = 'Last name cannot exceed 50 characters';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please provide a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else {
      const hasUpperCase = /[A-Z]/.test(formData.password);
      const hasLowerCase = /[a-z]/.test(formData.password);
      const hasNumber = /\d/.test(formData.password);
      const hasSpecialChar = /[@$!%*?&]/.test(formData.password);

      if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
        newErrors.password =
          'Password must contain uppercase, lowercase, number, and special character (@$!%*?&)';
      }
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    // Phone number validation (optional)
    if (formData.phoneNumber) {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(formData.phoneNumber)) {
        newErrors.phoneNumber =
          'Please provide a valid phone number (E.164 format, e.g., +1234567890)';
      }
    }

    // Date of birth validation (optional)
    if (formData.dateOfBirth) {
      const birthDate = new Date(formData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      let calculatedAge = age;
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }

      if (birthDate > today) {
        newErrors.dateOfBirth = 'Date of birth cannot be in the future';
      } else if (calculatedAge < 18) {
        newErrors.dateOfBirth = 'You must be at least 18 years old';
      }
    }

    // Age agreement validation
    if (!formData.agreeAge) {
      newErrors.agreeAge = 'You must confirm you are 18 or older';
    }

    // Terms agreement validation
    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const getPasswordStrength = () => {
    const password = formData.password;
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[@$!%*?&]/.test(password)) strength++;

    if (strength <= 2) return { level: 'Weak', color: 'bg-red-500', percent: '25%' };
    if (strength <= 3) return { level: 'Fair', color: 'bg-yellow-500', percent: '50%' };
    if (strength <= 4) return { level: 'Good', color: 'bg-blue-500', percent: '75%' };
    return { level: 'Strong', color: 'bg-green-500', percent: '100%' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const requestBody = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        ...(formData.phoneNumber && { phoneNumber: formData.phoneNumber }),
        ...(formData.dateOfBirth && { dateOfBirth: formData.dateOfBirth }),
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'}/api/users/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        // Handle validation errors from backend
        if (data.message) {
          throw new Error(data.message);
        } else {
          throw new Error('Registration failed. Please try again.');
        }
      }

      // Success - store token and user data
      if (data.success && data.data) {
        const { token, user } = data.data;

        // Store authentication data
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
        }

        // Show success message
        setSuccessMessage(
          'Account created successfully! Please check your email to verify your account.'
        );

        // Redirect to login or dashboard after 2 seconds
        setTimeout(() => {
          if (user.isEmailVerified) {
            router.push('/dashboard');
          } else {
            router.push('/login?registered=true&verify=pending');
          }
        }, 2000);
      } else {
        throw new Error('Registration successful but unable to log in automatically.');
      }
    } catch (error: unknown) {
      console.error('Registration error:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred during registration. Please try again.';
      setGeneralError(message);

      // Scroll to error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear errors for the field being edited
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Clear general error when user starts typing
    if (generalError) {
      setGeneralError('');
    }
  };

  const passwordStrength = formData.password ? getPasswordStrength() : null;

  return (
    <>
      <div id="header" className="relative w-full bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-gray-900 transition-colors">
              Home
            </Link>
            <Icon.PiCaretRight size={12} />
            <span className="text-gray-900">Create Account</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create An Account</h1>
        </div>
      </div>

      <div className="register-block md:py-12 py-8">
        <div className="container">
          <div className="content-main flex gap-y-8 max-md:flex-col max-w-6xl mx-auto">
            {/* Left Side - Registration Form */}
            <div className="left w-full md:w-1/2 md:pr-12 md:border-r border-gray-200">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Account</h2>
                <p className="text-gray-500">
                  Join DrinksHarbour and discover premium beverages from around the world
                </p>
              </div>

              {/* Success Message */}
              {successMessage && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                  <Icon.PiCheckCircle size={20} className="text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-green-700 text-sm">{successMessage}</p>
                </div>
              )}

              {/* Error Message */}
              {generalError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                  <Icon.PiWarningCircle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{generalError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* First Name & Last Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="firstName"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      First Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="John"
                      maxLength={50}
                      required
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors.firstName
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-green-500'
                      } focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                    />
                    {errors.firstName && (
                      <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                        <Icon.PiWarning size={14} />
                        {errors.firstName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="lastName"
                      className="block text-sm font-medium text-gray-700 mb-1.5"
                    >
                      Last Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Doe"
                      maxLength={50}
                      required
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors.lastName
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-green-500'
                      } focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                    />
                    {errors.lastName && (
                      <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                        <Icon.PiWarning size={14} />
                        {errors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="john.doe@example.com"
                      autoComplete="email"
                      required
                      className={`w-full px-4 py-3 pr-12 rounded-lg border ${
                        errors.email
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-green-500'
                      } focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                    />
                    <Icon.PiEnvelope
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                      <Icon.PiWarning size={14} />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Phone Number */}
                <div>
                  <label
                    htmlFor="phoneNumber"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Phone Number <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="+1234567890"
                      autoComplete="tel"
                      className={`w-full px-4 py-3 pr-12 rounded-lg border ${
                        errors.phoneNumber
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-green-500'
                      } focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                    />
                    <Icon.PiPhone
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  </div>
                  {errors.phoneNumber && (
                    <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                      <Icon.PiWarning size={14} />
                      {errors.phoneNumber}
                    </p>
                  )}
                  {!errors.phoneNumber && formData.phoneNumber && (
                    <p className="mt-1 text-xs text-gray-500">
                      Format: E.164 (e.g., +1234567890)
                    </p>
                  )}
                </div>

                {/* Date of Birth */}
                <div>
                  <label
                    htmlFor="dateOfBirth"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Date of Birth <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      id="dateOfBirth"
                      name="dateOfBirth"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      max={
                        new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000)
                          .toISOString()
                          .split('T')[0]
                      }
                      className={`w-full px-4 py-3 pr-12 rounded-lg border ${
                        errors.dateOfBirth
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-green-500'
                      } focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                    />
                    <Icon.PiCalendar
                      size={18}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                  </div>
                  {errors.dateOfBirth && (
                    <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                      <Icon.PiWarning size={14} />
                      {errors.dateOfBirth}
                    </p>
                  )}
                  {!errors.dateOfBirth && (
                    <p className="mt-1 text-xs text-gray-500">
                      Helps with faster age verification for alcohol purchases
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      required
                      className={`w-full px-4 py-3 pr-12 rounded-lg border ${
                        errors.password
                          ? 'border-red-300 focus:ring-red-500'
                          : 'border-gray-300 focus:ring-green-500'
                      } focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <Icon.PiEyeSlash size={20} /> : <Icon.PiEye size={20} />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {formData.password && passwordStrength && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                            style={{ width: passwordStrength.percent }}
                          />
                        </div>
                        <span
                          className={`text-xs font-medium ${
                            passwordStrength.level === 'Weak'
                              ? 'text-red-500'
                              : passwordStrength.level === 'Fair'
                              ? 'text-yellow-500'
                              : passwordStrength.level === 'Good'
                              ? 'text-blue-500'
                              : 'text-green-500'
                          }`}
                        >
                          {passwordStrength.level}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        Use 8+ characters with uppercase, lowercase, numbers & symbols
                      </p>
                    </div>
                  )}

                  {errors.password && (
                    <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                      <Icon.PiWarning size={14} />
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-medium text-gray-700 mb-1.5"
                  >
                    Confirm Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm your password"
                      autoComplete="new-password"
                      required
                      className={`w-full px-4 py-3 pr-12 rounded-lg border ${
                        errors.confirmPassword
                          ? 'border-red-300 focus:ring-red-500'
                          : formData.confirmPassword && formData.password === formData.confirmPassword
                          ? 'border-green-300 focus:ring-green-500'
                          : 'border-gray-300 focus:ring-green-500'
                      } focus:outline-none focus:ring-2 focus:border-transparent transition-all`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? (
                        <Icon.PiEyeSlash size={20} />
                      ) : (
                        <Icon.PiEye size={20} />
                      )}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                      <Icon.PiWarning size={14} />
                      {errors.confirmPassword}
                    </p>
                  )}
                  {!errors.confirmPassword &&
                    formData.confirmPassword &&
                    formData.password === formData.confirmPassword && (
                      <p className="mt-1.5 text-sm text-green-600 flex items-center gap-1">
                        <Icon.PiCheckCircle size={14} />
                        Passwords match
                      </p>
                    )}
                </div>

                {/* Terms and Age Verification */}
                <div className="space-y-3 pt-2 border-t border-gray-200">
                  {/* Age Confirmation */}
                  <div>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="agreeAge"
                        name="agreeAge"
                        checked={formData.agreeAge}
                        onChange={handleChange}
                        required
                        className="w-4 h-4 mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                      />
                      <label
                        htmlFor="agreeAge"
                        className="text-sm text-gray-700 cursor-pointer leading-relaxed select-none"
                      >
                        I confirm that I am{' '}
                        <span className="font-semibold text-gray-900">18 years or older</span> and
                        agree to the age verification requirements for purchasing alcoholic
                        beverages
                      </label>
                    </div>
                    {errors.agreeAge && (
                      <p className="mt-1.5 ml-7 text-sm text-red-500 flex items-center gap-1">
                        <Icon.PiWarning size={14} />
                        {errors.agreeAge}
                      </p>
                    )}
                  </div>

                  {/* Terms & Privacy */}
                  <div>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="agreeTerms"
                        name="agreeTerms"
                        checked={formData.agreeTerms}
                        onChange={handleChange}
                        required
                        className="w-4 h-4 mt-1 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                      />
                      <label
                        htmlFor="agreeTerms"
                        className="text-sm text-gray-700 cursor-pointer leading-relaxed select-none"
                      >
                        I agree to the{' '}
                        <Link
                          href="/terms"
                          className="text-green-600 hover:underline font-medium"
                          target="_blank"
                        >
                          Terms of Service
                        </Link>
                        ,{' '}
                        <Link
                          href="/privacy"
                          className="text-green-600 hover:underline font-medium"
                          target="_blank"
                        >
                          Privacy Policy
                        </Link>
                        , and{' '}
                        <Link
                          href="/age-policy"
                          className="text-green-600 hover:underline font-medium"
                          target="_blank"
                        >
                          Age Verification Policy
                        </Link>
                      </label>
                    </div>
                    {errors.agreeTerms && (
                      <p className="mt-1.5 ml-7 text-sm text-red-500 flex items-center gap-1">
                        <Icon.PiWarning size={14} />
                        {errors.agreeTerms}
                      </p>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-6 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 shadow-sm"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <Icon.PiUserPlus size={20} />
                      Create Account
                    </>
                  )}
                </button>
              </form>

              {/* Login Link */}
              <div className="mt-8 text-center">
                <p className="text-gray-600 text-sm">
                  Already have an account?{' '}
                  <Link href="/login" className="text-green-600 hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>

            {/* Right Side - Benefits */}
            <div className="right w-full md:w-1/2 md:pl-12 flex items-center">
              <div className="text-content">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Join Our Community</h2>
                  <p className="text-gray-600 leading-relaxed">
                    Create an account to unlock exclusive features and enjoy a personalized
                    shopping experience with DrinksHarbour.
                  </p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon.PiShoppingCart size={20} className="text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Easy Ordering</h3>
                      <p className="text-gray-600 text-sm">
                        Quick checkout with saved preferences and addresses
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon.PiHeart size={20} className="text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Wishlist & Favorites</h3>
                      <p className="text-gray-600 text-sm">
                        Save your favorite wines, spirits, and beverages
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon.PiClock size={20} className="text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Order Tracking</h3>
                      <p className="text-gray-600 text-sm">
                        Track your orders from checkout to delivery
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon.PiGift size={20} className="text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Exclusive Offers</h3>
                      <p className="text-gray-600 text-sm">
                        Get access to member-only deals and promotions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Icon.PiStar size={20} className="text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Age Verification</h3>
                      <p className="text-gray-600 text-sm">
                        Quick verification for repeated purchases
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-green-50 rounded-xl border border-green-200">
                  <div className="flex items-start gap-3">
                    <Icon.PiShieldCheck size={24} className="text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-green-800 mb-1">Secure & Private</h3>
                      <p className="text-green-700 text-sm">
                        Your personal information is protected with industry-standard security
                        measures. We never share your data with third parties.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
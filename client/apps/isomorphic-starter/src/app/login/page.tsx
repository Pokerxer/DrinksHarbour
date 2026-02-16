'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';

interface FormErrors {
  email?: string;
  password?: string;
}

const Login = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) return;

    // Clear any existing auth data to ensure fresh login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:5001/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      console.log('🔵 Login response:', JSON.stringify(data).substring(0, 500));

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Extract token from data (could be in data.token or data.data.token)
      const token = data.token || data.data?.token;
      const user = data.user || data.data?.user;

      console.log('   Token from response:', !!token);
      console.log('   User from response:', !!user);

      if (!token) {
        throw new Error('No token received from server');
      }

      if (rememberMe) {
        localStorage.setItem('token', token);
      } else {
        sessionStorage.setItem('token', token);
      }

      localStorage.setItem('user', JSON.stringify(user));

      console.log('✅ Token saved to localStorage:', !!localStorage.getItem('token'));
      console.log('   Token:', localStorage.getItem('token')?.substring(0, 50) + '...');

      // Check for redirect param
      const redirectUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') : null;
      
      if (redirectUrl) {
        // Force full page reload to pick up new auth state
        window.location.href = redirectUrl;
      } else {
        // Force full page reload to pick up new auth state
        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div id="header" className="relative w-full">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Login</h1>
          <p className="text-gray-600 mb-8">
            <Link href="/" className="hover:text-gray-900">Home</Link>
            <span className="mx-2">/</span>
            <span>Login</span>
          </p>
        </div>
      </div>

      <div className="login-block md:py-20 py-10">
        <div className="container">
          <div className="content-main flex gap-y-8 max-md:flex-col max-w-4xl mx-auto">
            <div className="left w-full md:w-1/2 md:pr-8 md:border-r border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Login</h2>
              
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent ${
                      errors.email 
                        ? 'border-red-300 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-gray-900'
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className={`w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:border-transparent pr-12 ${
                        errors.password 
                          ? 'border-red-300 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-gray-900'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <Icon.PiEyeSlash size={20} /> : <Icon.PiEye size={20} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-500">{errors.password}</p>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="remember"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <label htmlFor="remember" className="ml-2 text-sm text-gray-600 cursor-pointer">
                      Remember me
                    </label>
                  </div>
                  
                  <Link href="/forgot-password" className="text-sm font-medium text-gray-900 hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-6 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </button>
              </form>
            </div>
            
            <div className="right w-full md:w-1/2 md:pl-8 flex items-center">
              <div className="text-content">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">New Customer</h2>
                <p className="text-gray-600 mb-6">
                  Be part of our growing family of new customers! Join us today and unlock a world of exclusive benefits, offers, and personalized experiences.
                </p>
                
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3">
                    <Icon.PiCheckCircle size={20} className="text-green-500" />
                    <span className="text-gray-600">Get 10% off your first order</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Icon.PiCheckCircle size={20} className="text-green-500" />
                    <span className="text-gray-600">Access to exclusive products</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Icon.PiCheckCircle size={20} className="text-green-500" />
                    <span className="text-gray-600">Early access to sales</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Icon.PiCheckCircle size={20} className="text-green-500" />
                    <span className="text-gray-600">VIP membership rewards</span>
                  </div>
                </div>
                
                <Link
                  href="/register"
                  className="inline-block py-3 px-8 bg-gray-100 text-gray-900 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;

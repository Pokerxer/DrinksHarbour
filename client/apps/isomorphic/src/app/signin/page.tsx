import SignInForm from '@/app/signin/sign-in-form';
import AuthWrapperOne from '@/app/shared/auth-layout/auth-wrapper-one';
import Image from 'next/image';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Admin Sign In'),
};

export default function SignIn() {
  return (
    <AuthWrapperOne
      title={
        <>
          Welcome back,{' '}
          <span className="relative inline-block">
            Admin
            <svg 
              className="absolute -bottom-2 start-0 w-full h-3 text-blue-500" 
              viewBox="0 0 100 12" 
              preserveAspectRatio="none"
            >
              <path 
                d="M0,8 Q50,0 100,8" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </>
      }
      description="Sign in to access your admin dashboard, manage products, orders, and monitor your business analytics in real-time."
      bannerTitle="Powerful Admin Dashboard for Your Business"
      bannerDescription="Manage your entire e-commerce operation from one centralized dashboard. Track sales, manage inventory, and grow your business with data-driven insights."
      isSocialLoginActive={false}
      pageImage={
        <div className="relative mx-auto aspect-[4/3] w-[480px] xl:w-[600px] 2xl:w-[750px]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl" />
          <div className="w-full h-full">
            <Image
              src="https://isomorphic-furyroad.s3.amazonaws.com/public/auth/sign-up.webp"
              alt="Admin Dashboard Preview"
              fill
              priority
              sizes="(max-width: 768px) 100vw"
              className="object-cover rounded-2xl shadow-2xl"
            />
          </div>
          
          {/* Floating Stats Card */}
          <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Sales</p>
                <p className="text-lg font-bold text-gray-900">₦2.4M</p>
              </div>
            </div>
          </div>
          
          {/* Floating Users Card */}
          <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500">Active Users</p>
                <p className="text-lg font-bold text-gray-900">1,234</p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <SignInForm />
    </AuthWrapperOne>
  );
}

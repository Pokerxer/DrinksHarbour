import SignUpForm from '@/app/signup/sign-up-form';
import AuthWrapperOne from '@/app/shared/auth-layout/auth-wrapper-one';
import Image from 'next/image';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Admin Registration'),
};

export default function SignUp() {
  return (
    <AuthWrapperOne
      title={
        <>
          Create your{' '}
          <span className="relative inline-block">
            Admin Account
            <svg 
              className="absolute -bottom-2 start-0 w-full h-3 text-green-500" 
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
      description="Register as an administrator to manage your e-commerce platform, products, orders, and business operations."
      bannerTitle="Join Our Admin Team"
      bannerDescription="Get access to powerful tools for managing your beverage business. Track inventory, process orders, and grow your revenue with our comprehensive dashboard."
      isSocialLoginActive={false}
      pageImage={
        <div className="relative mx-auto aspect-[4/3] w-[480px] xl:w-[600px] 2xl:w-[750px]">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-2xl" />
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
          
          {/* Floating Features Card */}
          <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500">Analytics</p>
                <p className="text-sm font-bold text-gray-900">Real-time Data</p>
              </div>
            </div>
          </div>
          
          {/* Floating Security Card */}
          <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-xl p-4 border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500">Security</p>
                <p className="text-sm font-bold text-gray-900">Enterprise Grade</p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <SignUpForm />
    </AuthWrapperOne>
  );
}

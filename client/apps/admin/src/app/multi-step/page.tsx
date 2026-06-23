// @ts-nocheck
import MultiStepFormOne from '@/app/shared/multi-step/multi-step-1';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Multi Step'),
};

// Disable static generation to avoid server component issues with useForm
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export default function MultiStepFormPage() {
  return <MultiStepFormOne />;
}

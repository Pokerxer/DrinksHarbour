import { metaObject } from '@/config/site.config';
import MultiStepFormTwo from '@/app/shared/multi-step/multi-step-2';

export const metadata = {
  ...metaObject('Multi Step Two'),
};

// Disable static generation to avoid server component issues with useForm
export const dynamic = 'force-client';
export const dynamicParams = true;

export default function MultiStepFormPageTwo() {
  return <MultiStepFormTwo />;
}

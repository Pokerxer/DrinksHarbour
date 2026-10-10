import { metaObject } from '@/config/site.config';
import ForecastPage from '@/app/shared/notifications/forecasts/forecast-page';
export const metadata = { ...metaObject('Demand forecasts') };
export default function Page() {
  return <ForecastPage />;
}

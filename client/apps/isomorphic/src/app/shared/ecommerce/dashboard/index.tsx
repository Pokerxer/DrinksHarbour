// @ts-nocheck
import Link from 'next/link';
import Image from 'next/image';
import { routes } from '@/config/routes';
import { Button } from 'rizzui/button';
import WelcomeBanner from '@core/components/banners/welcome';
import StatCards from '@/app/shared/ecommerce/dashboard/stat-cards';
import ProfitWidget from '@/app/shared/ecommerce/dashboard/profit-widget';
import SalesReport from '@/app/shared/ecommerce/dashboard/sales-report';
import BestSellers from '@/app/shared/ecommerce/dashboard/best-sellers';
import RepeatCustomerRate from '@/app/shared/ecommerce/dashboard/repeat-customer-rate';
import OrderStatusBreakdown from '@/app/shared/ecommerce/dashboard/order-status-breakdown';
import PaymentMethods from '@/app/shared/ecommerce/dashboard/payment-methods';
import TopVendors from '@/app/shared/ecommerce/dashboard/top-vendors';
import RecentOrder from '@/app/shared/ecommerce/dashboard/recent-order';
import StockReport from '@/app/shared/ecommerce/dashboard/stock-report';
import DashboardProvider from '@/app/shared/ecommerce/dashboard/dashboard-provider';
import { PiPlusBold, PiStorefrontDuotone } from 'react-icons/pi';
import welcomeImg from '@public/shop-illustration.png';
import HandWaveIcon from '@core/components/icons/hand-wave';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { getDashboardData } from '@/services/dashboard.service';

export default async function EcommerceDashboard() {
  let dashboardData = null;
  let userName = 'Admin';

  try {
    const user = await getAuthenticatedUser();
    if (user?.token) {
      dashboardData = await getDashboardData(user.token as string);
      if (user.name) userName = user.name.split(' ')[0];
    }
  } catch {
    // Widgets show skeleton fallback states
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const todayOrders  = dashboardData?.statCards?.today?.orders  ?? null;
  const todayRevenue = dashboardData?.statCards?.today?.revenue ?? null;

  function fmtRev(n: number) {
    if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`;
    return `₦${n}`;
  }

  return (
    <div className="@container">
      <DashboardProvider data={dashboardData}>
        <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2 @7xl:grid-cols-12 3xl:gap-8">

          {/* Welcome banner */}
          <WelcomeBanner
            title={
              <>
                {greeting}, <br /> {userName}{' '}
                <HandWaveIcon className="inline-flex h-8 w-8" />
              </>
            }
            description={
              todayOrders !== null
                ? `Today: ${todayOrders} order${todayOrders !== 1 ? 's' : ''} · ${fmtRev(todayRevenue ?? 0)} revenue. Here's your store at a glance.`
                : "Here's what's happening in your store today. See the statistics at once."
            }
            media={
              <div className="absolute -bottom-6 end-4 hidden w-[300px] @2xl:block lg:w-[320px] 2xl:-bottom-7 2xl:w-[330px]">
                <div className="relative">
                  <Image
                    src={welcomeImg}
                    alt="Welcome shop image"
                    className="dark:brightness-95 dark:drop-shadow-md"
                  />
                </div>
              </div>
            }
            contentClassName="@2xl:max-w-[calc(100%-340px)]"
            className="border border-muted bg-gray-0 pb-8 @4xl:col-span-2 @7xl:col-span-8 dark:bg-gray-100/30 lg:pb-9"
          >
            <div className="flex items-center gap-3">
              <Link href={routes.eCommerce.createProduct} className="inline-flex">
                <Button as="span" className="h-[38px] shadow md:h-10">
                  <PiPlusBold className="me-1 h-4 w-4" /> Add Product
                </Button>
              </Link>
              <Link href={routes.eCommerce.orders} className="inline-flex">
                <Button as="span" variant="outline" className="h-[38px] md:h-10">
                  <PiStorefrontDuotone className="me-1 h-4 w-4" /> Orders
                </Button>
              </Link>
            </div>
          </WelcomeBanner>

          {/* Stat cards (4 cards) */}
          <StatCards className="@2xl:grid-cols-2 @3xl:grid-cols-4 @3xl:gap-6 @4xl:col-span-2 @7xl:col-span-8" />

          {/* Profit / Revenue widget — tall, spans rows 1-3 on wide screens */}
          <ProfitWidget className="h-[464px] @sm:h-[520px] @7xl:col-span-4 @7xl:col-start-9 @7xl:row-start-1 @7xl:row-end-3 @7xl:h-full" />

          {/* Sales chart */}
          <SalesReport className="@4xl:col-span-2 @7xl:col-span-8" />

          {/* Order status radial */}
          <OrderStatusBreakdown className="@4xl:col-start-2 @4xl:row-start-3 @7xl:col-span-4 @7xl:col-start-auto @7xl:row-start-auto" />

          {/* Recent orders full-width */}
          <RecentOrder className="relative @4xl:col-span-2 @7xl:col-span-12" />

          {/* Customer activity chart */}
          <RepeatCustomerRate className="@4xl:col-span-2 @7xl:col-span-12 @[90rem]:col-span-8" />

          {/* Best sellers */}
          <BestSellers className="@7xl:col-span-4" />

          {/* Top vendors */}
          <TopVendors className="@7xl:col-span-4" />

          {/* Payment methods breakdown */}
          <PaymentMethods className="@7xl:col-span-4" />

          {/* Stock report table */}
          <StockReport className="@4xl:col-span-2 @7xl:col-span-12" />

        </div>
      </DashboardProvider>
    </div>
  );
}

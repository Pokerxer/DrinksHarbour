import Link from 'next/link';
import Image from 'next/image';
import { routes } from '@/config/routes';
import { Button } from 'rizzui/button';
import WelcomeBanner from '@core/components/banners/welcome';
import StatCards from '@/app/shared/ecommerce/dashboard/stat-cards';
import ProfitWidget from '@/app/shared/ecommerce/dashboard/profit-widget';
import TenantRevenueWidget from '@/app/shared/ecommerce/dashboard/tenant-revenue-widget';
import SalesReport from '@/app/shared/ecommerce/dashboard/sales-report';
import BestSellers from '@/app/shared/ecommerce/dashboard/best-sellers';
import RepeatCustomerRate from '@/app/shared/ecommerce/dashboard/repeat-customer-rate';
import OrderStatusBreakdown from '@/app/shared/ecommerce/dashboard/order-status-breakdown';
import PaymentMethods from '@/app/shared/ecommerce/dashboard/payment-methods';
import TopVendors from '@/app/shared/ecommerce/dashboard/top-vendors';
import RecentOrder from '@/app/shared/ecommerce/dashboard/recent-order';
import StockReport from '@/app/shared/ecommerce/dashboard/stock-report';
import DashboardProvider from '@/app/shared/ecommerce/dashboard/dashboard-provider';
import EcommerceHero from '@/app/shared/ecommerce/ecommerce-hero';
import EcommerceNavHeader from '@/app/shared/ecommerce/ecommerce-nav-header';
import {
  PiPlusBold,
  PiStorefrontDuotone,
  PiReceiptDuotone,
  PiWarningCircleDuotone,
  PiPackageDuotone,
} from 'react-icons/pi';
import welcomeImg from '@public/shop-illustration.png';
import HandWaveIcon from '@core/components/icons/hand-wave';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { getDashboardData } from '@/services/dashboard.service';
import { TENANT_ROLES } from '@/types/authorization';

export default async function EcommerceDashboard() {
  let dashboardData = null;
  let userName = 'Admin';
  let isTenantUser = false;

  try {
    const user = await getAuthenticatedUser();
    if (user?.token) {
      dashboardData = await getDashboardData(user.token as string);
      if (user.name) userName = user.name.split(' ')[0];
      isTenantUser = TENANT_ROLES.includes(user.role as any);
    }
  } catch {
    // Widgets show skeleton fallback states
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const todayOrders = dashboardData?.statCards?.today?.orders ?? null;
  const todayRevenue = dashboardData?.statCards?.today?.revenue ?? null;
  const pendingOrders = dashboardData?.statCards?.pendingOrders ?? 0;
  const lowStockCount = dashboardData?.statCards?.lowStockCount ?? 0;

  function fmtRev(n: number) {
    if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`;
    return `₦${n}`;
  }

  const addProductHref = isTenantUser
    ? routes.eCommerce.createSubProduct
    : routes.eCommerce.createProduct;

  return (
    <div className="@container">
      <DashboardProvider data={dashboardData}>
        <div className="-mx-4 md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10">
          <EcommerceNavHeader />
          <EcommerceHero />
        </div>

        {isTenantUser ? (
          /* ── TENANT LAYOUT ──────────────────────────────────────────── */
          <div className="space-y-6 3xl:space-y-8">
            {/* Quick actions + alerts bar */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href={routes.eCommerce.orders}>
                <Button
                  size="sm"
                  className="h-9 gap-1.5 bg-[#b20202] text-white shadow-sm hover:bg-[#9a0101]"
                >
                  <PiReceiptDuotone className="h-4 w-4" /> View Orders
                </Button>
              </Link>
              <Link href={addProductHref}>
                <Button size="sm" variant="outline" className="h-9 gap-1.5">
                  <PiPlusBold className="h-3.5 w-3.5" /> Add Product
                </Button>
              </Link>
              <Link href={routes.eCommerce.subProducts}>
                <Button size="sm" variant="outline" className="h-9 gap-1.5">
                  <PiPackageDuotone className="h-4 w-4" /> My Products
                </Button>
              </Link>

              {/* Pending orders alert */}
              {pendingOrders > 0 && (
                <Link
                  href={routes.eCommerce.orders}
                  className="ms-auto flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100"
                >
                  <PiWarningCircleDuotone className="h-4 w-4 shrink-0" />
                  {pendingOrders} order{pendingOrders !== 1 ? 's' : ''} need
                  {pendingOrders === 1 ? 's' : ''} attention
                </Link>
              )}
              {lowStockCount > 0 && (
                <Link
                  href={routes.eCommerce.subProducts}
                  className={`flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 ${pendingOrders > 0 ? '' : 'ms-auto'}`}
                >
                  <PiWarningCircleDuotone className="h-4 w-4 shrink-0" />
                  {lowStockCount} low/out-of-stock
                </Link>
              )}
            </div>

            {/* Stat cards + revenue widget */}
            <div className="grid grid-cols-1 gap-6 @7xl:grid-cols-12 3xl:gap-8">
              <StatCards className="@2xl:grid-cols-2 @3xl:grid-cols-4 @3xl:gap-6 @7xl:col-span-8" />
              <TenantRevenueWidget className="h-[464px] @sm:h-[520px] @7xl:col-span-4 @7xl:h-full" />
            </div>

            {/* Revenue trend */}
            <SalesReport isTenant className="w-full" />

            {/* Recent orders — the main operational view */}
            <RecentOrder className="relative w-full" />

            {/* Products, payments, order status */}
            <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2 @7xl:grid-cols-12 3xl:gap-8">
              <BestSellers className="@7xl:col-span-5" />
              <PaymentMethods className="@7xl:col-span-4" />
              <OrderStatusBreakdown className="@7xl:col-span-3" />
            </div>

            {/* Stock report */}
            <StockReport className="w-full" />
          </div>
        ) : (
          /* ── ADMIN LAYOUT (unchanged) ───────────────────────────────── */
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
                <Link href={addProductHref} className="inline-flex">
                  <Button as="span" className="h-[38px] shadow md:h-10">
                    <PiPlusBold className="me-1 h-4 w-4" /> Add Product
                  </Button>
                </Link>
                <Link href={routes.eCommerce.orders} className="inline-flex">
                  <Button
                    as="span"
                    variant="outline"
                    className="h-[38px] md:h-10"
                  >
                    <PiStorefrontDuotone className="me-1 h-4 w-4" /> Orders
                  </Button>
                </Link>
              </div>
            </WelcomeBanner>

            <StatCards className="@2xl:grid-cols-2 @3xl:grid-cols-4 @3xl:gap-6 @4xl:col-span-2 @7xl:col-span-8" />

            <ProfitWidget className="h-[464px] @sm:h-[520px] @7xl:col-span-4 @7xl:col-start-9 @7xl:row-start-1 @7xl:row-end-3 @7xl:h-full" />

            <SalesReport className="@4xl:col-span-2 @7xl:col-span-8" />

            <OrderStatusBreakdown className="@4xl:col-start-2 @4xl:row-start-3 @7xl:col-span-4 @7xl:col-start-auto @7xl:row-start-auto" />

            <RecentOrder className="relative @4xl:col-span-2 @7xl:col-span-12" />

            <RepeatCustomerRate className="@4xl:col-span-2 @7xl:col-span-12 @[90rem]:col-span-8" />

            <BestSellers className="@7xl:col-span-4" />
            <TopVendors className="@7xl:col-span-4" />
            <PaymentMethods className="@7xl:col-span-4" />

            <StockReport className="@4xl:col-span-2 @7xl:col-span-12" />
          </div>
        )}
      </DashboardProvider>
    </div>
  );
}

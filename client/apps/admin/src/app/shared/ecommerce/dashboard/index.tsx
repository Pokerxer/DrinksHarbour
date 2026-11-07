import Link from 'next/link';
import Image from 'next/image';
import { routes } from '@/config/routes';
import { Button } from 'rizzui/button';
// Import from the subpath, not the `rizzui` barrel: the barrel eagerly requires
// every component chunk (Modal, Dropdown, Tab…), which pulls @headlessui/react
// into this server component's RSC graph — where `createContext` does not exist.
import { Text, Title } from 'rizzui/typography';
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
import TodayMomentum from '@/app/shared/ecommerce/dashboard/today-momentum';
import NeedsAttention from '@/app/shared/ecommerce/dashboard/needs-attention';
import StockReport from '@/app/shared/ecommerce/dashboard/stock-report';
import DashboardProvider from '@/app/shared/ecommerce/dashboard/dashboard-provider';
import PeriodSwitcher, {
  DashboardBody,
} from '@/app/shared/ecommerce/dashboard/period-switcher';
import RetryButton from '@/app/shared/ecommerce/dashboard/retry-button';
import { formatCompactNaira } from '@/app/shared/ecommerce/dashboard/dashboard-format';
import EcommerceHero from '@/app/shared/ecommerce/ecommerce-hero';
import EcommerceNavHeader from '@/app/shared/ecommerce/ecommerce-nav-header';
import {
  PiPlusBold,
  PiStorefrontDuotone,
  PiReceiptDuotone,
  PiWarningCircleDuotone,
  PiPackageDuotone,
  PiSignpostDuotone,
  PiCloudSlashDuotone,
} from 'react-icons/pi';
import welcomeImg from '@public/shop-illustration.png';
import HandWaveIcon from '@core/components/icons/hand-wave';
import { getAuthenticatedUser } from '@/lib/server-auth';
import {
  getDashboardData,
  resolveDashboardParams,
  type DashboardData,
  type DashboardParams,
} from '@/services/dashboard.service';
import { TENANT_ROLES } from '@/types/authorization';

type LoadFailure = 'unauthenticated' | 'error' | null;

/**
 * Full-width card used when the dashboard cannot render its widgets (session
 * expired or the analytics API failed). Keeps the nav shell visible so users
 * can navigate elsewhere instead of staring at infinite skeletons.
 *
 * Failure isolation note: the dashboard is fed by ONE analytics call, so
 * per-report Suspense boundaries cannot stream earlier or fail independently —
 * hard API failure keeps this whole-page card. Partial/partially-missing
 * payloads ARE degraded per-widget in `normalizeDashboardData` (service),
 * which fills missing sections so individual widgets render empty states.
 */
function DashboardMessage({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[360px] items-center justify-center rounded-xl border border-muted bg-gray-0 p-8 dark:bg-gray-100/30">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-200/10">
          {icon}
        </div>
        <Title as="h2" className="mb-2 text-lg font-semibold">
          {title}
        </Title>
        <Text className="mb-5 leading-relaxed text-gray-500">
          {description}
        </Text>
        {children ? (
          <div className="flex items-center justify-center gap-3">
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Streaming decision: the page-level Suspense boundary in
 * `(hydrogen)/ecommerce/page.tsx` stays the ONLY one. The nav header + hero
 * read `DashboardContext` (today's sales figures), and the provider needs the
 * resolved data payload — so splitting the data fetch into a nested Suspense
 * bank would either strip the hero's figures or duplicate the fetch. Nothing
 * below the hero would stream sooner since one analytics call feeds all
 * widgets; keep-cached-while-refreshing on period switches is instead
 * provided by the `useTransition` push in PeriodSwitcher (React holds the
 * old UI while the new render streams in).
 */
export default async function EcommerceDashboard({
  period,
  from,
  to,
}: DashboardParams) {
  let dashboardData: DashboardData | null = null;
  let userName = 'Admin';
  let isTenantUser = false;
  let failure: LoadFailure = null;

  try {
    const user = await getAuthenticatedUser();
    if (!user?.token) {
      // Middleware normally redirects first; this is defense-in-depth so a
      // stale session shows a sign-in path instead of endless skeletons.
      failure = 'unauthenticated';
    } else {
      // Validate params server-side BEFORE the analytics call: a hand-typed
      // `?period=banana` (or a malformed custom range) renders the default
      // period here while keeping the user's URL untouched.
      dashboardData = await getDashboardData(
        user.token as string,
        resolveDashboardParams({ period, from, to })
      );
      if (user.name) userName = user.name.split(' ')[0];
      isTenantUser = TENANT_ROLES.includes(user.role);
    }
  } catch {
    failure = 'error';
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const todayOrders = dashboardData?.statCards?.today?.orders ?? null;
  const todayRevenue = dashboardData?.statCards?.today?.revenue ?? null;
  const pendingOrders = dashboardData?.statCards?.pendingOrders ?? 0;
  const lowStockCount = dashboardData?.statCards?.lowStockCount ?? 0;

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

        {failure === 'unauthenticated' ? (
          <DashboardMessage
            icon={<PiSignpostDuotone className="h-7 w-7" />}
            title="Your session has expired"
            description="Sign in again to see live orders, revenue and stock for your store."
          >
            <Link href={routes.signIn}>
              <Button as="span" size="sm" className="h-9">
                Sign in
              </Button>
            </Link>
          </DashboardMessage>
        ) : failure === 'error' ? (
          <DashboardMessage
            icon={<PiCloudSlashDuotone className="h-7 w-7" />}
            title="We couldn't load your dashboard"
            description="Something went wrong while fetching your store's analytics. Your data is safe — try again in a moment."
          >
            <RetryButton />
          </DashboardMessage>
        ) : (
          <>
            <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-muted bg-gray-0/95 px-4 py-3 backdrop-blur md:-mx-5 md:px-5 lg:-mx-6 lg:px-6 3xl:-mx-8 3xl:px-8 4xl:-mx-10 4xl:px-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-gray-500">
                  Showing{' '}
                  <span className="font-semibold text-gray-900">
                    {dashboardData?.meta?.label ?? 'This month'}
                  </span>
                </p>
                <PeriodSwitcher />
              </div>
            </div>

            {isTenantUser ? (
              /* ── TENANT LAYOUT ──────────────────────────────────────────── */
              <DashboardBody>
                <div className="space-y-6 3xl:space-y-8">
                  {/* Quick actions + alerts bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={routes.eCommerce.orders}>
                        <Button
                          size="sm"
                          className="h-9 gap-1.5 bg-[#b20202] text-white shadow-sm hover:bg-[#9a0101]"
                        >
                          <PiReceiptDuotone className="h-4 w-4" /> View Orders
                        </Button>
                      </Link>
                      <Link href={addProductHref}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 gap-1.5"
                        >
                          <PiPlusBold className="h-3.5 w-3.5" /> Add Product
                        </Button>
                      </Link>
                      <Link href={routes.eCommerce.subProducts}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 gap-1.5"
                        >
                          <PiPackageDuotone className="h-4 w-4" /> My Products
                        </Button>
                      </Link>
                    </div>

                    {(pendingOrders > 0 || lowStockCount > 0) && (
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Pending orders alert */}
                        {pendingOrders > 0 && (
                          <Link
                            href={routes.eCommerce.orders}
                            className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
                          >
                            <PiWarningCircleDuotone className="h-4 w-4 shrink-0" />
                            {pendingOrders} order
                            {pendingOrders !== 1 ? 's' : ''} need
                            {pendingOrders === 1 ? 's' : ''} attention
                          </Link>
                        )}
                        {lowStockCount > 0 && (
                          <Link
                            href={routes.eCommerce.subProducts}
                            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                          >
                            <PiWarningCircleDuotone className="h-4 w-4 shrink-0" />
                            {lowStockCount} low/out-of-stock
                          </Link>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stat cards + revenue widget */}
                  <div className="grid grid-cols-1 gap-6 @7xl:grid-cols-12 3xl:gap-8">
                    <StatCards className="@2xl:grid-cols-2 @3xl:grid-cols-4 @3xl:gap-6 @7xl:col-span-8" />
                    <TenantRevenueWidget className="h-[464px] @sm:h-[520px] @7xl:col-span-4 @7xl:h-full" />
                  </div>

                  {/* Today's momentum + attention queue */}
                  <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2 @7xl:grid-cols-12 3xl:gap-8">
                    <TodayMomentum className="@7xl:col-span-5" />
                    <NeedsAttention className="@7xl:col-span-7" />
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
              </DashboardBody>
            ) : (
              /* ── ADMIN LAYOUT ───────────────────────────────────────────── */
              <DashboardBody>
                <div className="space-y-6 3xl:space-y-8">
                  {/* Band 1 — welcome + KPIs + profit */}
                  <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2 @7xl:grid-cols-12 3xl:gap-8">
                    <WelcomeBanner
                      title={
                        <>
                          {greeting}, <br /> {userName}{' '}
                          <HandWaveIcon className="inline-flex h-8 w-8" />
                        </>
                      }
                      description={
                        todayOrders !== null
                          ? `Today: ${todayOrders} order${todayOrders !== 1 ? 's' : ''} · ${formatCompactNaira(todayRevenue ?? 0)} revenue. Here's your store at a glance.`
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
                          <Button
                            as="span"
                            className="h-[38px] shadow md:h-10"
                          >
                            <PiPlusBold className="me-1 h-4 w-4" /> Add Product
                          </Button>
                        </Link>
                        <Link
                          href={routes.eCommerce.orders}
                          className="inline-flex"
                        >
                          <Button
                            as="span"
                            variant="outline"
                            className="h-[38px] md:h-10"
                          >
                            <PiStorefrontDuotone className="me-1 h-4 w-4" />{' '}
                            Orders
                          </Button>
                        </Link>
                      </div>
                    </WelcomeBanner>

                    <StatCards className="@2xl:grid-cols-2 @3xl:grid-cols-4 @3xl:gap-6 @4xl:col-span-2 @7xl:col-span-8" />

                    <ProfitWidget className="h-[464px] @sm:h-[520px] @7xl:col-span-4 @7xl:col-start-9 @7xl:row-start-1 @7xl:row-end-3 @7xl:h-full" />
                  </div>

                  {/* Band 2 — trend */}
                  <div className="grid grid-cols-1 gap-6 @7xl:grid-cols-12 3xl:gap-8">
                    <SalesReport className="@7xl:col-span-8" />
                    <OrderStatusBreakdown className="@7xl:col-span-4" />
                  </div>

                  {/* Band 2b — today's momentum + attention queue */}
                  <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2 @7xl:grid-cols-12 3xl:gap-8">
                    <TodayMomentum className="@7xl:col-span-5" />
                    <NeedsAttention className="@7xl:col-span-7" />
                  </div>

                  {/* Band 3 — operational */}
                  <RecentOrder className="relative w-full" />

                  {/* Band 4 — analysis */}
                  <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2 @7xl:grid-cols-12 3xl:gap-8">
                    <BestSellers className="@7xl:col-span-4" />
                    <TopVendors className="@7xl:col-span-4" />
                    <PaymentMethods className="@7xl:col-span-4" />
                  </div>

                  {/* Band 5 — customers + inventory */}
                  <RepeatCustomerRate className="w-full" />
                  <StockReport className="w-full" />
                </div>
              </DashboardBody>
            )}
          </>
        )}
      </DashboardProvider>
    </div>
  );
}

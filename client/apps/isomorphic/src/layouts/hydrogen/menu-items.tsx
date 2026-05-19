import { DUMMY_ID } from '@/config/constants';
import { routes } from '@/config/routes';
import {
  PiAirplaneTiltDuotone,
  PiApplePodcastsLogoDuotone,
  PiArrowsOutDuotone,
  PiArrowsOutLineHorizontalDuotone,
  PiBellSimpleRingingDuotone,
  PiBinocularsDuotone,
  PiBriefcaseDuotone,
  PiBrowserDuotone,
  PiCalendarDuotone,
  PiCalendarPlusDuotone,
  PiCaretCircleUpDownDuotone,
  PiChartBarDuotone,
  PiChartLineUpDuotone,
  PiChartPieSliceDuotone,
  PiChatCenteredDotsDuotone,
  PiClipboardTextDuotone,
  PiCodesandboxLogoDuotone,
  PiCoinDuotone,
  PiCreditCardDuotone,
  PiCurrencyCircleDollarDuotone,
  PiCurrencyDollarDuotone,
  PiEnvelopeDuotone,
  PiEnvelopeSimpleOpenDuotone,
  PiFeatherDuotone,
  PiFolderDuotone,
  PiFolderLockDuotone,
  PiFoldersDuotone,
  PiFolderUserDuotone,
  PiGridFourDuotone,
  PiHammerDuotone,
  PiHeadsetDuotone,
  PiHourglassSimpleDuotone,
  PiHouseLineDuotone,
  PiListNumbersDuotone,
  PiLockKeyDuotone,
  PiMapPinLineDuotone,
  PiNewspaperClippingDuotone,
  PiNoteBlankDuotone,
  PiPackageDuotone,
  PiPresentationChartDuotone,
  PiPushPinDuotone,
  PiRocketLaunchDuotone,
  PiScalesDuotone,
  PiShapesDuotone,
  PiShieldCheckDuotone,
  PiShootingStarDuotone,
  PiShoppingCartDuotone,
  PiSparkleDuotone,
  PiSquaresFourDuotone,
  PiStairsDuotone,
  PiStepsDuotone,
  PiTableDuotone,
  PiUserCircleDuotone,
  PiUserDuotone,
  PiUserGearDuotone,
  PiUserPlusDuotone,
} from 'react-icons/pi';

// Note: do not add href in the label object, it is rendering as label
export const menuItems = [
  // label start
  {
    name: 'Overview',
  },
  // label end
  {
    name: 'File Manager',
    href: '/',
    icon: <PiFolderDuotone />,
    platformOnly: true,
  },
  {
    name: 'Appointment',
    href: routes.appointment.dashboard,
    icon: <PiCalendarDuotone />,
    platformOnly: true,
  },
  {
    name: 'Executive',
    href: routes.executive.dashboard,
    icon: <PiBriefcaseDuotone />,
    platformOnly: true,
  },
  {
    name: 'Project',
    href: routes.project.dashboard,
    icon: <PiClipboardTextDuotone />,
    platformOnly: true,
  },
  {
    name: 'CRM',
    href: routes.crm.dashboard,
    icon: <PiFolderUserDuotone />,
    platformOnly: true,
  },
  {
    name: 'Affiliate',
    href: routes.affiliate.dashboard,
    icon: <PiChartPieSliceDuotone />,
    platformOnly: true,
  },
  {
    name: 'Store Analytics',
    href: routes.storeAnalytics.dashboard,
    icon: <PiPresentationChartDuotone />,
    badge: 'NEW',
  },
  {
    name: 'Bidding',
    href: routes.bidding.dashboard,
    icon: <PiScalesDuotone />,
    badge: 'NEW',
    platformOnly: true,
  },
  {
    name: 'Social Media',
    href: routes.socialMedia.dashboard,
    icon: <PiSparkleDuotone />,
    platformOnly: true,
  },
  {
    name: 'Job Board',
    href: routes.jobBoard.dashboard,
    icon: <PiShapesDuotone />,
    platformOnly: true,
  },
  {
    name: 'Financial',
    href: routes.financial.dashboard,
    icon: <PiCurrencyCircleDollarDuotone />,
    platformOnly: true,
  },
  {
    name: 'Logistics',
    href: routes.logistics.dashboard,
    icon: <PiPackageDuotone />,
  },
  {
    name: 'E-Commerce',
    href: routes.eCommerce.dashboard,
    icon: <PiShoppingCartDuotone />,
  },
  {
    name: 'Analytics',
    href: routes.analytics,
    icon: <PiChartBarDuotone />,
  },
  {
    name: 'Support',
    href: routes.support.dashboard,
    icon: <PiHeadsetDuotone />,
  },
  {
    name: 'Podcast',
    href: routes.podcast.dashboard,
    icon: <PiApplePodcastsLogoDuotone />,
    badge: 'NEW',
    platformOnly: true,
  },

  // label start
  {
    name: 'Apps Kit',
  },
  // label end
  {
    name: 'E-Commerce',
    href: '#',
    icon: <PiShoppingCartDuotone />,
    dropdownItems: [
      {
        name: 'Products',
        href: routes.eCommerce.products,
        badge: '',
        platformOnly: true,
      },
      {
        name: 'Brands',
        href: routes.eCommerce.brands,
      },
      {
        name: 'Tenants',
        href: routes.eCommerce.tenants,
        platformOnly: true,
      },
      {
        name: 'Product Details',
        href: routes.eCommerce.productDetails(DUMMY_ID),
        platformOnly: true,
      },
      {
        name: 'Create Product',
        href: routes.eCommerce.createProduct,
        platformOnly: true,
      },
      {
        name: 'Sub Products',
        href: routes.eCommerce.subProducts,
      },
      {
        name: 'Categories',
        href: routes.eCommerce.categories,
      },
      {
        name: 'Orders',
        href: routes.eCommerce.orders,
      },
      {
        name: 'Reviews',
        href: routes.eCommerce.reviews,
      },
      {
        name: 'Promotions',
        href: routes.eCommerce.promotions,
      },
      {
        name: 'Banners',
        href: routes.eCommerce.banners,
      },
      {
        name: 'Shop',
        href: routes.eCommerce.shop,
      },
      {
        name: 'Cart',
        href: routes.eCommerce.cart,
      },
      {
        name: 'Checkout & Payment',
        href: routes.eCommerce.checkout,
      },
    ],
  },
  {
    name: 'Purchases',
    href: '#',
    icon: <PiPackageDuotone />,
    dropdownItems: [
      {
        name: 'Purchase Orders',
        href: routes.eCommerce.purchases,
      },
      {
        name: 'Create Purchase Order',
        href: routes.eCommerce.createPurchase,
      },
      {
        name: 'Purchase Agreements',
        href: routes.eCommerce.purchaseAgreements,
      },
      {
        name: 'Create Agreement',
        href: routes.eCommerce.createPurchaseAgreement,
      },
      {
        name: 'Vendor Bills',
        href: routes.eCommerce.vendorBills,
      },
      {
        name: 'Create Vendor Bill',
        href: routes.eCommerce.createVendorBill,
      },
      {
        name: 'Vendor Returns',
        href: routes.eCommerce.vendorReturns,
      },
      {
        name: 'Create Return',
        href: routes.eCommerce.createVendorReturn,
      },
      {
        name: 'Purchase Analytics',
        href: routes.eCommerce.purchaseAnalytics,
      },
      {
        name: 'Vendor Pricelists',
        href: routes.eCommerce.vendorPricelists,
      },
      {
        name: 'Create Pricelist',
        href: routes.eCommerce.createVendorPricelist,
      },
      {
        name: 'UOM Conversions',
        href: routes.eCommerce.uomConversions,
      },
      {
        name: 'Exchange Rates',
        href: routes.eCommerce.exchangeRates,
      },
    ],
  },
  // label start
  {
    name: 'Search & Filters',
    platformOnly: true,
  },
  {
    name: 'Real Estate',
    href: routes.searchAndFilter.realEstate,
    icon: <PiHouseLineDuotone />,
    platformOnly: true,
  },
  {
    name: 'Flight Booking',
    href: routes.searchAndFilter.flight,
    icon: <PiAirplaneTiltDuotone />,
    platformOnly: true,
  },
  {
    name: 'NFT',
    href: routes.searchAndFilter.nft,
    icon: <PiCoinDuotone />,
    platformOnly: true,
  },
  // label end
  // label start
  {
    name: 'Widgets',
    platformOnly: true,
  },
  // label end
  {
    name: 'Cards',
    href: routes.widgets.cards,
    icon: <PiSquaresFourDuotone />,
    platformOnly: true,
  },
  {
    name: 'Icons',
    href: routes.widgets.icons,
    icon: <PiFeatherDuotone />,
    platformOnly: true,
  },
  {
    name: 'Charts',
    href: routes.widgets.charts,
    icon: <PiChartLineUpDuotone />,
    platformOnly: true,
  },
  // {
  //   name: 'Banners',
  //   href: routes.widgets.banners,
  //   icon: <PiImageDuotone />,
  // },
  {
    name: 'Maps',
    href: routes.widgets.maps,
    icon: <PiMapPinLineDuotone />,
    platformOnly: true,
  },
  {
    name: 'Email Templates',
    href: routes.emailTemplates,
    icon: <PiEnvelopeDuotone />,
    platformOnly: true,
  },
  // label start
  {
    name: 'Forms',
  },
  // label end
  {
    name: 'Account Settings',
    href: routes.forms.profileSettings,
    icon: <PiUserGearDuotone />,
  },
  {
    name: 'Notification Preference',
    href: routes.forms.notificationPreference,
    icon: <PiBellSimpleRingingDuotone />,
  },
  {
    name: 'Personal Information',
    href: routes.forms.personalInformation,
    icon: <PiUserDuotone />,
  },
  {
    name: 'Newsletter',
    href: routes.forms.newsletter,
    icon: <PiEnvelopeSimpleOpenDuotone />,
    platformOnly: true,
  },
  {
    name: 'Multi Step',
    href: routes.multiStep,
    icon: <PiStepsDuotone />,
    platformOnly: true,
  },
  {
    name: 'Multi Step 2',
    href: routes.multiStep2,
    icon: <PiStairsDuotone />,
    platformOnly: true,
  },
  {
    name: 'Payment Checkout',
    href: routes.eCommerce.checkout,
    icon: <PiCreditCardDuotone />,
    platformOnly: true,
  },
  // label start
  {
    name: 'Tables',
    platformOnly: true,
  },
  // label end
  {
    name: 'Basic',
    href: routes.tables.basic,
    icon: <PiGridFourDuotone />,
    platformOnly: true,
  },
  {
    name: 'Collapsible',
    href: routes.tables.collapsible,
    icon: <PiCaretCircleUpDownDuotone />,
    platformOnly: true,
  },
  {
    name: 'Enhanced',
    href: routes.tables.enhanced,
    icon: <PiTableDuotone />,
    platformOnly: true,
  },
  {
    name: 'Sticky Header',
    href: routes.tables.stickyHeader,
    icon: <PiBrowserDuotone />,
    platformOnly: true,
  },
  {
    name: 'Pagination',
    href: routes.tables.pagination,
    icon: <PiListNumbersDuotone />,
    platformOnly: true,
  },
  {
    name: 'Search',
    href: routes.tables.search,
    icon: <PiHourglassSimpleDuotone />,
    platformOnly: true,
  },
  {
    name: 'Resizable',
    href: routes.tables.resizable,
    icon: <PiArrowsOutLineHorizontalDuotone />,
    platformOnly: true,
  },
  {
    name: 'Pinning',
    href: routes.tables.pinning,
    icon: <PiPushPinDuotone />,
    platformOnly: true,
  },
  {
    name: 'Drag & Drop',
    href: routes.tables.dnd,
    icon: <PiArrowsOutDuotone />,
    platformOnly: true,
  },
  // label start
  {
    name: 'Pages',
    platformOnly: true,
  },
  {
    name: 'Profile',
    href: routes.profile,
    icon: <PiUserCircleDuotone />,
    platformOnly: true,
  },
  {
    name: 'Welcome',
    href: routes.welcome,
    icon: <PiShootingStarDuotone />,
    platformOnly: true,
  },
  {
    name: 'Coming soon',
    href: routes.comingSoon,
    icon: <PiRocketLaunchDuotone />,
    platformOnly: true,
  },
  {
    name: 'Access Denied',
    href: routes.accessDenied,
    icon: <PiFolderLockDuotone />,
    platformOnly: true,
  },
  {
    name: 'Not Found',
    href: routes.notFound,
    icon: <PiBinocularsDuotone />,
    platformOnly: true,
  },
  {
    name: 'Maintenance',
    href: routes.maintenance,
    icon: <PiHammerDuotone />,
    platformOnly: true,
  },
  {
    name: 'Blank',
    href: routes.blank,
    icon: <PiNoteBlankDuotone />,
    platformOnly: true,
  },

  // label start
  {
    name: 'Authentication',
    platformOnly: true,
  },
  // label end
  {
    name: 'Sign Up',
    href: '#',
    icon: <PiUserPlusDuotone />,
    platformOnly: true,
    dropdownItems: [
      {
        name: 'Modern Sign up',
        href: routes.auth.signUp1,
      },
      {
        name: 'Vintage Sign up',
        href: routes.auth.signUp2,
      },
      {
        name: 'Trendy Sign up',
        href: routes.auth.signUp3,
      },
      {
        name: 'Elegant Sign up',
        href: routes.auth.signUp4,
      },
      {
        name: 'Classic Sign up',
        href: routes.auth.signUp5,
      },
    ],
  },
  {
    name: 'Sign In',
    href: '#',
    icon: <PiShieldCheckDuotone />,
    platformOnly: true,
    dropdownItems: [
      {
        name: 'Modern Sign in',
        href: routes.auth.signIn1,
      },
      {
        name: 'Vintage Sign in',
        href: routes.auth.signIn2,
      },
      {
        name: 'Trendy Sign in',
        href: routes.auth.signIn3,
      },
      {
        name: 'Elegant Sign in',
        href: routes.auth.signIn4,
      },
      {
        name: 'Classic Sign in',
        href: routes.auth.signIn5,
      },
    ],
  },
  {
    name: 'Forgot Password',
    href: '#',
    icon: <PiLockKeyDuotone />,
    platformOnly: true,
    dropdownItems: [
      {
        name: 'Modern Forgot password',
        href: routes.auth.forgotPassword1,
      },
      {
        name: 'Vintage Forgot password',
        href: routes.auth.forgotPassword2,
      },
      {
        name: 'Trendy Forgot password',
        href: routes.auth.forgotPassword3,
      },
      {
        name: 'Elegant Forgot password',
        href: routes.auth.forgotPassword4,
      },
      {
        name: 'Classic Forgot password',
        href: routes.auth.forgotPassword5,
      },
    ],
  },
  {
    name: 'OTP Pages',
    href: '#',
    icon: <PiChatCenteredDotsDuotone />,
    platformOnly: true,
    dropdownItems: [
      {
        name: 'Modern OTP page',
        href: routes.auth.otp1,
      },
      {
        name: 'Vintage OTP page',
        href: routes.auth.otp2,
      },
      {
        name: 'Trendy OTP page',
        href: routes.auth.otp3,
      },
      {
        name: 'Elegant OTP page',
        href: routes.auth.otp4,
      },
      {
        name: 'Classic OTP page',
        href: routes.auth.otp5,
      },
    ],
  },
];

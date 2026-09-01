export const routes = {
  // Post-login landing route — the app homepage (the "All Apps" menu screen
  // at /). Kept as `dashboard` because every consumer is the sign-in flow's
  // redirect; the ecommerce dashboard stays reachable via its own menu tile.
  dashboard: '/',
  signIn: '/signin',
  warehouses: {
    list: '/warehouses',
    analysis: '/warehouses/analysis',
    detail: (id: string) => `/warehouses/${id}`,
    product: (id: string) => `/warehouses/product/${id}`,
    // Warehouse / inventory settings (sections of the central settings page)
    settings: '/settings#warehouses',
    inventorySettings: '/settings#pos_inventory',
  },
  inventory: {
    index: '/inventory',
    // Operations
    transfers: '/inventory/transfers',
    receipts: '/inventory/receipts',
    deliveries: '/inventory/deliveries',
    internal: '/inventory/internal',
    adjustments: '/inventory/adjustments',
    physicalInventory: '/inventory/physical-inventory',
    scrap: '/inventory/scrap',
    procurement: '/inventory/procurement',
    replenishment: '/inventory/replenishment',
    // Reporting
    stock: '/inventory/stock',
    locations: '/inventory/locations',
    valuation: '/inventory/valuation',
    movesHistory: '/inventory/moves',
    // Configuration (backed pages live elsewhere; placeholders live here)
    settings: '/settings#warehouses',
    operationTypes: '/inventory/configuration/operation-types',
    configLocations: '/inventory/configuration/locations',
    storageCategories: '/inventory/configuration/storage-categories',
    putawayRules: '/inventory/configuration/putaway-rules',
    attributes: '/inventory/configuration/attributes',
    deliveryMethods: '/inventory/configuration/delivery-methods',
    packageTypes: '/inventory/configuration/package-types',
  },
  employees: {
    list: '/employees',
    detail: (id: string) => `/employees/${id}`,
    // Org structure. `/employees/:path*` is already in the middleware
    // allow-list, so these need no new matcher entry.
    departments: '/employees/departments',
    jobPositions: '/employees/job-positions',
    roles: '/employees/roles',
    // Planning. Same story: covered by the `/employees/:path*` matcher.
    shifts: '/employees/shifts',
    shiftTemplates: '/employees/shifts/templates',
    attendance: '/employees/attendance',
    // The kiosk a signed-in manager opens. Gated with everything else under
    // /employees — see publicKiosk below for the one anybody can open.
    attendanceKiosk: '/employees/attendance/kiosk',
    // Pairing screens that clock staff in with no login. Admin-only, and
    // therefore under /employees; the screens it pairs are not.
    attendanceDevices: '/employees/attendance/devices',
    // One person's history and rating. `kiosk` above is a static segment, so
    // it still wins over this dynamic one.
    attendanceFor: (id: string) => `/employees/attendance/${id}`,
    timeOff: '/employees/time-off',
    swaps: '/employees/swaps',
  },

  /**
   * The clock on a screen nobody signs in to.
   *
   * A TOP-LEVEL path, not one under `/employees`, and that is the whole design:
   * `middleware.ts` gates by an explicit list which includes `/employees/:path*`,
   * so a page that must render logged out has to live outside it. The token is
   * the credential — see the comments in middleware.ts and app/kiosk/[token].
   */
  publicKiosk: (token: string) => `/kiosk/${encodeURIComponent(token)}`,
  contacts: {
    list: '/contacts',
    // `key` is the "source:id" handle returned on each Contact.
    detail: (key: string) => `/contacts/${key}`,
  },
  eCommerce: {
    dashboard: '/ecommerce',
    products: '/products',
    createProduct: '/products/create',
    productDetails: (slug: string) => `/products/${slug}`,
    ediProduct: (slug: string) => `/products/${slug}/edit`,
    subProducts: '/sub-products',
    createSubProduct: '/sub-products/create',
    subProductDetails: (slug: string) => `/sub-products/${slug}`,
    editSubProduct: (slug: string) => `/sub-products/${slug}/edit`,
    purchases: '/purchases',
    createPurchase: '/purchases/create',
    purchaseReceipt: (id: string) => `/purchases/receipt/${id}`,
    purchaseDetails: (id: string) => `/purchases/${id}`,
    editPurchase: (id: string) => `/purchases/${id}/edit`,
    purchaseVendors: '/purchases/vendors',
    receivePurchase: '/purchases/receive',
    validateReceipt: '/purchases/validate',
    // Vendor Bills Routes
    vendorBills: '/purchases/bills',
    createVendorBill: '/purchases/bills/create',
    vendorBillDetails: (id: string) => `/purchases/bills/${id}`,
    // Vendor Returns Routes
    vendorReturns: '/purchases/returns',
    createVendorReturn: '/purchases/returns/create',
    vendorReturnDetails: (id: string) => `/purchases/returns/${id}`,
    // Purchase Analytics
    purchaseAnalytics: '/purchases/analytics',
    // Purchase Settings
    purchaseSettings: '/settings#purchases',
    // Purchase Agreements (Blanket Orders)
    purchaseAgreements: '/purchases/agreements',
    createPurchaseAgreement: '/purchases/agreements/create',
    purchaseAgreementDetails: (id: string) => `/purchases/agreements/${id}`,
    // Vendor Pricelists
    vendorPricelists: '/purchases/pricelists',
    createVendorPricelist: '/purchases/pricelists/create',
    vendorPricelistDetails: (id: string) => `/purchases/pricelists/${id}`,
    // UOM Conversions
    uomConversions: '/purchases/uom-conversions',
    createUomConversion: '/purchases/uom-conversions/create',
    // Exchange Rates
    exchangeRates: '/purchases/exchange-rates',
    createExchangeRate: '/purchases/exchange-rates/create',
    // Stock Transfers
    stockTransfers: '/purchases/transfers',
    createStockTransfer: '/purchases/transfers/create',
    stockTransferDetails: (id: string) => `/purchases/transfers/${id}`,
    editStockTransfer: (id: string) => `/purchases/transfers/${id}/edit`,
    // Sales (quotations -> orders -> fulfillment -> returns)
    sales: '/sales',
    createSale: '/sales/create',
    salesQuotations: '/sales/quotations',
    salesOrders: '/sales/orders',
    salesAnalytics: '/sales/analytics',
    salesDetails: (id: string) => `/sales/${id}`,
    salesEdit: (id: string) => `/sales/${id}/edit`,
    salesPrint: (id: string, type: 'quotation' | 'proforma') =>
      `/sales/${id}/print?type=${type}`,
    salesFulfillList: '/sales/fulfill',
    salesFulfillDetails: (id: string) => `/sales/fulfill/${id}`,
    salesReturns: '/sales/returns',
    createSalesReturn: '/sales/returns/create',
    salesReturnDetails: (id: string) => `/sales/returns/${id}`,
    categories: '/categories',
    createCategory: '/categories/create',
    editCategory: (id: string) => `/categories/${id}/edit`,
    categoryProducts: (id: string) => `/categories/${id}`,
    subCategories: '/sub-categories',
    createSubCategory: '/sub-categories/create',
    editSubCategory: (id: string) => `/sub-categories/${id}/edit`,
    subCategoryProducts: (id: string) => `/sub-categories/${id}`,
    brands: '/brands',
    createBrand: '/brands/create',
    editBrand: (id: string) => `/brands/${id}/edit`,
    brandProducts: (id: string) => `/brands/${id}`,
    tenants: '/tenants',
    createTenant: '/tenants/create',
    tenantDetails: (id: string) => `/tenants/${id}`,
    editTenant: (id: string) => `/tenants/${id}/edit`,
    orders: '/ecommerce/orders',
    orderDetails: (id: string) => `/ecommerce/orders/${id}`,
    // Marketplace carts that haven't converted to orders yet. There is
    // deliberately no singular '/ecommerce/cart' — that was unwired Hydrogen
    // template code and was deleted along with its route key.
    carts: '/ecommerce/carts',
    reviews: '/ecommerce/reviews',
    promotions: '/ecommerce/promotions',
    createPromotion: '/ecommerce/promotions/create',
    editPromotion: (id: string) => `/ecommerce/promotions/${id}/edit`,
    banners: '/banners',
    createBanner: '/banners/create',
    bannerAnalytics: '/banners/analytics',
    editBanner: (id: string) => `/banners/${id}/edit`,
    bannerDetails: (id: string) => `/banners/${id}`,
    shop: '/ecommerce/shop',
    checkout: '/ecommerce/checkout',
    trackingId: (id: string) => `/ecommerce/tracking/${id}`,
  },
  blog: {
    list: '/blog',
    create: '/blog/create',
    edit: (id: string) => `/blog/${id}/edit`,
  },
  searchAndFilter: {
    realEstate: '/search/real-estate',
    nft: '/search/nft',
    flight: '/search/flight',
  },
  support: {
    dashboard: '/support',
    inbox: '/support/inbox',
    supportCategory: (category: string) => `/support/inbox/${category}`,
    messageDetails: (id: string) => `/support/inbox/${id}`,
    // Snippets are created and edited in a drawer on the list page, so there
    // are no create/view/edit routes. Templates were the same concept under a
    // second name and were merged into snippets.
    snippets: '/support/snippets',
  },
  logistics: {
    dashboard: '/logistics',
    drivers: '/logistics/drivers',
    shipmentList: '/logistics/shipments',
    customerProfile: '/logistics/customer-profile',
    createShipment: '/logistics/shipments/create',
    editShipment: (id: string) => `/logistics/shipments/${id}/edit`,
    shipmentDetails: (id: string) => `/logistics/shipments/${id}`,
    tracking: (id: string) => `/logistics/tracking/${id}`,
  },
  appointment: {
    dashboard: '/appointment',
    appointmentList: '/appointment/list',
  },
  crm: {
    dashboard: '/crm',
  },
  affiliate: {
    dashboard: 'https://isomorphic-dnd.vercel.app',
  },
  storeAnalytics: {
    dashboard: '/store-analytics',
  },
  bidding: {
    dashboard: '/bidding',
  },
  executive: {
    dashboard: '/executive',
  },
  project: {
    dashboard: '/project',
  },
  socialMedia: {
    dashboard: '/social-media',
  },
  jobBoard: {
    dashboard: '/job-board',
    jobFeed: '/job-board/feed',
  },
  analytics: '/analytics',
  // Accounting module (Pro-tier ERM — double-entry ledger + AR/AP)
  accounting: {
    index: '/accounting',
    journalEntries: '/accounting/journal-entries',
    reports: '/accounting/reports',
    chartOfAccounts: '/accounting/chart-of-accounts',
    taxes: '/accounting/taxes',
    invoices: '/accounting/invoices',
    bills: '/accounting/bills',
    creditNotes: '/accounting/credit-notes',
    payments: '/accounting/payments',
    batchPayments: '/accounting/batch-payments',
    products: '/accounting/products',
    customers: '/accounting/customers',
    vendors: '/accounting/vendors',
  },
  // Taxes (Your Store accounting — rates, ledger, summary tabs)
  taxes: '/accounting/taxes',
  financial: {
    dashboard: '/financial',
  },
  podcast: {
    dashboard: '/podcast',
  },
  file: {
    dashboard: '/file',
    manager: '/file-manager',
    upload: '/file-manager/upload',
    create: '/file-manager/create',
  },
  pos: {
    index: '/point-of-sale',
    sell: '/point-of-sale/sell',
    history: '/point-of-sale/history',
    sessions: '/point-of-sale/sessions',
    login: '/point-of-sale/login',
    lock: '/point-of-sale/lock',
    cashiers: '/point-of-sale/cashiers',
    settings: '/settings#point_of_sale',
    loyalty: '/point-of-sale/loyalty',
    orders: '/point-of-sale/orders',
    orderAnalysis: '/point-of-sale/order-analysis',
    salesDetails: '/point-of-sale/sales-details',
    sessionReport: '/point-of-sale/session-report',
    pricelists: '/pos/pricelists',
    combos: '/point-of-sale/combos',
    // Standalone cashier POS (uses pos_token, not admin JWT)
    cashierLogin: '/pos/login',
    cashierDashboard: '/pos/dashboard',
    cashierSell: '/pos/sell',
    cashierSellOrders: '/pos/sell/orders',
  },
  eventCalendar: '/event-calendar',
  rolesPermissions: '/roles-permissions',
  invoice: {
    home: '/invoice',
    create: '/invoice/create',
    details: (id: string) => `/invoice/${id}`,
    edit: (id: string) => `/invoice/${id}/edit`,
    builder: '/invoice/builder',
  },
  imageViewer: '/image-viewer',
  widgets: {
    cards: '/widgets/cards',
    icons: '/widgets/icons',
    charts: '/widgets/charts',
    maps: '/widgets/maps',
    banners: '/widgets/banners',
  },
  tables: {
    basic: '/tables/basic',
    collapsible: '/tables/collapsible',
    enhanced: '/tables/enhanced',
    pagination: '/tables/pagination',
    search: '/tables/search',
    stickyHeader: '/tables/sticky-header',
    resizable: '/tables/resizable',
    pinning: '/tables/pinning',
    dnd: '/tables/dnd',
  },
  multiStep: '/multi-step',
  multiStep2: '/multi-step-2',
  forms: {
    profileSettings: '/forms/profile-settings',
    notificationPreference: '/forms/profile-settings/notification',
    personalInformation: '/forms/profile-settings/profile',
    newsletter: '/forms/newsletter',
  },
  billing: '/settings/billing',
  emailTemplates: '/email-templates',
  profile: '/profile',
  welcome: '/welcome',
  comingSoon: '/coming-soon',
  accessDenied: '/access-denied',
  notFound: '/not-found',
  maintenance: '/maintenance',
  blank: '/blank',
  auth: {
    // The Isomorphic template's demo auth routes (sign-in-1..5, sign-up-1..5,
    // otp-1..5, forgot-password-2..5) were deleted along with /signup; only the
    // two routes the app actually uses remain.
    forgotPassword: '/forgot-password',
    // reset password (token from the emailed link)
    resetPassword: (token: string) => `/auth/reset-password/${token}`,
  },
};

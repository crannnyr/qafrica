// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';

// Scroll reset on every route change
import ScrollToTop from '@/components/ScrollToTop';

// Pages
const LandingPage = lazy(() => import('@/pages/landing/LandingPage'));
const StoreOwnersPage = lazy(() => import('@/pages/landing/StoreOwnersPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const SignupPage = lazy(() => import('@/pages/auth/SignupPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const NicheSelectionPage = lazy(() => import('@/pages/auth/NicheSelectionPage'));
const OnboardingStoreSetup = lazy(() => import('@/pages/auth/OnboardingStoreSetup'));
const PostSignupChoice = lazy(() => import('@/pages/auth/PostSignupChoice'));
const PricingPage = lazy(() => import('@/pages/auth/PricingPage'));
const PaymentCallbackPage = lazy(() => import('@/pages/auth/PaymentCallbackPage'));
const AcceptStaffInvitePage = lazy(() => import('@/pages/auth/AcceptStaffInvitePage'));
const JumiaSignupPage = lazy(() => import('@/pages/auth/JumiaSignupPage'));

// Legal Pages
const PrivacyPolicyPage = lazy(() => import('@/pages/legal/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('@/pages/legal/TermsOfServicePage'));
const ImportTermsPage = lazy(() => import('@/pages/legal/ImportTermsPage'));
const ImportTrackingPage = lazy(() => import('@/pages/recommendations/ImportTrackingPage'));

// Blog Pages
const BlogIndexPage = lazy(() => import('@/pages/blog/BlogIndexPage'));
const BlogPostPage = lazy(() => import('@/pages/blog/BlogPostPage'));

// China Import / Recommendations Pages
const ImportPage = lazy(() => import('@/pages/import/ImportPage'));
const ImportAdminLogin = lazy(() => import('@/pages/import-admin/ImportAdminLogin'));
const ImportAdminPage = lazy(() => import('@/pages/import-admin/ImportAdminPage'));
const ImporterDashboardPage = lazy(() => import('@/pages/recommendations/ImporterDashboardPage'));
const RecommendationsPage = lazy(() => import('@/pages/recommendations/RecommendationsPage'));
const RecommendationsProductDetailPage = lazy(() => import('@/pages/recommendations/ProductDetailPage'));
const LogisticsBlogPage = lazy(() => import('@/pages/recommendations/LogisticsBlogPage'));

// Marketplace Pages
const MarketplacePage = lazy(() => import('@/pages/MarketplacePage'));

// Dashboard Pages
const DashboardLayout = lazy(() => import('@/pages/dashboard/DashboardLayout'));
const DashboardHome = lazy(() => import('@/pages/dashboard/DashboardHome'));
const StoreSetup = lazy(() => import('@/pages/dashboard/StoreSetup'));
const ProductsPage = lazy(() => import('@/pages/dashboard/ProductsPage'));
const AddProductPage = lazy(() => import('@/pages/dashboard/AddProduct'));
const EditProductPage = lazy(() => import('@/pages/dashboard/EditProduct'));
const ImportCatalogPage = lazy(() => import('@/pages/dashboard/ImportCatalogPage'));
const OrdersPage = lazy(() => import('@/pages/dashboard/OrdersPage'));
const ManualSalesPage = lazy(() => import('@/pages/dashboard/ManualSalesPage'));
const OrderManagementPage = lazy(() => import('@/pages/dashboard/OrderManagementPage'));
const OrderDetailPage = lazy(() => import('@/pages/dashboard/OrderDetailPage'));
const DropshipOrdersPage = lazy(() => import('@/pages/dashboard/DropshipOrdersPage'));
const DropshipOrderDetailPage = lazy(() => import('@/pages/dashboard/DropshipOrderDetailPage'));
const WalletPage = lazy(() => import('@/pages/dashboard/WalletPage'));
const DeliveryZonesPage = lazy(() => import('@/pages/dashboard/DeliveryZones'));
const DomainPage = lazy(() => import('@/pages/dashboard/DomainPage'));
const AnalyticsPage = lazy(() => import('@/pages/dashboard/AnalyticsPage'));
const TaxExpensesPage = lazy(() => import('@/pages/dashboard/TaxExpensesPage'));
const StoreSettingsPage = lazy(() => import('@/pages/dashboard/StoreSettingsPage'));
const SubscriptionPage = lazy(() => import('@/pages/dashboard/SubscriptionPage'));
const HowToUsePage = lazy(() => import('@/pages/dashboard/HowToUsePage'));
const ReviewsPage = lazy(() => import('@/pages/dashboard/ReviewsPage'));
const BulkImportPage = lazy(() => import('@/pages/dashboard/BulkImportPage'));
const CouponsPage = lazy(() => import('@/pages/dashboard/CouponsPage'));
const StoreTemplatesPage = lazy(() => import('@/pages/dashboard/StoreTemplatesPage'));
const NicheCustomizationPage = lazy(() => import('@/pages/dashboard/NicheCustomizationPage'));

// Marketplace Dashboard Pages
const JumiaPage = lazy(() => import('@/pages/dashboard/JumiaPage'));
const JumiaAddItemPage = lazy(() => import('@/pages/dashboard/JumiaAddItemPage'));
const JumiaDropOffLocationsPage = lazy(() => import('@/pages/dashboard/JumiaDropOffLocationsPage'));
const JumiaWalletPage = lazy(() => import('@/pages/dashboard/JumiaWalletPage'));
const JumiaHowToScalePage = lazy(() => import('@/pages/dashboard/JumiaHowToScalePage'));
const JumiaItemDetailPage = lazy(() => import('@/pages/dashboard/Jumia/JumiaItemDetailPage'));
const KongaPage = lazy(() => import('@/pages/dashboard/KongaPage'));
const JijiPage = lazy(() => import('@/pages/dashboard/JijiPage'));

// Standalone Jumia-only dashboard (signup_intent === 'jumia')
const JumiaDashboardLayout = lazy(() => import('@/pages/dashboard/JumiaDashboardLayout'));

// Store Pages
const StorePage = lazy(() => import('@/pages/store/StorePage'));
const ProductDetailPage = lazy(() => import('@/pages/store/ProductDetailPage'));
const CheckoutPage = lazy(() => import('@/pages/store/CheckoutPage'));
const StoreClosedPage = lazy(() => import('@/pages/store/StoreClosedPage'));
const StoreNotFoundPage = lazy(() => import('@/pages/store/StoreNotFoundPage'));

// Customer Pages
const CustomerLoginPage = lazy(() => import('@/pages/customer/CustomerLoginPage'));
const CustomerSignupPage = lazy(() => import('@/pages/customer/CustomerSignupPage'));
const CustomerDashboard = lazy(() => import('@/pages/customer/CustomerDashboard/index'));
const CustomerOrderDetailPage = lazy(() => import('@/pages/customer/CustomerOrderDetailPage'));
const StoreDiscoveryPage = lazy(() => import('@/pages/customer/StoreDiscoveryPage'));
const UniversalCartPage = lazy(() => import('@/pages/customer/UniversalCartPage'));
const UniversalCheckoutPage = lazy(() => import('@/pages/customer/UniversalCheckoutPage'));

// Admin Pages
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminStores = lazy(() => import('@/pages/admin/AdminStores'));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts'));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminWithdrawals = lazy(() => import('@/pages/admin/AdminWithdrawals'));
const AdminFailures = lazy(() => import('@/pages/admin/AdminFailures'));
const AdminSubscriptions = lazy(() => import('@/pages/admin/AdminSubscriptions'));
const AdminDomainRequests = lazy(() => import('@/pages/admin/AdminDomainRequests'));
const AdminEmailControls = lazy(() => import('@/pages/admin/AdminEmailControls'));
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'));
const AdminLegal = lazy(() => import('@/pages/admin/AdminLegal'));
const AdminShipbubblePage = lazy(() => import('@/pages/admin/AdminShipbubble'));
const AdminJumia = lazy(() => import('@/pages/admin/AdminJumia'));
const AdminJumiaSubmissionDetail = lazy(() => import('@/pages/admin/AdminJumiaSubmissionDetail'));
const AdminJumiaWithdrawals = lazy(() => import('@/pages/admin/AdminJumiaWithdrawals'));
const AdminJumiaSettings = lazy(() => import('@/pages/admin/AdminJumiaSettings'));

// Developer Pages
const DeveloperLayout = lazy(() => import('@/pages/developer/dashboard/DeveloperLayout'));
const DeveloperDashboardHome = lazy(() => import('@/pages/developer/dashboard/DeveloperDashboardHome'));
const DeveloperSignupPage = lazy(() => import('@/pages/developer/auth/DeveloperSignupPage'));
const DeveloperLoginPage = lazy(() => import('@/pages/developer/auth/DeveloperLoginPage'));
const DeveloperVerifyEmailPage = lazy(() => import('@/pages/developer/auth/DeveloperVerifyEmailPage'));
const DeveloperForgotPasswordPage = lazy(() => import('@/pages/developer/auth/DeveloperForgotPasswordPage'));
const DeveloperResetPasswordPage = lazy(() => import('@/pages/developer/auth/DeveloperResetPasswordPage'));
const DeveloperOnboardingPage = lazy(() => import('@/pages/developer/onboarding/DeveloperOnboardingPage'));
const PaystackConnectCallbackPage = lazy(() => import('@/pages/developer/onboarding/PaystackConnectCallbackPage'));
const DeveloperApiKeysPage = lazy(() => import('@/pages/developer/dashboard/DeveloperApiKeysPage'));
const DeveloperCatalogPage = lazy(() => import('@/pages/developer/dashboard/DeveloperCatalogPage'));
const DeveloperImportsPage = lazy(() => import('@/pages/developer/dashboard/DeveloperImportsPage'));
const DeveloperProductsPage = lazy(() => import('@/pages/developer/dashboard/DeveloperProductsPage'));
const DeveloperOrdersPage = lazy(() => import('@/pages/developer/dashboard/DeveloperOrdersPage'));
const DeveloperOrderDetailPage = lazy(() => import('@/pages/developer/dashboard/DeveloperOrderDetailPage'));
const DeveloperWebhooksPage = lazy(() => import('@/pages/developer/dashboard/DeveloperWebhooksPage'));
const DeveloperWalletPage = lazy(() => import('@/pages/developer/dashboard/DeveloperWalletPage'));
const DeveloperSubscriptionPage = lazy(() => import('@/pages/developer/dashboard/DeveloperSubscriptionPage'));
const DeveloperSettingsPage = lazy(() => import('@/pages/developer/dashboard/DeveloperSettingsPage'));
const DeveloperDocsPage = lazy(() => import('@/pages/developer/dashboard/DeveloperDocsPage'));

// Guards
import StaffGuard from '@/components/StaffGuard';

// Custom Domain Router
import CustomDomainRouter from '@/components/CustomDomainRouter';

// ── Route helpers ─────────────────────────────────────────────────────────────

const isInOnboardingFlow = (user: any) => {
  return sessionStorage.getItem('signup_email') !== null && !user?.onboarding_completed;
};

const ProtectedRoute = ({
  children,
  requireAdmin = false,
  isOnboardingRoute = false,
  isJumiaRoute = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  isOnboardingRoute?: boolean;
  /** Routes under /jumia-dashboard/*. Keeps Jumia-only sellers and regular store
   * owners in their own separate route trees regardless of which URL they land on. */
  isJumiaRoute?: boolean;
}) => {
  const { isAuthenticated, user } = useAuthStore();

  if (isOnboardingRoute) {
    const inOnboarding = isInOnboardingFlow(user);
    // A returning user who logged in successfully (so we have their real profile)
    // but hasn't finished onboarding yet should be allowed in even if their
    // sessionStorage flags from the original signup session are long gone
    // (e.g. they closed the app and came back later to continue).
    const hasValidPendingOnboardingUser = !!user && user.onboarding_completed !== true;
    if (!isAuthenticated && !inOnboarding && !hasValidPendingOnboardingUser) {
      return <Navigate to="/login" replace />;
    }
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Jumia-only sellers (signup_intent === 'jumia') and regular store owners
  // live in separate route trees. Cross-redirect anyone who lands in the wrong one.
  const isJumiaUser = user?.signup_intent === 'jumia';

  if (isJumiaRoute && !isJumiaUser) {
    return <Navigate to="/dashboard" replace />;
  }
  if (!isJumiaRoute && isJumiaUser) {
    return <Navigate to="/jumia-dashboard" replace />;
  }
  if (isJumiaRoute) {
    // Jumia-only sellers have onboarding_completed=true set at signup and no
    // niche/staff/admin concept — nothing further to check.
    return <>{children}</>;
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (user?.role === 'staff') {
    return <>{children}</>;
  }

  const hasCompletedOnboarding = user?.onboarding_completed === true;

  if (!hasCompletedOnboarding) {
    return <Navigate to="/select-niche" replace />;
  }

  if (hasCompletedOnboarding && sessionStorage.getItem('signup_email')) {
    sessionStorage.removeItem('signup_email');
    sessionStorage.removeItem('onboarding_step');
    sessionStorage.removeItem('onboarding_store_id');
    sessionStorage.removeItem('selected_niches');
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (isInOnboardingFlow(user)) {
    return <Navigate to="/select-niche" replace />;
  }

  if (!isAuthenticated) {
    return <>{children}</>;
  }

  if (user?.onboarding_completed !== true) {
    return <Navigate to="/select-niche" replace />;
  }

  if (user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (user?.signup_intent === 'jumia') {
    return <Navigate to="/jumia-dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

// Shown briefly while a route's code is being fetched (lazy-loaded chunks).
// Kept minimal and fast — this appears on every navigation to a
// not-yet-loaded page, so it needs to render instantly with zero
// additional network requests of its own.
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const { fetchProfile } = useAuthStore();

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: { fontFamily: 'Inter, system-ui, sans-serif' },
        }}
      />
      <CustomDomainRouter>
        {/* Resets scroll to top on every route change — must be inside the router */}
        <ScrollToTop />

        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ── Public Routes ── */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/store-owners" element={<StoreOwnersPage />} />
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
          <Route path="/signup/jumia" element={<PublicRoute><JumiaSignupPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* ── Legal ── */}
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />
          <Route path="/import-terms" element={<ImportTermsPage />} />
          <Route path="/track" element={<ImportTrackingPage />} />

          {/* ── Blog ── */}
          <Route path="/blog" element={<BlogIndexPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />

          {/* ── China Import & Recommendations — public, no auth needed ── */}
          <Route path="/importations" element={<ImportPage />} />
          <Route path="/importations/admin/login" element={<ImportAdminLogin />} />
          <Route path="/importations/admin" element={<ImportAdminPage />} />
          <Route path="/importations/dashboard" element={<ImporterDashboardPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/recommendations/logistics" element={<LogisticsBlogPage />} />
          <Route path="/recommendations/:id" element={<RecommendationsProductDetailPage />} />

          {/* ── Marketplace landing — public funnel from blog CTAs ── */}
          <Route path="/marketplaces" element={<MarketplacePage />} />

          {/* ── Onboarding ── */}
          <Route path="/select-niche" element={
            <ProtectedRoute isOnboardingRoute={true}><NicheSelectionPage /></ProtectedRoute>
          } />
          <Route path="/onboarding/store-setup" element={
            <ProtectedRoute isOnboardingRoute={true}><OnboardingStoreSetup /></ProtectedRoute>
          } />
          <Route path="/onboarding/choice" element={
            <ProtectedRoute isOnboardingRoute={true}><PostSignupChoice /></ProtectedRoute>
          } />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/payment/callback" element={<PaymentCallbackPage />} />

          {/* ── Customer ── */}
          <Route path="/customer/login" element={<CustomerLoginPage />} />
          <Route path="/customer/signup" element={<CustomerSignupPage />} />
          <Route path="/customer/dashboard" element={<CustomerDashboard />} />
          <Route path="/customer/orders/:orderId" element={<CustomerOrderDetailPage />} />
          <Route path="/stores" element={<StoreDiscoveryPage />} />
          <Route path="/cart" element={<UniversalCartPage />} />
          <Route path="/checkout" element={<UniversalCheckoutPage />} />

          {/* ── Staff invite ── */}
          <Route path="/accept-staff-invite" element={<AcceptStaffInvitePage />} />

          {/* ── Dashboard ── */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardLayout /></ProtectedRoute>
          }>
            <Route index element={<DashboardHome />} />
            <Route path="store-setup" element={<StoreSetup />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/add" element={<StaffGuard permission="can_manage_products"><AddProductPage /></StaffGuard>} />
            <Route path="products/edit/:productId" element={<StaffGuard permission="can_manage_products"><EditProductPage /></StaffGuard>} />
            <Route path="products/bulk-import" element={<StaffGuard permission="can_manage_products"><BulkImportPage /></StaffGuard>} />
            <Route path="import-catalog" element={<StaffGuard permission="can_manage_products"><ImportCatalogPage /></StaffGuard>} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:orderId" element={<OrderDetailPage />} />
            <Route path="order-management" element={<OrderManagementPage />} />
            <Route path="dropship-orders" element={<DropshipOrdersPage />} />
            <Route path="dropship-orders/:orderId" element={<DropshipOrderDetailPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="coupons" element={<StaffGuard permission="can_manage_products"><CouponsPage /></StaffGuard>} />
            <Route path="wallet" element={<StaffGuard permission="can_manage_wallet"><WalletPage /></StaffGuard>} />
            <Route path="delivery-zones" element={<StaffGuard permission="can_manage_settings"><DeliveryZonesPage /></StaffGuard>} />
            <Route path="domain" element={<StaffGuard permission="can_manage_settings"><DomainPage /></StaffGuard>} />
            <Route path="analytics" element={<StaffGuard permission="can_view_analytics"><AnalyticsPage /></StaffGuard>} />
            <Route path="tax-expenses" element={<StaffGuard permission="can_manage_wallet"><TaxExpensesPage /></StaffGuard>} />
            <Route path="settings" element={<StaffGuard><StoreSettingsPage /></StaffGuard>} />
            <Route path="templates" element={<StaffGuard permission="can_manage_settings"><StoreTemplatesPage /></StaffGuard>} />
            <Route path="subscription" element={<StaffGuard><SubscriptionPage /></StaffGuard>} />
            <Route path="niches" element={<StaffGuard permission="can_manage_settings"><NicheCustomizationPage /></StaffGuard>} />
            <Route path="how-to-use" element={<HowToUsePage />} />
            <Route path="manual-sales" element={<ManualSalesPage />} />
            <Route path="jumia" element={<JumiaPage />} />
            <Route path="jumia/add" element={<JumiaAddItemPage />} />
            <Route path="jumia/locations" element={<JumiaDropOffLocationsPage />} />
            <Route path="jumia/wallet" element={<JumiaWalletPage />} />
            <Route path="jumia/how-to-scale" element={<JumiaHowToScalePage />} />
            <Route path="jumia/items/:id" element={<JumiaItemDetailPage />} />
            <Route path="konga" element={<KongaPage />} />
            <Route path="jiji" element={<JijiPage />} />
          </Route>

          {/* ── Standalone Jumia-only Dashboard (signup_intent === 'jumia') ──
              Reuses the same Jumia page components as /dashboard/jumia/*.
              NOTE: those components still contain some hardcoded '/dashboard/jumia'
              internal links/redirects — being swapped to useJumiaBasePath() in an
              upcoming pass. Mounting the route tree now is safe for the build;
              some in-page navigation will point to the wrong tree until that lands.
              'settings' route intentionally omitted until JumiaSettingsPage.tsx exists. */}
          <Route path="/jumia-dashboard" element={
            <ProtectedRoute isJumiaRoute={true}><JumiaDashboardLayout /></ProtectedRoute>
          }>
            <Route index element={<JumiaPage />} />
            <Route path="add" element={<JumiaAddItemPage />} />
            <Route path="locations" element={<JumiaDropOffLocationsPage />} />
            <Route path="wallet" element={<JumiaWalletPage />} />
            <Route path="how-to-scale" element={<JumiaHowToScalePage />} />
            <Route path="items/:id" element={<JumiaItemDetailPage />} />
          </Route>

          {/* ── Admin ── */}
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin={true}><AdminLayout /></ProtectedRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="stores" element={<AdminStores />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="withdrawals" element={<AdminWithdrawals />} />
            <Route path="failures" element={<AdminFailures />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="domain-requests" element={<AdminDomainRequests />} />
            <Route path="email-controls" element={<AdminEmailControls />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="legal" element={<AdminLegal />} />
            <Route path="shipbubble" element={<AdminShipbubblePage />} />
            <Route path="jumia" element={<AdminJumia />} />
            <Route path="jumia/:id" element={<AdminJumiaSubmissionDetail />} />
            <Route path="jumia-withdrawals" element={<AdminJumiaWithdrawals />} />
            <Route path="jumia-settings" element={<AdminJumiaSettings />} />
          </Route>

          {/* ── Developer Portal ── */}
          <Route path="/developer" element={<Navigate to="/developer/login" replace />} />
          <Route path="/developer/signup" element={<DeveloperSignupPage />} />
          <Route path="/developer/login" element={<DeveloperLoginPage />} />
          <Route path="/developer/verify-email" element={<DeveloperVerifyEmailPage />} />
          <Route path="/developer/forgot-password" element={<DeveloperForgotPasswordPage />} />
          <Route path="/developer/reset-password" element={<DeveloperResetPasswordPage />} />
          <Route path="/developer/onboarding" element={<DeveloperOnboardingPage />} />
          <Route path="/developer/onboarding/paystack-callback" element={<PaystackConnectCallbackPage />} />
          <Route path="/developer/dashboard" element={<DeveloperLayout />}>
            <Route index element={<DeveloperDashboardHome />} />
            <Route path="api-keys" element={<DeveloperApiKeysPage />} />
            <Route path="catalog" element={<DeveloperCatalogPage />} />
            <Route path="imports" element={<DeveloperImportsPage />} />
            <Route path="products" element={<DeveloperProductsPage />} />
            <Route path="orders" element={<DeveloperOrdersPage />} />
            <Route path="orders/:orderId" element={<DeveloperOrderDetailPage />} />
            <Route path="webhooks" element={<DeveloperWebhooksPage />} />
            <Route path="wallet" element={<DeveloperWalletPage />} />
            <Route path="subscription" element={<DeveloperSubscriptionPage />} />
            <Route path="settings" element={<DeveloperSettingsPage />} />
            <Route path="docs" element={<DeveloperDocsPage />} />
          </Route>

          {/* ── Store Status Pages ── */}
          <Route path="/store-closed" element={<StoreClosedPage />} />
          <Route path="/store-not-found" element={<StoreNotFoundPage />} />
          <Route path="/store-inactive" element={<StoreClosedPage />} />

          {/* ── Store Routes — must stay LAST (wildcard slugs) ── */}
          <Route path="/:slug" element={<StorePage />} />
          <Route path="/:slug/product/:productId" element={<ProductDetailPage />} />
          <Route path="/:slug/checkout" element={<CheckoutPage />} />

          {/* ── Catch-all ── */}
          <Route path="*" element={<StoreNotFoundPage />} />
        </Routes>
        </Suspense>
      </CustomDomainRouter>
    </>
  );
}

export default App;

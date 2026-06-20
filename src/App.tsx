// src/App.tsx

import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { useAuthStore } from '@/stores';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';

// Pages
import LandingPage from '@/pages/landing/LandingPage';
import LoginPage from '@/pages/auth/LoginPage';
import SignupPage from '@/pages/auth/SignupPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import NicheSelectionPage from '@/pages/auth/NicheSelectionPage';
import OnboardingStoreSetup from '@/pages/auth/OnboardingStoreSetup';
import PostSignupChoice from '@/pages/auth/PostSignupChoice';
import PricingPage from '@/pages/auth/PricingPage';
import PaymentCallbackPage from '@/pages/auth/PaymentCallbackPage';
import AcceptStaffInvitePage from '@/pages/auth/AcceptStaffInvitePage';

// Legal Pages
import PrivacyPolicyPage from '@/pages/legal/PrivacyPolicyPage';
import TermsOfServicePage from '@/pages/legal/TermsOfServicePage';

// Dashboard Pages
import DashboardLayout from '@/pages/dashboard/DashboardLayout';
import DashboardHome from '@/pages/dashboard/DashboardHome';
import StoreSetup from '@/pages/dashboard/StoreSetup';
import ProductsPage from '@/pages/dashboard/ProductsPage';
import AddProductPage from '@/pages/dashboard/AddProductPage';
import EditProductPage from '@/pages/dashboard/EditProductPage';
import ImportCatalogPage from '@/pages/dashboard/ImportCatalogPage';
import OrdersPage from '@/pages/dashboard/OrdersPage';
import ManualSalesPage from '@/pages/dashboard/ManualSalesPage';
import OrderManagementPage from '@/pages/dashboard/OrderManagementPage';
import OrderDetailPage from '@/pages/dashboard/OrderDetailPage';
import DropshipOrdersPage from '@/pages/dashboard/DropshipOrdersPage';
import DropshipOrderDetailPage from '@/pages/dashboard/DropshipOrderDetailPage';
import WalletPage from '@/pages/dashboard/WalletPage';
import DeliveryZonesPage from '@/pages/dashboard/DeliveryZonesPage';
import DomainPage from '@/pages/dashboard/DomainPage';
import AnalyticsPage from '@/pages/dashboard/AnalyticsPage';
import TaxExpensesPage from '@/pages/dashboard/TaxExpensesPage';
import StoreSettingsPage from '@/pages/dashboard/StoreSettingsPage';
import SubscriptionPage from '@/pages/dashboard/SubscriptionPage';
import HowToUsePage from '@/pages/dashboard/HowToUsePage';
import ReviewsPage from '@/pages/dashboard/ReviewsPage';
import BulkImportPage from '@/pages/dashboard/BulkImportPage';
import CouponsPage from '@/pages/dashboard/CouponsPage';
import StoreTemplatesPage from '@/pages/dashboard/StoreTemplatesPage';
import NicheCustomizationPage from '@/pages/dashboard/NicheCustomizationPage';

// Marketplace Placeholder Pages
import JumiaPage from '@/pages/dashboard/JumiaPage';
import KongaPage from '@/pages/dashboard/KongaPage';
import JijiPage from '@/pages/dashboard/JijiPage';

// Store Pages
import StorePage from '@/pages/store/StorePage';
import ProductDetailPage from '@/pages/store/ProductDetailPage';
import CheckoutPage from '@/pages/store/CheckoutPage';
import StoreClosedPage from '@/pages/store/StoreClosedPage';
import StoreNotFoundPage from '@/pages/store/StoreNotFoundPage';

// Customer Pages
import CustomerLoginPage from '@/pages/customer/CustomerLoginPage';
import CustomerSignupPage from '@/pages/customer/CustomerSignupPage';
import CustomerDashboard from '@/pages/customer/CustomerDashboard';
import CustomerOrderDetailPage from '@/pages/customer/CustomerOrderDetailPage';
import StoreDiscoveryPage from '@/pages/customer/StoreDiscoveryPage';
import UniversalCartPage from '@/pages/customer/UniversalCartPage';
import UniversalCheckoutPage from '@/pages/customer/UniversalCheckoutPage';

// Admin Pages
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsers from '@/pages/admin/AdminUsers';
import AdminStores from '@/pages/admin/AdminStores';
import AdminProducts from '@/pages/admin/AdminProducts';
import AdminOrders from '@/pages/admin/AdminOrders';
import AdminWithdrawals from '@/pages/admin/AdminWithdrawals';
import AdminSubscriptions from '@/pages/admin/AdminSubscriptions';
import AdminDomainRequests from '@/pages/admin/AdminDomainRequests';
import AdminNotifications from '@/pages/admin/AdminNotifications';
import AdminLegal from '@/pages/admin/AdminLegal';

// Developer Pages
import DeveloperLayout from '@/pages/developer/dashboard/DeveloperLayout';
import DeveloperDashboardHome from '@/pages/developer/dashboard/DeveloperDashboardHome';
import DeveloperSignupPage from '@/pages/developer/auth/DeveloperSignupPage';
import DeveloperLoginPage from '@/pages/developer/auth/DeveloperLoginPage';
import DeveloperVerifyEmailPage from '@/pages/developer/auth/DeveloperVerifyEmailPage';
import DeveloperForgotPasswordPage from '@/pages/developer/auth/DeveloperForgotPasswordPage';
import DeveloperResetPasswordPage from '@/pages/developer/auth/DeveloperResetPasswordPage';
import DeveloperOnboardingPage from '@/pages/developer/onboarding/DeveloperOnboardingPage';
import PaystackConnectCallbackPage from '@/pages/developer/onboarding/PaystackConnectCallbackPage';
import DeveloperApiKeysPage from '@/pages/developer/dashboard/DeveloperApiKeysPage';
import DeveloperCatalogPage from '@/pages/developer/dashboard/DeveloperCatalogPage';
import DeveloperImportsPage from '@/pages/developer/dashboard/DeveloperImportsPage';
import DeveloperProductsPage from '@/pages/developer/dashboard/DeveloperProductsPage';
import DeveloperOrdersPage from '@/pages/developer/dashboard/DeveloperOrdersPage';
import DeveloperOrderDetailPage from '@/pages/developer/dashboard/DeveloperOrderDetailPage';
import DeveloperWebhooksPage from '@/pages/developer/dashboard/DeveloperWebhooksPage';
import DeveloperWalletPage from '@/pages/developer/dashboard/DeveloperWalletPage';
import DeveloperSubscriptionPage from '@/pages/developer/dashboard/DeveloperSubscriptionPage';
import DeveloperSettingsPage from '@/pages/developer/dashboard/DeveloperSettingsPage';
import DeveloperDocsPage from '@/pages/developer/dashboard/DeveloperDocsPage';

// Guards
import StaffGuard from '@/components/StaffGuard';

// Custom Domain Router
import CustomDomainRouter from '@/components/CustomDomainRouter';

// ── Route helpers ─────────────────────────────────────────────────────────────

const isInOnboardingFlow = (user: any) =>
  sessionStorage.getItem('signup_email') !== null && !user?.onboarding_completed;

const ProtectedRoute = ({
  children,
  requireAdmin = false,
  isOnboardingRoute = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
  isOnboardingRoute?: boolean;
}) => {
  const { isAuthenticated, user } = useAuthStore();

  if (isOnboardingRoute) {
    const inOnboarding = isInOnboardingFlow(user);
    if (!isAuthenticated && !inOnboarding) return <Navigate to="/login" replace />;
    return <>{children}</>;
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (requireAdmin && user?.role !== 'admin') return <Navigate to="/dashboard" replace />;

  if (user?.role === 'staff') return <>{children}</>;

  const hasCompletedOnboarding = user?.onboarding_completed === true;

  if (!hasCompletedOnboarding) return <Navigate to="/select-niche" replace />;

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

  if (isInOnboardingFlow(user)) return <Navigate to="/select-niche" replace />;
  if (!isAuthenticated) return <>{children}</>;
  if (user?.onboarding_completed !== true) return <Navigate to="/select-niche" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
};

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const { fetchProfile } = useAuthStore();

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved === 'dark' || (!saved && systemDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
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
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/signup"          element={<PublicRoute><SignupPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password"  element={<ResetPasswordPage />} />

          {/* Legal */}
          <Route path="/privacy-policy"   element={<PrivacyPolicyPage />} />
          <Route path="/terms-of-service" element={<TermsOfServicePage />} />

          {/* Onboarding */}
          <Route path="/select-niche" element={
            <ProtectedRoute isOnboardingRoute={true}><NicheSelectionPage /></ProtectedRoute>
          } />
          <Route path="/onboarding/store-setup" element={
            <ProtectedRoute isOnboardingRoute={true}><OnboardingStoreSetup /></ProtectedRoute>
          } />
          <Route path="/onboarding/choice" element={
            <ProtectedRoute isOnboardingRoute={true}><PostSignupChoice /></ProtectedRoute>
          } />
          <Route path="/pricing"          element={<PricingPage />} />
          <Route path="/payment/callback" element={<PaymentCallbackPage />} />

          {/* Customer Routes */}
          <Route path="/customer/login"           element={<CustomerLoginPage />} />
          <Route path="/customer/signup"          element={<CustomerSignupPage />} />
          <Route path="/customer/dashboard"       element={<CustomerDashboard />} />
          <Route path="/customer/orders/:orderId" element={<CustomerOrderDetailPage />} />
          <Route path="/stores"                   element={<StoreDiscoveryPage />} />
          <Route path="/cart"                     element={<UniversalCartPage />} />
          <Route path="/checkout"                 element={<UniversalCheckoutPage />} />

          {/* Staff invite */}
          <Route path="/accept-staff-invite" element={<AcceptStaffInvitePage />} />

          {/* Dashboard Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute><DashboardLayout /></ProtectedRoute>
          }>
            <Route index                    element={<DashboardHome />} />
            <Route path="store-setup"       element={<StoreSetup />} />
            <Route path="products"          element={<ProductsPage />} />
            <Route path="products/add"      element={<StaffGuard><AddProductPage /></StaffGuard>} />
            <Route path="products/edit/:productId"   element={<StaffGuard><EditProductPage /></StaffGuard>} />
            <Route path="products/bulk-import"       element={<StaffGuard><BulkImportPage /></StaffGuard>} />
            <Route path="import-catalog"             element={<StaffGuard><ImportCatalogPage /></StaffGuard>} />
            <Route path="orders"                     element={<OrdersPage />} />
            <Route path="orders/:orderId"            element={<OrderDetailPage />} />
            <Route path="order-management"           element={<OrderManagementPage />} />
            <Route path="dropship-orders"            element={<DropshipOrdersPage />} />
            <Route path="dropship-orders/:orderId"   element={<DropshipOrderDetailPage />} />
            <Route path="reviews"                    element={<ReviewsPage />} />
            <Route path="coupons"                    element={<StaffGuard><CouponsPage /></StaffGuard>} />
            <Route path="wallet"                     element={<StaffGuard><WalletPage /></StaffGuard>} />
            <Route path="delivery-zones"             element={<StaffGuard><DeliveryZonesPage /></StaffGuard>} />
            <Route path="domain"                     element={<StaffGuard><DomainPage /></StaffGuard>} />
            <Route path="analytics"                  element={<StaffGuard><AnalyticsPage /></StaffGuard>} />
            <Route path="tax-expenses"               element={<StaffGuard><TaxExpensesPage /></StaffGuard>} />
            <Route path="settings"                   element={<StaffGuard><StoreSettingsPage /></StaffGuard>} />
            <Route path="templates"                  element={<StaffGuard><StoreTemplatesPage /></StaffGuard>} />
            <Route path="subscription"               element={<StaffGuard><SubscriptionPage /></StaffGuard>} />
            <Route path="niches"                     element={<StaffGuard><NicheCustomizationPage /></StaffGuard>} />
            <Route path="how-to-use"                 element={<HowToUsePage />} />
            <Route path="manual-sales"               element={<ManualSalesPage />} />

            {/* Marketplace Routes */}
            <Route path="jumia" element={<JumiaPage />} />
            <Route path="konga" element={<KongaPage />} />
            <Route path="jiji"  element={<JijiPage />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin={true}><AdminLayout /></ProtectedRoute>
          }>
            <Route index                   element={<AdminDashboard />} />
            <Route path="users"            element={<AdminUsers />} />
            <Route path="stores"           element={<AdminStores />} />
            <Route path="products"         element={<AdminProducts />} />
            <Route path="orders"           element={<AdminOrders />} />
            <Route path="withdrawals"      element={<AdminWithdrawals />} />
            <Route path="subscriptions"    element={<AdminSubscriptions />} />
            <Route path="domain-requests"  element={<AdminDomainRequests />} />
            <Route path="notifications"    element={<AdminNotifications />} />
            <Route path="legal"            element={<AdminLegal />} />
          </Route>

          {/* Developer Portal */}
          <Route path="/developer" element={<Navigate to="/developer/login" replace />} />
          <Route path="/developer/signup"                       element={<DeveloperSignupPage />} />
          <Route path="/developer/login"                        element={<DeveloperLoginPage />} />
          <Route path="/developer/verify-email"                 element={<DeveloperVerifyEmailPage />} />
          <Route path="/developer/forgot-password"              element={<DeveloperForgotPasswordPage />} />
          <Route path="/developer/reset-password"               element={<DeveloperResetPasswordPage />} />
          <Route path="/developer/onboarding"                   element={<DeveloperOnboardingPage />} />
          <Route path="/developer/onboarding/paystack-callback" element={<PaystackConnectCallbackPage />} />

          <Route path="/developer/dashboard" element={<DeveloperLayout />}>
            <Route index                element={<DeveloperDashboardHome />} />
            <Route path="api-keys"      element={<DeveloperApiKeysPage />} />
            <Route path="catalog"       element={<DeveloperCatalogPage />} />
            <Route path="imports"       element={<DeveloperImportsPage />} />
            <Route path="products"      element={<DeveloperProductsPage />} />
            <Route path="orders"        element={<DeveloperOrdersPage />} />
            <Route path="orders/:orderId" element={<DeveloperOrderDetailPage />} />
            <Route path="webhooks"      element={<DeveloperWebhooksPage />} />
            <Route path="wallet"        element={<DeveloperWalletPage />} />
            <Route path="subscription"  element={<DeveloperSubscriptionPage />} />
            <Route path="settings"      element={<DeveloperSettingsPage />} />
            <Route path="docs"          element={<DeveloperDocsPage />} />
          </Route>

          {/* Store Status Pages */}
          <Route path="/store-closed"    element={<StoreClosedPage />} />
          <Route path="/store-not-found" element={<StoreNotFoundPage />} />
          <Route path="/store-inactive"  element={<StoreClosedPage />} />

          {/* Store Routes — must be LAST */}
          <Route path="/:slug"                        element={<StorePage />} />
          <Route path="/:slug/product/:productId"     element={<ProductDetailPage />} />
          <Route path="/:slug/checkout"               element={<CheckoutPage />} />

          {/* Catch all */}
          <Route path="*" element={<StoreNotFoundPage />} />
        </Routes>
      </CustomDomainRouter>
    </>
  );
}

export default App;
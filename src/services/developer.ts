// src/services/developer.ts
// All API calls for the QAFRICA Developer Portal.
// Talks to the Supabase Edge Functions deployed in the api-* namespace.
// Uses two auth modes:
//   - JWT (session token) for dashboard-only actions (key management, profile, etc.)
//   - API Key (Bearer qaf_dev_*) for external integration actions

import { createClient } from '@supabase/supabase-js';
import CONFIG from '@/lib/config';
import type {
  Developer,
  DeveloperApiKey,
  DeveloperApiKeyCreated,
  DeveloperSubscription,
  DeveloperWalletTransaction,
  DeveloperWalletSummary,
  DeveloperWithdrawalRequest,
  WithdrawalFormData,
  DeveloperWebhookConfig,
  DeveloperWebhookDelivery,
  DeveloperImport,
  CatalogProduct,
  DeveloperOrder,
  DeveloperApiLog,
  DeveloperDashboardStats,
  DeveloperSignupFormData,
  RegisterWebhookFormData,
  InboundProductFormData,
  WebhookEvent,
  PaginatedResponse,
  DeveloperEnvironment,
  DeliveryCalculationResult,
} from '@/types/developer';

// ── Supabase anon client (for auth session management) ────────
export const developerSupabase = createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'qafrica-developer-auth', // separate key from store owner session
    },
  },
);

// ── Base URL for API edge functions ───────────────────────────
const BASE_URL = `${CONFIG.SUPABASE_URL}/functions/v1`;

// ── Generic fetch wrapper ─────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit & { jwt?: string } = {},
): Promise<T> {
  const { jwt, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> ?? {}),
  };

  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  const json = await res.json();

  if (!res.ok) {
    // Throw a structured error so stores can handle it cleanly
    throw {
      status: res.status,
      code: json?.error?.code ?? 'unknown_error',
      message: json?.error?.message ?? 'An unexpected error occurred.',
      details: json?.error?.details,
    };
  }

  return json as T;
}

// Helper to get the current JWT from the developer session
async function getJwt(): Promise<string> {
  const { data: { session } } = await developerSupabase.auth.getSession();
  if (!session?.access_token) {
    throw { status: 401, code: 'no_session', message: 'Not logged in.' };
  }
  return session.access_token;
}

// ============================================================
// AUTH SERVICE
// ============================================================

export const developerAuthService = {
  async signup(formData: DeveloperSignupFormData): Promise<{ developer_id: string; email: string; trial: { plan: string; expires_at: string; days: number } }> {
    return apiFetch('/api-developer-signup', {
      method: 'POST',
      body: JSON.stringify({
        account_type:  formData.account_type,
        full_name:     formData.full_name,
        email:         formData.email,
        password:      formData.password,
        phone:         formData.phone,
        platform_name: formData.platform_name,
        platform_url:  formData.platform_url,
        platform_type: formData.platform_type,
        company_name:  formData.company_name,
        rc_number:     formData.rc_number,
      }),
    });
  },

  async login(email: string, password: string): Promise<{
    session: { access_token: string; refresh_token: string; expires_at: number };
    developer: Developer;
  }> {
    return apiFetch('/api-developer-auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async verifyEmail(email: string, otp: string): Promise<{ message: string }> {
    return apiFetch('/api-developer-auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  async resendOtp(email: string): Promise<{ message: string }> {
    return apiFetch('/api-developer-auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return apiFetch('/api-developer-auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(accessToken: string, newPassword: string): Promise<{ message: string }> {
    return apiFetch('/api-developer-auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ access_token: accessToken, new_password: newPassword }),
    });
  },

  async logout(): Promise<void> {
    await developerSupabase.auth.signOut();
  },

  async getSession() {
    return developerSupabase.auth.getSession();
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return developerSupabase.auth.onAuthStateChange(callback);
  },
};

// ============================================================
// PROFILE SERVICE (JWT auth)
// ============================================================

export const developerProfileService = {
  async getProfile(): Promise<Developer & {
    current_subscription?: DeveloperSubscription;
  }> {
    const jwt = await getJwt();
    return apiFetch('/api-developer-me/me', { jwt });
  },

  async updateProfile(updates: {
    full_name?: string;
    phone?: string;
    company_name?: string;
    rc_number?: string;
    platform_name?: string;
    platform_url?: string;
    platform_type?: string;
  }): Promise<Partial<Developer>> {
    const jwt = await getJwt();
    return apiFetch('/api-developer-me/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
      jwt,
    });
  },

  async completeOnboarding(): Promise<{ message: string }> {
    const jwt = await getJwt();
    return apiFetch('/api-developer-me/onboarding', {
      method: 'POST',
      body: JSON.stringify({}),
      jwt,
    });
  },
};

// ============================================================
// API KEY SERVICE (JWT auth)
// ============================================================

export const developerKeyService = {
  async listKeys(): Promise<{ data: Omit<DeveloperApiKey, 'key_hash'>[] }> {
    const jwt = await getJwt();
    return apiFetch('/api-developer-keys', { jwt });
  },

  async createKey(name: string, environment: DeveloperEnvironment): Promise<DeveloperApiKeyCreated> {
    const jwt = await getJwt();
    return apiFetch('/api-developer-keys', {
      method: 'POST',
      body: JSON.stringify({ name, environment }),
      jwt,
    });
  },

  async revokeKey(keyId: string): Promise<{ message: string }> {
    const jwt = await getJwt();
    return apiFetch(`/api-developer-keys/${keyId}`, {
      method: 'DELETE',
      jwt,
    });
  },
};

// ============================================================
// SUBSCRIPTION SERVICE (JWT auth)
// ============================================================

export const developerSubscriptionService = {
  async getSubscription(): Promise<{
    current_plan: string;
    plan_expires_at?: string;
    plan_is_active: boolean;
    history: DeveloperSubscription[];
  }> {
    const jwt = await getJwt();
    return apiFetch('/api-developer-me/subscription', { jwt });
  },
};

// ============================================================
// WALLET SERVICE (JWT auth)
// ============================================================

export const developerWalletService = {
  async getWallet(page = 1, limit = 20): Promise<{
    wallet: DeveloperWalletSummary;
    transactions: PaginatedResponse<DeveloperWalletTransaction>;
  }> {
    const jwt = await getJwt();
    return apiFetch(`/api-developer-me/wallet?page=${page}&limit=${limit}`, { jwt });
  },

  async requestWithdrawal(data: WithdrawalFormData): Promise<{
    message: string;
    request: DeveloperWithdrawalRequest;
  }> {
    const jwt = await getJwt();
    return apiFetch('/api-developer-me/withdraw', {
      method: 'POST',
      body: JSON.stringify(data),
      jwt,
    });
  },
};

// ============================================================
// PAYSTACK CONNECT SERVICE (JWT auth)
// ============================================================

export const developerPaystackService = {
  async getConnectUrl(): Promise<{ connect_url: string }> {
    const jwt = await getJwt();
    return apiFetch('/api-paystack-connect/connect-url', { jwt });
  },

  async handleCallback(code: string): Promise<{
    message: string;
    subaccount_code: string;
    split_code: string;
    account_name: string;
    bank_name: string;
    split_breakdown: {
      developer_share: string;
      qafrica_fee: string;
      note: string;
    };
  }> {
    const jwt = await getJwt();
    return apiFetch('/api-paystack-connect/callback', {
      method: 'POST',
      body: JSON.stringify({ code }),
      jwt,
    });
  },

  async getStatus(): Promise<{
    connected: boolean;
    connected_at?: string;
    subaccount_code?: string;
    split_code?: string;
  }> {
    const jwt = await getJwt();
    return apiFetch('/api-paystack-connect/status', { jwt });
  },

  async disconnect(): Promise<{ message: string }> {
    const jwt = await getJwt();
    return apiFetch('/api-paystack-connect/disconnect', {
      method: 'POST',
      body: JSON.stringify({}),
      jwt,
    });
  },
};

// ============================================================
// PRODUCTS SERVICE (API Key auth — called from developer's integration)
// Also used by the dashboard for catalog browsing (JWT fallback)
// ============================================================

export const developerProductService = {
  // ── Browse catalog ──────────────────────────────────────────
  async getCatalog(params: {
    page?: number;
    limit?: number;
    niche?: string;
    category?: string;
    subcategory?: string;
    search?: string;
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
  } = {}): Promise<PaginatedResponse<CatalogProduct>> {
    const jwt = await getJwt();
    const qs = new URLSearchParams();
    if (params.page)       qs.set('page',        String(params.page));
    if (params.limit)      qs.set('limit',       String(params.limit));
    if (params.niche)      qs.set('niche',        params.niche);
    if (params.category)   qs.set('category',     params.category);
    if (params.subcategory) qs.set('subcategory', params.subcategory);
    if (params.search)     qs.set('search',       params.search);
    if (params.min_price)  qs.set('min_price',    String(params.min_price));
    if (params.max_price)  qs.set('max_price',    String(params.max_price));
    if (params.in_stock !== undefined) qs.set('in_stock', String(params.in_stock));

    const query = qs.toString() ? `?${qs}` : '';
    return apiFetch(`/api-products${query}`, { jwt });
  },

  async getProduct(productId: string): Promise<{ data: CatalogProduct }> {
    const jwt = await getJwt();
    return apiFetch(`/api-products/${productId}`, { jwt });
  },

  async getNiches(): Promise<{ data: { id: string; importable_product_count: number }[] }> {
    const jwt = await getJwt();
    return apiFetch('/api-products/niches', { jwt });
  },

  // ── Inbound push (developer's own products) ─────────────────
  async createProduct(data: InboundProductFormData): Promise<{ data: CatalogProduct }> {
    const jwt = await getJwt();
    return apiFetch('/api-products', {
      method: 'POST',
      body: JSON.stringify(data),
      jwt,
    });
  },

  async updateProduct(productId: string, updates: Partial<InboundProductFormData>): Promise<{ data: CatalogProduct }> {
    const jwt = await getJwt();
    return apiFetch(`/api-products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
      jwt,
    });
  },

  async updateStock(productId: string, stock_quantity: number): Promise<{ message: string; product_id: string; stock_quantity: number }> {
    const jwt = await getJwt();
    return apiFetch(`/api-products/${productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify({ stock_quantity }),
      jwt,
    });
  },

  async deactivateProduct(productId: string): Promise<{ message: string }> {
    const jwt = await getJwt();
    return apiFetch(`/api-products/${productId}`, {
      method: 'DELETE',
      jwt,
    });
  },
};

// ============================================================
// IMPORTS SERVICE (JWT auth — dashboard)
// ============================================================

export const developerImportService = {
  async listImports(page = 1, limit = 20): Promise<PaginatedResponse<DeveloperImport>> {
    const jwt = await getJwt();
    return apiFetch(`/api-imports?page=${page}&limit=${limit}`, { jwt });
  },

  async getImport(importId: string): Promise<{ data: DeveloperImport }> {
    const jwt = await getJwt();
    return apiFetch(`/api-imports/${importId}`, { jwt });
  },

  async importProduct(productId: string, customSellingPrice?: number): Promise<{ data: DeveloperImport }> {
    const jwt = await getJwt();
    return apiFetch('/api-imports', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        ...(customSellingPrice !== undefined && { custom_selling_price: customSellingPrice }),
      }),
      jwt,
    });
  },

  async updateImport(importId: string, updates: { custom_selling_price?: number; is_active?: boolean }): Promise<{ data: DeveloperImport }> {
    const jwt = await getJwt();
    return apiFetch(`/api-imports/${importId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      jwt,
    });
  },

  async removeImport(importId: string): Promise<{ message: string }> {
    const jwt = await getJwt();
    return apiFetch(`/api-imports/${importId}`, {
      method: 'DELETE',
      jwt,
    });
  },
};

// ============================================================
// ORDERS SERVICE (JWT auth — dashboard)
// ============================================================

export const developerOrderService = {
  async listOrders(params: {
    page?: number;
    limit?: number;
    status?: string;
    date_from?: string;
    date_to?: string;
  } = {}): Promise<PaginatedResponse<DeveloperOrder>> {
    const jwt = await getJwt();
    const qs = new URLSearchParams();
    if (params.page)      qs.set('page',      String(params.page));
    if (params.limit)     qs.set('limit',     String(params.limit));
    if (params.status)    qs.set('status',    params.status);
    if (params.date_from) qs.set('date_from', params.date_from);
    if (params.date_to)   qs.set('date_to',   params.date_to);
    const query = qs.toString() ? `?${qs}` : '';
    return apiFetch(`/api-orders${query}`, { jwt });
  },

  async getOrder(orderId: string): Promise<{ data: DeveloperOrder }> {
    const jwt = await getJwt();
    return apiFetch(`/api-orders/${orderId}`, { jwt });
  },

  async cancelOrder(orderId: string, reason?: string): Promise<{ message: string }> {
    const jwt = await getJwt();
    return apiFetch(`/api-orders/${orderId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
      jwt,
    });
  },
};

// ============================================================
// DELIVERY SERVICE (JWT auth — dashboard)
// ============================================================

export const developerDeliveryService = {
  async getZones(storeId: string): Promise<{
    store: { id: string; name: string; slug: string; delivery_mode: string };
    zones: { state: string; price: number; price_with_platform_fee: number; is_active: boolean }[];
  }> {
    const jwt = await getJwt();
    return apiFetch(`/api-delivery/zones/${storeId}`, { jwt });
  },

  async calculateFees(state: string, items: { import_catalog_id: string; quantity: number }[]): Promise<DeliveryCalculationResult> {
    const jwt = await getJwt();
    return apiFetch('/api-delivery/calculate', {
      method: 'POST',
      body: JSON.stringify({ state, items }),
      jwt,
    });
  },
};

// ============================================================
// WEBHOOK SERVICE (JWT auth — dashboard)
// ============================================================

export const developerWebhookService = {
  async listWebhooks(): Promise<{
    data: DeveloperWebhookConfig[];
    supported_events: WebhookEvent[];
  }> {
    const jwt = await getJwt();
    return apiFetch('/api-webhooks', { jwt });
  },

  async registerWebhook(data: RegisterWebhookFormData): Promise<DeveloperWebhookConfig & { signing_secret: string; warning: string }> {
    const jwt = await getJwt();
    return apiFetch('/api-webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
      jwt,
    });
  },

  async deleteWebhook(webhookId: string): Promise<{ message: string }> {
    const jwt = await getJwt();
    return apiFetch(`/api-webhooks/${webhookId}`, {
      method: 'DELETE',
      jwt,
    });
  },

  async testWebhook(webhookId: string): Promise<{
    delivered: boolean;
    url: string;
    response_status: number;
    response_body: string;
    message: string;
  }> {
    const jwt = await getJwt();
    return apiFetch(`/api-webhooks/${webhookId}/test`, {
      method: 'POST',
      body: JSON.stringify({}),
      jwt,
    });
  },

  async getDeliveries(page = 1, limit = 20): Promise<PaginatedResponse<DeveloperWebhookDelivery>> {
    const jwt = await getJwt();
    return apiFetch(`/api-webhooks/deliveries?page=${page}&limit=${limit}`, { jwt });
  },
};

// ============================================================
// DASHBOARD STATS (assembled from profile + wallet + logs)
// ============================================================

export const developerStatsService = {
  async getDashboardStats(): Promise<DeveloperDashboardStats> {
    const jwt = await getJwt();

    // Parallel fetch profile + wallet
    const [profileData, walletData] = await Promise.all([
      developerProfileService.getProfile(),
      developerWalletService.getWallet(1, 1),
    ]);

    const now = new Date();
    const planExpiry = profileData.plan_expires_at
      ? new Date(profileData.plan_expires_at)
      : null;
    const daysUntilExpiry = planExpiry
      ? Math.ceil((planExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    // API calls today — count from logs
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: logsToday } = await developerSupabase
      .from('developer_api_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    // Imports count
    const { data: importsData } = await developerSupabase
      .from('import_catalog')
      .select('*', { count: 'exact', head: true })
      .eq('importer_store_id', profileData.shadow_store_id ?? '')
      .eq('is_active', true);

    // Pending webhooks
    const { data: pendingWebhooks } = await developerSupabase
      .from('developer_webhook_deliveries')
      .select('*', { count: 'exact', head: true })
      .eq('developer_id', profileData.id)
      .eq('status', 'pending');

    return {
      api_calls_today:       (logsToday as any)?.count ?? 0,
      api_calls_this_month:  0,  // extend if needed
      orders_this_month:     0,  // extend if needed
      revenue_this_month:    0,  // extend if needed
      active_imports:        (importsData as any)?.count ?? 0,
      pending_webhooks:      (pendingWebhooks as any)?.count ?? 0,
      wallet_balance:        walletData.wallet.balance,
      plan:                  profileData.plan,
      plan_expires_at:       profileData.plan_expires_at,
      plan_is_trial:         profileData.current_subscription?.is_trial ?? false,
      days_until_expiry:     daysUntilExpiry,
      paystack_connected:    profileData.paystack_connected,
    };
  },
};
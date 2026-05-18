// src/types/developer.ts
// All TypeScript types for the QAFRICA Developer Portal.
// Mirrors the database schema defined in sql/02_new_tables.sql exactly.

// ============================================================
// ACCOUNT TYPES
// ============================================================

export type DeveloperAccountType = 'individual' | 'company';

export type DeveloperPlan = 'free' | 'starter' | 'growth' | 'scale' | 'enterprise';

export type DeveloperEnvironment = 'production' | 'test';

// ============================================================
// CORE DEVELOPER IDENTITY
// ============================================================

export interface Developer {
  id: string;
  auth_user_id: string;
  account_type: DeveloperAccountType;

  // Identity
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;

  // Company-only (null for individual)
  company_name?: string;
  rc_number?: string;
  company_verified: boolean;

  // Platform info
  platform_name: string;
  platform_url: string;
  platform_type?: string;

  // System links
  shadow_store_id?: string;

  // Paystack Connect
  paystack_subaccount_code?: string;
  paystack_subaccount_id?: string;
  paystack_split_code?: string;
  paystack_connected: boolean;
  paystack_connected_at?: string;

  // Subscription
  plan: DeveloperPlan;
  plan_expires_at?: string;
  plan_is_active: boolean;

  // Wallet (tracking only — real money via Paystack Split)
  wallet_balance: number;
  total_earned: number;
  total_withdrawn: number;

  // Status
  is_active: boolean;
  is_blocked: boolean;
  block_reason?: string;
  email_verified: boolean;
  onboarding_completed: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================================
// API KEYS
// ============================================================

export interface DeveloperApiKey {
  id: string;
  developer_id: string;
  name: string;
  key_hash: string;        // never returned to frontend
  key_prefix: string;      // first 16 chars — safe to display
  environment: DeveloperEnvironment;
  plan_at_creation: DeveloperPlan;
  permissions: string[];
  is_active: boolean;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
}

// Returned ONLY at creation — key field is never shown again
export interface DeveloperApiKeyCreated extends Omit<DeveloperApiKey, 'key_hash'> {
  key: string;  // the full raw key — show once, then discard
  warning: string;
}

// ============================================================
// SUBSCRIPTIONS
// ============================================================

export interface DeveloperSubscription {
  id: string;
  developer_id: string;
  plan: DeveloperPlan;
  account_type: DeveloperAccountType;
  amount_paid: number;
  currency: string;
  duration_months: number;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  is_trial: boolean;
  payment_reference?: string;
  paystack_sub_code?: string;
  auto_renew: boolean;
  cancelled_at?: string;
  created_at: string;
}

// ============================================================
// WALLET
// ============================================================

export type DeveloperTransactionType =
  | 'commission'
  | 'refund'
  | 'adjustment'
  | 'withdrawal'
  | 'plan_payment';

export type DeveloperTransactionStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'reversed';

export interface DeveloperWalletTransaction {
  id: string;
  developer_id: string;
  type: DeveloperTransactionType;
  amount: number;
  balance_after: number;
  description: string;
  reference?: string;
  order_id?: string;
  status: DeveloperTransactionStatus;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DeveloperWalletSummary {
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  pending_withdrawal: number;
}

// ============================================================
// WITHDRAWALS
// ============================================================

export type DeveloperWithdrawalStatus = 'pending' | 'approved' | 'rejected' | 'paid';

export interface DeveloperWithdrawalRequest {
  id: string;
  developer_id: string;
  amount: number;
  status: DeveloperWithdrawalStatus;
  bank_name: string;
  account_number: string;
  account_name: string;
  admin_note?: string;
  paid_at?: string;
  paid_by?: string;
  created_at: string;
}

export interface WithdrawalFormData {
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
}

// ============================================================
// WEBHOOKS
// ============================================================

export type WebhookEvent =
  | 'order.created'
  | 'order.confirmed'
  | 'order.processing'
  | 'order.shipped'
  | 'order.out_for_delivery'
  | 'order.delivered'
  | 'order.cancelled'
  | 'order.refunded'
  | 'product.stock_updated'
  | 'product.price_updated'
  | 'product.deactivated'
  | 'developer.plan_expiring'
  | '*';

export interface DeveloperWebhookConfig {
  id: string;
  developer_id: string;
  url: string;
  signing_secret?: string;  // returned ONLY at creation
  events: WebhookEvent[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stats?: {
    total: number;
    failed: number;
  };
}

export interface DeveloperWebhookDelivery {
  id: string;
  developer_id: string;
  event_type: WebhookEvent;
  payload: Record<string, unknown>;
  target_url: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  last_attempt_at?: string;
  next_retry_at?: string;
  response_code?: number;
  response_body?: string;
  created_at: string;
}

// ============================================================
// API LOGS
// ============================================================

export interface DeveloperApiLog {
  id: string;
  developer_id: string;
  key_id?: string;
  endpoint: string;
  method: string;
  status_code?: number;
  response_ms?: number;
  ip_address?: string;
  error_message?: string;
  created_at: string;
}

// ============================================================
// CATALOG / IMPORTS (Developer-facing view of import_catalog)
// ============================================================

export interface DeveloperImport {
  id: string;
  name: string;
  description?: string;
  images: string[];
  category?: string;
  niche: string;
  selling_price: number;
  dropship_price: number;
  custom_selling_price?: number;
  effective_price: number;  // custom_selling_price ?? selling_price
  is_active: boolean;
  total_sales: number;
  stock_quantity: number;
  has_variants: boolean;
  variants?: ProductVariantSummary[];
  weight_kg?: number;
  product_type: 'parcel' | 'document';
  created_at: string;
  last_synced_at?: string;
  sync_status: 'synced' | 'out_of_sync' | 'removed';
  original_product?: {
    id: string;
    stock_quantity: number;
    is_out_of_stock: boolean;
    selling_price: number;
    dropship_price: number;
    is_active: boolean;
  };
  original_store?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface ProductVariantSummary {
  id: string;
  options: Record<string, string>;
  price: number;
  stock: number;
  sku?: string;
}

// ============================================================
// CATALOG PRODUCTS (browsable from GET /products)
// ============================================================

export interface CatalogProduct {
  id: string;
  name: string;
  images: string[];
  category?: string;
  subcategory?: string;
  niche: string;
  selling_price: number;
  dropship_price: number;
  stock_quantity: number;
  is_out_of_stock: boolean;
  has_variants: boolean;
  variants?: ProductVariantSummary[];
  weight_kg?: number;
  product_type: 'parcel' | 'document';
  import_count: number;
  created_at: string;
  store: {
    id: string;
    name: string;
    slug: string;
  };
}

// ============================================================
// DEVELOPER ORDERS
// ============================================================

export type DeveloperOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export interface DeveloperOrder {
  id: string;
  order_number: string;
  status: DeveloperOrderStatus;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total: number;
  delivery_state: string;
  customer_name: string;
  customer_email: string;
  tracking_number?: string;
  terminal_tracking_url?: string;
  created_at: string;
  updated_at: string;
  // Full detail only (GET /orders/:id)
  items?: DeveloperOrderItem[];
  delivery_address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    postal_code?: string;
  };
}

export interface DeveloperOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  variant_options?: Record<string, string>;
  is_imported: boolean;
  dropship_price?: number;
}

// ============================================================
// DELIVERY
// ============================================================

export interface DeliveryZone {
  state: string;
  price: number;
  price_with_platform_fee: number;
  is_active: boolean;
}

export interface DeliveryCalculationItem {
  import_catalog_id: string;
  quantity: number;
}

export interface DeliveryCalculationResult {
  state: string;
  can_deliver_all: boolean;
  breakdown: {
    store_id: string;
    store_name: string;
    items: { name: string; quantity: number; unit_price: number }[];
    subtotal: number;
    delivery_fee: number | null;
    can_deliver: boolean;
  }[];
  summary: {
    subtotal: number;
    delivery_fee: number;
    platform_fee: number;
    total: number | null;
  };
}

// ============================================================
// PLAN CONFIG (mirrors pricing in the planning doc)
// ============================================================

export interface DeveloperPlanConfig {
  id: DeveloperPlan;
  name: string;
  description: string;
  individual_monthly: number;
  company_monthly: number;
  individual_annual: number;
  company_annual: number;
  rate_limit_per_minute: number;
  rate_limit_per_hour: number;
  max_api_keys: number;
  permissions: string[];
  features: string[];
  not_included: string[];
  popular?: boolean;
}

// ============================================================
// FORMS
// ============================================================

export interface DeveloperSignupFormData {
  account_type: DeveloperAccountType;
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  phone?: string;
  platform_name: string;
  platform_url: string;
  platform_type?: string;
  // Company only
  company_name?: string;
  rc_number?: string;
}

export interface DeveloperLoginFormData {
  email: string;
  password: string;
}

export interface CreateApiKeyFormData {
  name: string;
  environment: DeveloperEnvironment;
}

export interface RegisterWebhookFormData {
  url: string;
  events: WebhookEvent[];
}

export interface InboundProductFormData {
  name: string;
  description?: string;
  niche: string;
  category: string;
  subcategory?: string;
  selling_price: number;
  dropship_price: number;
  stock_quantity: number;
  images: string[];  // HTTPS URLs only — developer hosts their own images
  weight_kg?: number;
  hs_code?: string;
  product_type: 'parcel' | 'document';
  is_importable: boolean;
  has_variants: boolean;
  variants?: ProductVariantSummary[];
  tags?: string[];
}

// ============================================================
// API RESPONSE WRAPPERS
// ============================================================

export interface DeveloperApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export interface DeveloperDashboardStats {
  api_calls_today: number;
  api_calls_this_month: number;
  orders_this_month: number;
  revenue_this_month: number;
  active_imports: number;
  pending_webhooks: number;
  wallet_balance: number;
  plan: DeveloperPlan;
  plan_expires_at?: string;
  plan_is_trial: boolean;
  days_until_expiry?: number;
  paystack_connected: boolean;
}

// ============================================================
// USAGE CHART DATA
// ============================================================

export interface ApiUsageDataPoint {
  date: string;       // 'YYYY-MM-DD'
  requests: number;
  errors: number;
  avg_response_ms: number;
}
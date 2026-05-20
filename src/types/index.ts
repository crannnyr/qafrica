// QAFRICA TypeScript Types

// ============================================
// TERMINAL AFRICA TYPES
// ============================================

export interface TerminalPickupAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip?: string;
}

export interface TerminalRate {
  id: string;              // rate_id — passed to arrange-shipment
  carrier: { 
    name: string; 
    logo?: string 
  };
  amount: number;          // in NGN
  estimated_days: number;
  currency: string;
  available: boolean;
}

// ============================================
// USER / AUTH TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_url?: string;
  // Aligned to actual DB values — 'user' no longer exists in profiles
  role: 'store_owner' | 'customer' | 'admin' | 'staff';
  // FIX: added user_type used in SignupPage
  user_type?: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in?: string;
  // FIX: added onboarding fields used in PaymentCallbackPage & PricingPage
  onboarding_step?: number;
  onboarding_completed?: boolean;
}

export interface SavedCard {
  id: string;
  user_id: string;
  paystack_authorization_code: string;
  last4: string;
  brand: string;
  exp_month: string;
  exp_year: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Extends User — maps to the profiles table (store owners and staff)
export interface StoreOwner extends User {
  role: 'store_owner' | 'admin' | 'staff';
  store_id?: string;
  subscription_tier: 'free' | 'one_niche' | 'three_niches' | 'unlimited' | null;
  subscription_expires_at?: string;
  selected_niches: string[];
  wallet_balance: number;
  total_earnings: number;
  is_store_active: boolean;
  is_store_blocked: boolean;
  block_reason?: string;
  onboarding_step?: number;
  onboarding_completed?: boolean;
}

// ============================================
// STORE TYPES
// ============================================

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  logo_url?: string;
  banner_url?: string;
  primary_color: string;
  secondary_color: string;
  niches: string[];
  theme: string;
  is_active: boolean;
  is_verified: boolean;
  is_blocked?: boolean;
  block_reason?: string;
  custom_domain?: string;
  domain_status?: 'none' | 'pending' | 'processing' | 'connected' | 'failed';
  domain_paid_amount?: number;
  created_at: string;
  updated_at: string;
  social_links: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
    whatsapp?: string;
    youtube?: string;
  };
  group_chat_url?: string;
  analytics: StoreAnalytics;
  // FIX: expanded delivery_mode to include 'shipbubble'
  delivery_mode?: 'manual' | 'terminal' | 'shipbubble';
  // Terminal Africa fields
  terminal_pickup_address?: TerminalPickupAddress | null;
  terminal_packaging_id?: string | null;
  packaging_length_cm?: number;
  packaging_width_cm?: number;
  packaging_height_cm?: number;
  packaging_weight_kg?: number;
  delivery_window_days?: number;
  // FIX: added Shipbubble-specific fields used in DeliveryZonesPage
  shipbubble_pickup_address?: Record<string, string> | null;
  shipbubble_sender_address_code?: number | null;
  shipbubble_category_id?: number;
  // Payment fields
  payment_method?: 'paystack' | 'direct_transfer';
  direct_bank_name?: string;
  direct_account_number?: string;
  direct_account_name?: string;
  cod_enabled?: boolean;
}

export interface StoreAnalytics {
  total_visits: number;
  total_orders: number;
  total_revenue: number;
  conversion_rate: number;
  best_selling_products: string[];
  traffic_sources: {
    direct: number;
    social: number;
    search: number;
    ads: number;
  };
  monthly_growth: number;
}

// ============================================
// PRODUCT TYPES
// ============================================

export interface Product {
  id: string;
  store_id: string;
  owner_id: string;
  name: string;
  description: string;
  images: string[];
  category: string;
  niche: string;
  subcategory?: string;
  cost_price: number;
  selling_price: number;
  dropship_price: number;
  wholesale_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  sku?: string;
  barcode?: string;
  is_out_of_stock: boolean;
  has_variants: boolean;
  variants?: ProductVariant[];
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  is_active: boolean;
  is_importable: boolean;
  import_count: number;
  seo_title?: string;
  seo_description?: string;
  tags: string[];
  views: number;
  sales_count: number;
  created_at: string;
  updated_at: string;
  // Terminal Africa fields
  weight_kg?: number | null;
  hs_code?: string | null;
  product_type?: 'parcel' | 'document';
}

export interface ProductVariant {
  id: string;
  options: Record<string, string>; // e.g., { Color: "Red", Size: "Large" }
  price: number;
  stock: number;
  sku?: string;
}

// ============================================
// IMPORT CATALOG TYPES
// ============================================

export interface ImportCatalogItem {
  id: string;
  original_product_id: string;
  original_store_id: string;
  original_owner_id: string;
  importer_store_id: string;
  importer_owner_id: string;
  name: string;
  description: string;
  images: string[];
  category: string;
  niche: string;
  selling_price: number;
  dropship_price: number;
  custom_selling_price?: number;
  is_active: boolean;
  total_sales: number;
  created_at: string;
  // Terminal Africa fields (mirrored from products)
  weight_kg?: number | null;
  hs_code?: string | null;
  product_type?: 'parcel' | 'document';
  has_variants?: boolean;
  variants?: ProductVariant[];
  stock_quantity?: number;
}

// ============================================
// ORDER TYPES
// ============================================

export interface Order {
  id: string;
  order_number: string;
  store_id: string;
  customer_id?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total: number;
  delivery_address: DeliveryAddress;
  delivery_state: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method: 'paystack' | 'wallet';
  payment_reference?: string;
  paid_at?: string;
  status: OrderStatus;
  escrow_release_at?: string;
  is_escrow_released: boolean;
  delivery_confirmed_at?: string;
  escrow_auto_release_at?: string;
  buyer_reported_issue: boolean;
  issue_reported_at?: string;
  issue_description?: string;
  tracking_number?: string;
  created_at: string;
  updated_at: string;
  delivered_at?: string;
  // Terminal Africa fields
  terminal_shipment_id?: string | null;
  terminal_rate_id?: string | null;
  terminal_carrier_name?: string | null;
  terminal_tracking_number?: string | null;
  terminal_tracking_url?: string | null;
  terminal_waybill_url?: string | null;
  terminal_shipment_status?: string | null;
  terminal_arranged_at?: string | null;
  terminal_delivery_cost?: number | null;
  // Dispute fields
  dispute_status?: 'open' | 'under_review' | 'resolved_refund' | 'resolved_release' | 'closed' | null;
  dispute_resolved_at?: string | null;
  dispute_resolved_by?: string | null;
  refund_amount?: number;
  refund_processed_at?: string | null;
}

export interface OrderReport {
  id: string;
  order_id: string;
  customer_id: string;
  store_id: string;
  report_type: 'not_delivered' | 'wrong_item' | 'damaged' | 'other';
  description: string;
  status: 'pending' | 'resolved' | 'refunded' | 'escrow_released';
  admin_notes?: string;
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

export type OrderStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'  
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded'
  | 'shipment_cancelled';

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  is_imported: boolean;
  original_product_id?: string;
  original_store_id?: string | null;
  dropship_price?: number;
  variant_options?: Record<string, string>;
  original_owner_id?: string | null;
  price_at_time?: number;
}

export interface DeliveryAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postal_code?: string;
  // FIX: added address field used in DropshipOrderDetailPage
  address?: string;
}

// FIX: Added DropshipOrderView — used by original product owners to see orders
// where their products were sold by other (dropshipper) stores
export interface DropshipOrderView {
  order_id: string;
  order_number: string;
  dropshipper_store_id: string;
  dropshipper_store_name: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  delivery_address: DeliveryAddress;
  delivery_state: string;
  status: OrderStatus;
  payment_status: string;
  created_at: string;
  items: OrderItem[];
  total_dropship_price: number;
  total_quantity: number;
  tracking_number?: string;
  is_escrow_released: boolean;
  delivered_at?: string;

  shipbubble_order_id?: string | null;
  shipbubble_tracking_url?: string | null;
  shipbubble_courier_name?: string | null;
  shipbubble_courier_phone?: string | null;
  shipbubble_status?: string | null;
  is_cod_order?: boolean | null;
}

// FIX: Added StoreOrderEarnings — for showing per-store earnings in multi-store orders
export interface StoreOrderEarnings {
  store_id: string;
  store_name: string;
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  dropshipper_net: number;
  original_owner_earnings: number;
  total: number;
}

// ============================================
// WALLET TYPES
// ============================================

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  pending_balance: number;
  created_at: string;
  updated_at: string;
  // Escrow field
  escrow_balance?: number;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number;
  description: string;
  reference?: string;
  status: 'pending' | 'completed' | 'failed' | 'escrow' | 'reversed';
  metadata?: Record<string, any>;
  created_at: string;
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  wallet_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  bank_name: string;
  account_number: string;
  account_name: string;
  admin_note?: string;
  paid_at?: string;
  paid_by?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  store_id?: string;
  tier: 'free' | 'one_niche' | 'three_niches' | 'unlimited';
  niches: string[];
  duration_months: number;
  amount_paid: number;
  is_trial?: boolean;
  is_free_plan?: boolean;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
  auto_renew?: boolean;
  auto_renew_method?: 'wallet' | 'card';
  cancel_at_period_end?: boolean;
  paystack_authorization_code?: string;
  payment_reference: string;
  created_at: string;
  trial_reminder_sent?: boolean;
}

// ============================================
// DELIVERY TYPES
// ============================================

export interface DeliveryZone {
  id: string;
  store_id: string;
  state: string;
  price: number;
  is_active: boolean;
  created_at: string;
}

// ============================================
// AD CAMPAIGN TYPES
// ============================================

export interface AdCampaign {
  id: string;
  store_id: string;
  product_id?: string;
  platform: 'google' | 'facebook' | 'instagram' | 'tiktok';
  campaign_name: string;
  budget: number;
  spent: number;
  clicks: number;
  impressions: number;
  conversions: number;
  status: 'active' | 'paused' | 'ended';
  start_date: string;
  end_date?: string;
  external_campaign_id?: string;
  created_at: string;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export type NotificationType =
  | 'order_placed'
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_delivered'
  | 'payment_received'
  | 'wallet_credited'
  | 'withdrawal_approved'
  | 'product_imported'
  | 'subscription_expiring'
  | 'store_blocked'
  | 'escrow_released'
  | 'low_stock'
  | 'out_of_stock'
  | 'shipment_update'        
  | 'shipment_cancelled';    

// ============================================
// PRODUCT EARNINGS TYPES
// ============================================

export interface ProductEarning {
  id: string;
  product_id: string;
  store_id: string;
  owner_id: string;
  order_id?: string;
  quantity_sold: number;
  unit_cost: number;
  unit_price: number;
  total_revenue: number;
  total_cost: number;
  profit: number;
  platform_fee: number;
  net_profit: number;
  earned_at: string;
  created_at: string;
}

export interface ProductEarningsSummary {
  product_id: string;
  product_name: string;
  total_quantity_sold: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  total_net_profit: number;
}

// ============================================
// STOCK ALERT TYPES
// ============================================

export interface StockAlert {
  id: string;
  product_id: string;
  store_id: string;
  owner_id: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'restocked';
  previous_stock: number;
  current_stock: number;
  threshold: number;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  product?: Product;
}

// ============================================
// EMAIL TYPES
// ============================================

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  variables: string[];
}

// ============================================
// ADMIN TYPES
// ============================================

export interface AdminDashboardStats {
  total_users: number;
  total_stores: number;
  total_products: number;
  total_orders: number;
  total_revenue: number;
  pending_withdrawals: number;
  pending_verifications: number;
  blocked_stores: number;
}

export interface AdminAction {
  id: string;
  admin_id: string;
  action_type: string;
  target_type: 'user' | 'store' | 'product' | 'order';
  target_id: string;
  details: string;
  created_at: string;
}

// ============================================
// TAX TYPES
// ============================================

export interface TaxSettings {
  id: string;
  store_id: string;
  owner_id: string;
  tax_rate: number;
  tax_name: string;
  tax_id_number?: string;
  country: string;
  state?: string;
  is_tax_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessExpense {
  id: string;
  store_id: string;
  owner_id: string;
  expense_name: string;
  expense_category: string;
  amount: number;
  expense_date: string;
  description?: string;
  receipt_url?: string;
  is_recurring: boolean;
  recurring_frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  created_at: string;
  updated_at: string;
}

export interface TaxReport {
  id: string;
  store_id: string;
  owner_id: string;
  report_name: string;
  report_period_start: string;
  report_period_end: string;
  total_revenue: number;
  total_expenses: number;
  taxable_income: number;
  tax_rate: number;
  tax_amount: number;
  deductions: number;
  net_tax_payable: number;
  report_data: Record<string, any>;
  file_url?: string;
  file_format?: 'pdf' | 'csv' | 'excel';
  created_at: string;
}

export interface TaxCalculation {
  total_revenue: number;
  total_expenses: number;
  taxable_income: number;
  tax_rate: number;
  tax_amount: number;
  net_after_tax: number;
}

export interface ExpenseCategorySummary {
  category: string;
  total_amount: number;
  expense_count: number;
}

export const EXPENSE_CATEGORIES = [
  'Advertising & Marketing',
  'Office Supplies',
  'Rent',
  'Utilities',
  'Transportation',
  'Professional Services',
  'Equipment',
  'Software & Subscriptions',
  'Shipping & Delivery',
  'Employee Salaries',
  'Insurance',
  'Maintenance & Repairs',
  'Travel',
  'Meals & Entertainment',
  'Other',
] as const;

// ============================================
// THEME TYPES
// ============================================

export interface Theme {
  id: string;
  name: string;
  description: string;
  preview_image: string;
  is_premium: boolean;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
}

// ============================================
// API / FORM TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SignupFormData {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  selected_niche: string;
}

export interface ProductFormData {
  name: string;
  description: string;
  category: string;
  cost_price: number;
  selling_price: number;
  dropship_price: number;
  wholesale_price: number;
  stock_quantity: number;
  images: File[];
  has_variants: boolean;
  variants?: ProductVariant[];
  is_importable: boolean;
  // Terminal Africa fields
  weight_kg?: number | null;
  hs_code?: string | null;
  product_type?: 'parcel' | 'document';
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
}

export interface StoreSetupFormData {
  name: string;
  description: string;
  slug: string;
  theme: string;
  primary_color: string;
  secondary_color: string;
}

// ============================================
// REVIEW TYPES
// ============================================

export interface Review {
  id: string;
  product_id: string;
  store_id: string;
  customer_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_avatar_url?: string;
  rating: number;
  title?: string;
  content: string;
  images?: string[];
  is_verified_purchase: boolean;
  is_approved: boolean;
  helpful_count: number;
  unhelpful_count: number;
  admin_response?: string;
  admin_responded_at?: string;
  created_at: string;
  updated_at: string;
  product?: {
    name: string;
    images: string[];
  };
}

export interface ReviewSummary {
  product_id: string;
  average_rating: number;
  total_reviews: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}

// ============================================
// COUPON TYPES
// ============================================

export interface Coupon {
  id: string;
  store_id: string;
  code: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  usage_limit?: number;
  usage_count: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  applies_to: 'all' | 'products' | 'categories';
  product_ids?: string[];
  category_ids?: string[];
  created_at: string;
  updated_at: string;
}

// ============================================
// CUSTOMER TYPES (For Shoppers)
// Maps to the customers table, NOT profiles
// ============================================

export interface Customer {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  // Matches customers table column name
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label?: string;
  // FIX: added name and phone fields used throughout checkout
  name?: string;
  phone?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  country: string;
  postal_code?: string;
  is_default: boolean;
  created_at: string;
  // FIX: added Shipbubble address validation fields
  shipbubble_address_code?: number | null;
  shipbubble_validated_at?: string | null;
}

// ============================================
// CART / WISHLIST / HISTORY TYPES
// ============================================

export interface CartItem {
  id: string;
  product_id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  variant_options?: Record<string, string>;
  added_at: string;
  // Terminal Africa fields for checkout
  weight_kg?: number | null;
  hs_code?: string | null;
  product_type?: 'parcel' | 'document';
}

export interface CustomerOrder {
  id: string;
  customer_id: string;
  order_group_id: string;
  store_id: string;
  store_name: string;
  order_number: string;
  items: CustomerOrderItem[];
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total: number;
  delivery_address: CustomerAddress;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method: 'paystack' | 'wallet';
  paid_at?: string;
  status: OrderStatus;
  tracking_number?: string;
  created_at: string;
  updated_at: string;
  delivered_at?: string;
  is_escrow_released?: boolean;
  has_reviewed?: boolean;
}

export interface CustomerOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  variant_options?: Record<string, string>;
}

export interface WishlistItem {
  id: string;
  customer_id: string;
  product_id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  product_name: string;
  product_image?: string;
  price: number;
  added_at: string;
}

export interface RecentlyViewed {
  id: string;
  customer_id: string;
  product_id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  product_name: string;
  product_image?: string;
  price: number;
  viewed_at: string;
}

export interface StoreStaff {
  id: string;
  store_id: string;
  owner_id: string;
  staff_user_id: string | null;
  email: string;
  full_name: string | null;
  status: 'pending' | 'active' | 'suspended' | 'removed';
  invited_at: string;
  accepted_at: string | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffInvitation {
  id: string;
  store_id: string;
  owner_id: string;
  staff_id: string;
  email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}
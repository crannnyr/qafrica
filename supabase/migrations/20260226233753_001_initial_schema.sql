-- QAFRICA Database Schema Migration
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  email_verified BOOLEAN DEFAULT FALSE,
  wallet_balance DECIMAL(12,2) DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0,
  is_store_active BOOLEAN DEFAULT FALSE,
  is_store_blocked BOOLEAN DEFAULT FALSE,
  block_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to check if user is admin (bypasses RLS using SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_uuid AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
  
  -- Also update the user's metadata to include role for JWT
  UPDATE auth.users 
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(user_role)
  )
  WHERE id = NEW.id;
  
  INSERT INTO public.profiles (id, full_name, email, phone, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT DEFAULT '#F97316',
  secondary_color TEXT DEFAULT '#FED7AA',
  niches TEXT[] DEFAULT '{}',
  theme TEXT DEFAULT 'modern',
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  block_reason TEXT,
  custom_domain TEXT,
  domain_status TEXT DEFAULT 'none' CHECK (domain_status IN ('none', 'pending', 'connected', 'failed')),
  domain_paid_amount DECIMAL(12,2) DEFAULT 0,
  social_links JSONB DEFAULT '{}',
  analytics JSONB DEFAULT '{
    "total_visits": 0,
    "total_orders": 0,
    "total_revenue": 0,
    "conversion_rate": 0,
    "best_selling_products": [],
    "traffic_sources": {
      "direct": 0,
      "social": 0,
      "search": 0,
      "ads": 0
    },
    "monthly_growth": 0
  }',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_owner ON stores(owner_id);

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  category TEXT,
  niche TEXT NOT NULL,
  cost_price DECIMAL(12,2) DEFAULT 0,
  selling_price DECIMAL(12,2) NOT NULL,
  dropship_price DECIMAL(12,2) DEFAULT 0,
  wholesale_price DECIMAL(12,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  sku TEXT,
  barcode TEXT,
  has_variants BOOLEAN DEFAULT FALSE,
  variants JSONB DEFAULT '[]',
  weight DECIMAL(8,2),
  dimensions JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  is_importable BOOLEAN DEFAULT TRUE,
  import_count INTEGER DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  tags TEXT[] DEFAULT '{}',
  views INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_niche ON products(niche);
CREATE INDEX IF NOT EXISTS idx_products_importable ON products(is_importable);

-- ============================================
-- IMPORT CATALOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS import_catalog (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  original_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  original_owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  importer_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  importer_owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  category TEXT,
  niche TEXT NOT NULL,
  selling_price DECIMAL(12,2) NOT NULL,
  dropship_price DECIMAL(12,2) DEFAULT 0,
  custom_selling_price DECIMAL(12,2),
  is_active BOOLEAN DEFAULT TRUE,
  total_sales INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imports_importer ON import_catalog(importer_store_id);
CREATE INDEX IF NOT EXISTS idx_imports_original ON import_catalog(original_product_id);

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES profiles(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(12,2) NOT NULL,
  delivery_fee DECIMAL(12,2) NOT NULL,
  platform_fee DECIMAL(12,2) DEFAULT 500,
  total DECIMAL(12,2) NOT NULL,
  delivery_address JSONB NOT NULL,
  delivery_state TEXT NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_method TEXT DEFAULT 'paystack' CHECK (payment_method IN ('paystack', 'wallet')),
  payment_reference TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned')),
  escrow_release_at TIMESTAMP WITH TIME ZONE,
  is_escrow_released BOOLEAN DEFAULT FALSE,
  tracking_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- ============================================
-- WALLETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  balance DECIMAL(12,2) DEFAULT 0,
  total_earned DECIMAL(12,2) DEFAULT 0,
  total_withdrawn DECIMAL(12,2) DEFAULT 0,
  pending_balance DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);

-- ============================================
-- WALLET TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions(wallet_id);

-- ============================================
-- WITHDRAWAL REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  admin_note TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  paid_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawal_requests(status);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id UUID REFERENCES stores(id),
  tier TEXT NOT NULL CHECK (tier IN ('single', 'three', 'unlimited')),
  niches TEXT[] DEFAULT '{}',
  duration_months INTEGER NOT NULL,
  amount_paid DECIMAL(12,2) NOT NULL,
  is_trial BOOLEAN DEFAULT FALSE,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  auto_renew BOOLEAN DEFAULT FALSE,
  payment_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active);

-- ============================================
-- DELIVERY ZONES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(store_id, state)
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_store ON delivery_zones(store_id);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- ============================================
-- AD CAMPAIGNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  platform TEXT NOT NULL CHECK (platform IN ('google', 'facebook', 'instagram', 'tiktok')),
  campaign_name TEXT NOT NULL,
  budget DECIMAL(12,2) NOT NULL,
  spent DECIMAL(12,2) DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE,
  external_campaign_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_store ON ad_campaigns(store_id);

-- ============================================
-- ADMIN ACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES profiles(id),
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'store', 'product', 'order')),
  target_id UUID NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id);

-- ============================================
-- DOMAIN REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS domain_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain_name TEXT NOT NULL,
  domain_type TEXT NOT NULL CHECK (domain_type IN ('new', 'existing')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'purchased', 'connected', 'failed')),
  amount_paid DECIMAL(12,2) NOT NULL,
  registrar_info JSONB,
  dns_records JSONB,
  admin_notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_requests_store ON domain_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_domain_requests_status ON domain_requests(status);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_requests ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile, admins can read all
-- Use is_admin() function to avoid infinite recursion
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (
    auth.uid() = id 
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Stores: Owners can manage their stores
CREATE POLICY "Store owners can manage their stores" ON stores
  FOR ALL USING (
    owner_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

-- Products: Store owners can manage their products
CREATE POLICY "Store owners can manage their products" ON products
  FOR ALL USING (
    owner_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

-- Import Catalog: Importers can view their imports, owners can view who imported their products
CREATE POLICY "Importers can manage their imports" ON import_catalog
  FOR ALL USING (
    importer_owner_id = auth.uid() 
    OR original_owner_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

-- Orders: Store owners and customers can view their orders
CREATE POLICY "Users can view their orders" ON orders
  FOR SELECT USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR customer_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

-- Wallets: Users can view their own wallet
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (
    user_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

-- Wallet Transactions: Users can view their transactions
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (
    user_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

-- Withdrawal Requests: Users can view their requests, admins can view all
CREATE POLICY "Users can view own withdrawal requests" ON withdrawal_requests
  FOR SELECT USING (
    user_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Users can create withdrawal requests" ON withdrawal_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Subscriptions: Users can view their subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (
    user_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

-- Delivery Zones: Store owners can manage their zones
CREATE POLICY "Store owners can manage their delivery zones" ON delivery_zones
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

-- Notifications: Users can view their notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Ad Campaigns: Store owners can manage their campaigns
CREATE POLICY "Store owners can manage their campaigns" ON ad_campaigns
  FOR ALL USING (
    store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid())
    OR public.is_admin(auth.uid())
  );

-- Domain Requests: Store owners can manage their domain requests
CREATE POLICY "Store owners can manage their domain requests" ON domain_requests
  FOR ALL USING (
    user_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    new_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 9999)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = new_number) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to get admin dashboard stats
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM profiles),
    'total_stores', (SELECT COUNT(*) FROM stores),
    'total_products', (SELECT COUNT(*) FROM products),
    'total_orders', (SELECT COUNT(*) FROM orders),
    'total_revenue', (SELECT COALESCE(SUM(total), 0) FROM orders WHERE payment_status = 'paid'),
    'pending_withdrawals', (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending'),
    'pending_verifications', (SELECT COUNT(*) FROM stores WHERE is_verified = FALSE),
    'blocked_stores', (SELECT COUNT(*) FROM stores WHERE is_blocked = TRUE)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PRODUCT EARNINGS TABLE (Tracks earnings per product)
-- ============================================
CREATE TABLE IF NOT EXISTS product_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  quantity_sold INTEGER NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  platform_fee DECIMAL(12,2) DEFAULT 0,
  net_profit DECIMAL(12,2) NOT NULL DEFAULT 0,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_earnings_product ON product_earnings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_earnings_store ON product_earnings(store_id);
CREATE INDEX IF NOT EXISTS idx_product_earnings_owner ON product_earnings(owner_id);
CREATE INDEX IF NOT EXISTS idx_product_earnings_date ON product_earnings(earned_at);

-- ============================================
-- STOCK ALERTS TABLE (Tracks low stock and out of stock notifications)
-- ============================================
CREATE TABLE IF NOT EXISTS stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('low_stock', 'out_of_stock', 'restocked')),
  previous_stock INTEGER NOT NULL,
  current_stock INTEGER NOT NULL,
  threshold INTEGER DEFAULT 10,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON stock_alerts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_store ON stock_alerts(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_owner ON stock_alerts(owner_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_unread ON stock_alerts(owner_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- FUNCTIONS FOR STOCK MANAGEMENT
-- ============================================

-- Function to check stock levels and create alerts
CREATE OR REPLACE FUNCTION check_stock_levels()
RETURNS TRIGGER AS $$
DECLARE
  low_stock_threshold INTEGER := 10;
  alert_type TEXT;
BEGIN
  -- Determine alert type
  IF NEW.stock_quantity = 0 THEN
    alert_type := 'out_of_stock';
  ELSIF NEW.stock_quantity <= low_stock_threshold THEN
    alert_type := 'low_stock';
  ELSE
    -- Stock is healthy, no alert needed
    RETURN NEW;
  END IF;

  -- Create stock alert
  INSERT INTO stock_alerts (
    product_id,
    store_id,
    owner_id,
    alert_type,
    previous_stock,
    current_stock,
    threshold
  ) VALUES (
    NEW.id,
    NEW.store_id,
    NEW.owner_id,
    alert_type,
    COALESCE(OLD.stock_quantity, NEW.stock_quantity),
    NEW.stock_quantity,
    low_stock_threshold
  );

  -- Auto-deactivate product if out of stock
  IF NEW.stock_quantity = 0 THEN
    NEW.is_active := FALSE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_stock_change ON products;

-- Create trigger for stock changes
CREATE TRIGGER on_stock_change
  AFTER UPDATE OF stock_quantity ON products
  FOR EACH ROW
  WHEN (OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity)
  EXECUTE FUNCTION check_stock_levels();

-- ============================================
-- FUNCTIONS FOR PRODUCT EARNINGS
-- ============================================

-- Function to record product earnings when an order is completed
CREATE OR REPLACE FUNCTION record_product_earnings(
  p_order_id UUID,
  p_product_id UUID,
  p_store_id UUID,
  p_owner_id UUID,
  p_quantity INTEGER,
  p_unit_cost DECIMAL,
  p_unit_price DECIMAL,
  p_platform_fee DECIMAL DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_earning_id UUID;
  v_total_revenue DECIMAL;
  v_total_cost DECIMAL;
  v_profit DECIMAL;
  v_net_profit DECIMAL;
BEGIN
  -- Calculate earnings
  v_total_revenue := p_quantity * p_unit_price;
  v_total_cost := p_quantity * p_unit_cost;
  v_profit := v_total_revenue - v_total_cost;
  v_net_profit := v_profit - p_platform_fee;

  -- Insert earnings record
  INSERT INTO product_earnings (
    product_id,
    store_id,
    owner_id,
    order_id,
    quantity_sold,
    unit_cost,
    unit_price,
    total_revenue,
    total_cost,
    profit,
    platform_fee,
    net_profit
  ) VALUES (
    p_product_id,
    p_store_id,
    p_owner_id,
    p_order_id,
    p_quantity,
    p_unit_cost,
    p_unit_price,
    v_total_revenue,
    v_total_cost,
    v_profit,
    p_platform_fee,
    v_net_profit
  )
  RETURNING id INTO v_earning_id;

  RETURN v_earning_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get product earnings summary
CREATE OR REPLACE FUNCTION get_product_earnings_summary(
  p_store_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  total_quantity_sold BIGINT,
  total_revenue DECIMAL,
  total_cost DECIMAL,
  total_profit DECIMAL,
  total_net_profit DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pe.product_id,
    p.name AS product_name,
    SUM(pe.quantity_sold)::BIGINT AS total_quantity_sold,
    SUM(pe.total_revenue) AS total_revenue,
    SUM(pe.total_cost) AS total_cost,
    SUM(pe.profit) AS total_profit,
    SUM(pe.net_profit) AS total_net_profit
  FROM product_earnings pe
  JOIN products p ON p.id = pe.product_id
  WHERE pe.store_id = p_store_id
    AND (p_start_date IS NULL OR pe.earned_at >= p_start_date)
    AND (p_end_date IS NULL OR pe.earned_at <= p_end_date)
  GROUP BY pe.product_id, p.name
  ORDER BY total_net_profit DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get stock alerts for a user
CREATE OR REPLACE FUNCTION get_stock_alerts(p_owner_id UUID)
RETURNS TABLE (
  alert_id UUID,
  product_id UUID,
  product_name TEXT,
  alert_type TEXT,
  current_stock INTEGER,
  threshold INTEGER,
  is_read BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id AS alert_id,
    sa.product_id,
    p.name AS product_name,
    sa.alert_type,
    sa.current_stock,
    sa.threshold,
    sa.is_read,
    sa.created_at
  FROM stock_alerts sa
  JOIN products p ON p.id = sa.product_id
  WHERE sa.owner_id = p_owner_id
  ORDER BY sa.created_at DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================

ALTER TABLE product_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_alerts ENABLE ROW LEVEL SECURITY;

-- Product Earnings: Owners can view their earnings
CREATE POLICY "Owners can view their product earnings" ON product_earnings
  FOR SELECT USING (
    owner_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

-- Stock Alerts: Owners can view and manage their alerts
CREATE POLICY "Owners can view their stock alerts" ON stock_alerts
  FOR SELECT USING (
    owner_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Owners can update their stock alerts" ON stock_alerts
  FOR UPDATE USING (owner_id = auth.uid());

-- ============================================
-- TAX SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tax_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_name TEXT DEFAULT 'VAT',
  tax_id_number TEXT,
  country TEXT DEFAULT 'Nigeria',
  state TEXT,
  is_tax_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_settings_store ON tax_settings(store_id);
CREATE INDEX IF NOT EXISTS idx_tax_settings_owner ON tax_settings(owner_id);

-- ============================================
-- BUSINESS EXPENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS business_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expense_name TEXT NOT NULL,
  expense_category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT,
  receipt_url TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_store ON business_expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner ON business_expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON business_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON business_expenses(expense_category);

-- ============================================
-- TAX REPORTS TABLE (Stores generated tax reports)
-- ============================================
CREATE TABLE IF NOT EXISTS tax_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_name TEXT NOT NULL,
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  total_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_expenses DECIMAL(12,2) NOT NULL DEFAULT 0,
  taxable_income DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  deductions DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_tax_payable DECIMAL(12,2) NOT NULL DEFAULT 0,
  report_data JSONB DEFAULT '{}',
  file_url TEXT,
  file_format TEXT CHECK (file_format IN ('pdf', 'csv', 'excel')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_reports_store ON tax_reports(store_id);
CREATE INDEX IF NOT EXISTS idx_tax_reports_owner ON tax_reports(owner_id);
CREATE INDEX IF NOT EXISTS idx_tax_reports_period ON tax_reports(report_period_start, report_period_end);

-- ============================================
-- FUNCTIONS FOR TAX CALCULATIONS
-- ============================================

-- Function to calculate tax for a period
CREATE OR REPLACE FUNCTION calculate_tax_for_period(
  p_store_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSON AS $$
DECLARE
  v_tax_rate DECIMAL(5,2);
  v_total_revenue DECIMAL(12,2);
  v_total_expenses DECIMAL(12,2);
  v_taxable_income DECIMAL(12,2);
  v_tax_amount DECIMAL(12,2);
  v_result JSON;
BEGIN
  -- Get tax rate
  SELECT tax_rate INTO v_tax_rate
  FROM tax_settings
  WHERE store_id = p_store_id;
  
  v_tax_rate := COALESCE(v_tax_rate, 0);

  -- Calculate total revenue from product earnings
  SELECT COALESCE(SUM(net_profit), 0) INTO v_total_revenue
  FROM product_earnings
  WHERE store_id = p_store_id
    AND earned_at >= p_start_date::TIMESTAMP WITH TIME ZONE
    AND earned_at <= (p_end_date + INTERVAL '1 day')::TIMESTAMP WITH TIME ZONE;

  -- Calculate total expenses
  SELECT COALESCE(SUM(amount), 0) INTO v_total_expenses
  FROM business_expenses
  WHERE store_id = p_store_id
    AND expense_date >= p_start_date
    AND expense_date <= p_end_date;

  -- Calculate taxable income and tax
  v_taxable_income := GREATEST(v_total_revenue - v_total_expenses, 0);
  v_tax_amount := (v_taxable_income * v_tax_rate) / 100;

  SELECT json_build_object(
    'total_revenue', v_total_revenue,
    'total_expenses', v_total_expenses,
    'taxable_income', v_taxable_income,
    'tax_rate', v_tax_rate,
    'tax_amount', v_tax_amount,
    'net_after_tax', v_total_revenue - v_tax_amount
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get expense categories summary
CREATE OR REPLACE FUNCTION get_expense_categories_summary(
  p_store_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  category TEXT,
  total_amount DECIMAL,
  expense_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    be.expense_category AS category,
    COALESCE(SUM(be.amount), 0) AS total_amount,
    COUNT(*)::BIGINT AS expense_count
  FROM business_expenses be
  WHERE be.store_id = p_store_id
    AND (p_start_date IS NULL OR be.expense_date >= p_start_date)
    AND (p_end_date IS NULL OR be.expense_date <= p_end_date)
  GROUP BY be.expense_category
  ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS POLICIES FOR TAX TABLES
-- ============================================

ALTER TABLE tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_reports ENABLE ROW LEVEL SECURITY;

-- Tax Settings: Owners can manage their settings
CREATE POLICY "Owners can manage their tax settings" ON tax_settings
  FOR ALL USING (
    owner_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

-- Business Expenses: Owners can manage their expenses
CREATE POLICY "Owners can manage their expenses" ON business_expenses
  FOR ALL USING (
    owner_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

-- Tax Reports: Owners can view their reports
CREATE POLICY "Owners can view their tax reports" ON tax_reports
  FOR ALL USING (
    owner_id = auth.uid() 
    OR public.is_admin(auth.uid())
  );

SELECT 'QAFRICA Database Schema Migration Complete!' AS status;

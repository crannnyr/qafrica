export type UnifiedSourceType = 'product' | 'china_import';

export type UnifiedMarketplaceProduct = {
  id: string;
  source_id: string;
  source_type: UnifiedSourceType;
  name: string;
  description: string | null;
  images: string[];
  price_ngn: number;
  compare_at_price_ngn: number | null;
  category: string | null;
  niche: string | null;
  has_variants: boolean;
  variants: unknown;
  is_available: boolean;
  stock_quantity: number | null;
  sold: number;
  rating: number | null;
  review_count: number;
  created_at: string;
  seller_type: 'store' | 'qafrica';
  seller_id: string | null;
  seller_name: string;
  seller_slug: string | null;
  seller_verified: boolean;
  tags: string[];
  is_china_import: boolean;
  flight_shipping_cost_ngn: number | null;
};

export type UnifiedFeedTab = 'for_you' | 'new' | 'deals' | 'bestsellers';

export type UnifiedSourceType = 'product' | 'china_import';

export type UnifiedMarketplaceProduct = {
  id: string;
  source_id: string;
  source_type: UnifiedSourceType;
  name: string;
  image: string;
  image2: string | null;
  price: number;
  compare_at_price: number | null;
  discount_pct: number;
  category: string | null;
  niche: string | null;
  has_variants: boolean;
  store_id: string | null;
  store_name: string;
  store_slug: string;
  store_verified: boolean;
  sold: number;
  rating: number | null;
  review_count: number;
  created_at: string;
  is_china_import: boolean;
  flight_shipping_cost_ngn: number | null;
  tags: string[];
};

export type UnifiedFeedTab = 'for_you' | 'new' | 'deals' | 'bestsellers';

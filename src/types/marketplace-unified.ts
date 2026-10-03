export type MarketplaceSourceType = 'product' | 'china_import';

/**
 * The customer-facing product contract for the isolated unified marketplace.
 *
 * `source_type` + `source_id` are the authoritative identity of the
 * underlying record. The marketplace must never assume every product lives
 * in `public.products`.
 */
export interface UnifiedMarketplaceProduct {
  /** Stable UI/catalog identifier. This is not assumed to be a database UUID. */
  id: string;
  source_id: string;
  source_type: MarketplaceSourceType;

  name: string;
  description: string | null;
  images: string[];

  price_ngn: number;
  compare_at_price_ngn: number | null;

  category: string | null;
  niche: string | null;
  has_variants: boolean;
  variants: unknown[];

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
}

export type UnifiedMarketplaceFeedTab = 'for_you' | 'new' | 'deals' | 'bestsellers';

export interface UnifiedMarketplaceFeedArgs {
  tab: UnifiedMarketplaceFeedTab;
  niche: string | null;
  category: string | null;
  search: string | null;
}

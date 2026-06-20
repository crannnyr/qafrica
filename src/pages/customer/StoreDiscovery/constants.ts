// src/pages/customer/StoreDiscovery/constants.ts

import {
  Store as StoreIcon, ShoppingBag,
  TrendingUp, Sparkles, MapPin,
} from 'lucide-react';

export const categories = [
  { id: 'all',         name: 'All Stores',   icon: StoreIcon   },
  { id: 'fashion',     name: 'Fashion',       icon: ShoppingBag },
  { id: 'electronics', name: 'Electronics',   icon: TrendingUp  },
  { id: 'beauty',      name: 'Beauty',        icon: Sparkles    },
  { id: 'home',        name: 'Home',          icon: MapPin      },
];

export interface StoreDisplay {
  id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  niches: string[];
  product_count: number;
  rating: number;
  review_count: number;
  is_verified: boolean;
  created_at: string;
}

export type SortBy = 'newest' | 'popular' | 'rating';
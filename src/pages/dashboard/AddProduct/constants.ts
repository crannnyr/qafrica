import { Tag, Image as ImageIcon, DollarSign, Package, Truck, Settings } from 'lucide-react';

export const STEPS = [
  { id: 1, name: 'Basics',       icon: Tag       },
  { id: 2, name: 'Images',       icon: ImageIcon  },
  { id: 3, name: 'Pricing',      icon: DollarSign },
  { id: 4, name: 'Variants',     icon: Package    },
  { id: 5, name: 'Shipping',     icon: Truck      },
  { id: 6, name: 'SEO & Settings', icon: Settings },
];

export const EMPTY_FORM = {
  name:                '',
  description:         '',
  niche:               '',
  category:            '',
  subcategory:         '',
  cost_price:          '',
  selling_price:       '',
  compare_at_price:    '',
  dropship_price:      '',
  wholesale_price:     '',
  stock_quantity:      '',
  sku:                 '',
  barcode:             '',
  low_stock_threshold: '10',
  allowOtherSellers:   true,
  has_variants:        false,
  weight_kg:           '',
  hs_code:             '',
  product_type:        'parcel' as 'parcel' | 'document',
  weight:              '',
  dimensions:          { length: '', width: '', height: '' },
  seo_title:           '',
  seo_description:     '',
  is_active:           true,
};

export const getDraftKey = (userId: string) => `qafrica_product_draft_${userId}`;
// src/pages/dashboard/Layout/constants.ts

import {
  LayoutDashboard, Package, ShoppingCart, Wallet,
  MapPin, ChartBar as BarChart3, Settings, BookOpen,
  MessageSquare, Tag, Upload, Import, Palette, Layers,
  Globe, Calculator, Truck, ShoppingBag,
} from 'lucide-react';

export interface NavChild {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: number;
  comingSoon?: boolean;
}

export interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  children?: NavChild[];
  comingSoon?: boolean;
}

export const sidebarItems: NavItem[] = [
  {
    icon: LayoutDashboard,
    label: 'Dashboard',
    path: '/dashboard',
  },
  {
    icon: Package,
    label: 'Products',
    path: '/dashboard/products',
    children: [
      { icon: Package, label: 'All Products',    path: '/dashboard/products' },
      { icon: Upload,  label: 'Bulk Import',     path: '/dashboard/products/bulk-import' },
      { icon: Import,  label: 'Import Catalog',  path: '/dashboard/import-catalog' },
    ],
  },
  {
    icon: ShoppingCart,
    label: 'Sales',
    path: '/dashboard/orders',
    children: [
      { icon: ShoppingCart,  label: 'Orders',          path: '/dashboard/orders' },
      { icon: Truck,         label: 'Dropship Orders', path: '/dashboard/dropship-orders' },
      { icon: MessageSquare, label: 'Reviews',         path: '/dashboard/reviews' },
      { icon: Tag,           label: 'Coupons',         path: '/dashboard/coupons' },
    ],
  },
  {
    icon: Wallet,
    label: 'Finance',
    path: '/dashboard/wallet',
    children: [
      { icon: Wallet,     label: 'Wallet',         path: '/dashboard/wallet' },
      { icon: Calculator, label: 'Tax & Expenses', path: '/dashboard/tax-expenses' },
    ],
  },
  {
    icon: Globe,
    label: 'Store Setup',
    path: '/dashboard/delivery-zones',
    children: [
      { icon: MapPin,  label: 'Delivery Zones', path: '/dashboard/delivery-zones' },
      { icon: Globe,   label: 'Custom Domain',  path: '/dashboard/domain' },
      { icon: Palette, label: 'Templates',      path: '/dashboard/templates' },
      { icon: Layers,  label: 'Niches',         path: '/dashboard/niches' },
    ],
  },
  {
    icon: ShoppingBag,
    label: 'Sell Online',
    path: '/dashboard/jumia',
    children: [
      { icon: ShoppingBag, label: 'Jumia', path: '/dashboard/jumia' },
      {
        icon: ShoppingBag,
        label: 'Konga',
        path: '/dashboard/konga',
        comingSoon: true,
      },
      {
        icon: ShoppingBag,
        label: 'Jiji',
        path: '/dashboard/jiji',
        comingSoon: true,
      },
    ],
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    path: '/dashboard/analytics',
  },
  {
    icon: Settings,
    label: 'Settings',
    path: '/dashboard/settings',
  },
  {
    icon: BookOpen,
    label: 'How to Use',
    path: '/dashboard/how-to-use',
  },
];

export const allNavItems = sidebarItems.flatMap((item) =>
  item.children ? [item, ...item.children] : [item],
);

export const staffAllowedPaths = [
  '/dashboard',
  '/dashboard/orders',
  '/dashboard/products',
  '/dashboard/dropship-orders',
];

// ── Marketplace brand colors ───────────────────────────────────────────────────

export const MARKETPLACE_BRANDS = {
  konga: {
    name:        'Konga',
    color:       '#E91E8C',
    bgColor:     'bg-pink-50',
    borderColor: 'border-pink-200',
    textColor:   'text-pink-600',
    visitors:    '2.5 million',
    message:     'Did you know that over 2.5 million people visit Konga every month searching for products just like yours?',
    subMessage:  'The team is working tirelessly to make it possible for you to list and push your products directly to Konga — boosting your sales by 100%. Stay tuned!',
  },
  jiji: {
    name:        'Jiji',
    color:       '#00A651',
    bgColor:     'bg-green-50',
    borderColor: 'border-green-200',
    textColor:   'text-green-600',
    visitors:    '3 million',
    message:     'Did you know that over 3 million people visit Jiji every month searching for products just like yours?',
    subMessage:  'The team is working tirelessly to make it possible for you to list and push your products directly to Jiji — boosting your sales by 100%. Stay tuned!',
  },
} as const;

export type MarketplaceBrand = keyof typeof MARKETPLACE_BRANDS;

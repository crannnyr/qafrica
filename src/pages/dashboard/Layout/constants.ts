// src/pages/dashboard/Layout/constants.ts

import {
  LayoutDashboard, Package, ShoppingCart, Wallet,
  MapPin, ChartBar as BarChart3, Settings, BookOpen,
  MessageSquare, Tag, Upload, Import, Palette, Layers,
  Globe, Calculator, Truck, ShoppingBag, Plus,
} from 'lucide-react';
import type { PermissionKey } from '@/lib/staffPermissions';

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
    label: 'Jumia',
    path: '/dashboard/jumia',
    children: [
      { icon: LayoutDashboard, label: 'Overview',            path: '/dashboard/jumia' },
      { icon: Plus,            label: 'Add Item',            path: '/dashboard/jumia/add' },
      { icon: MapPin,          label: 'Drop-off Locations',  path: '/dashboard/jumia/locations' },
      { icon: Wallet,          label: 'Earnings',            path: '/dashboard/jumia/wallet' },
      { icon: BookOpen,        label: 'How to Scale',        path: '/dashboard/jumia/how-to-scale' },
    ],
  },
  {
    icon: ShoppingBag,
    label: 'Other Marketplaces',
    path: '/dashboard/konga',
    children: [
      { icon: ShoppingBag, label: 'Konga', path: '/dashboard/konga', comingSoon: true },
      { icon: ShoppingBag, label: 'Jiji',  path: '/dashboard/jiji',  comingSoon: true },
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

// ── Standalone Jumia-only dashboard sidebar ──────────────────────────────────
// Flat, top-level items only (no nested children) — used by JumiaDashboardLayout
// for sellers whose signup_intent === 'jumia'. Paths point at /jumia-dashboard/*.
// NOT included in allNavItems / staff permission logic — those only apply to the
// regular store dashboard, which jumia-intent users never see.
export const jumiaSidebarItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Overview',           path: '/jumia-dashboard' },
  { icon: Plus,            label: 'Add Item',           path: '/jumia-dashboard/add' },
  { icon: MapPin,          label: 'Drop-off Locations', path: '/jumia-dashboard/locations' },
  { icon: Wallet,          label: 'Wallet',             path: '/jumia-dashboard/wallet' },
  { icon: BookOpen,        label: 'How to Scale',       path: '/jumia-dashboard/how-to-scale' },
  { icon: Settings,        label: 'Settings',           path: '/jumia-dashboard/settings' },
];

// ── Staff permission gating ──────────────────────────────────────────────────
// Maps each path to the permission required to see/access it.
// `null` = always visible to staff (no gate needed — informational or universal).
// Paths not listed here default to "restricted" (hidden from staff) for safety.
export const PATH_PERMISSIONS: Record<string, PermissionKey | null> = {
  '/dashboard': null,
  '/dashboard/how-to-use': null,

  '/dashboard/products':              'can_view_products',
  '/dashboard/products/bulk-import':  'can_manage_products',
  '/dashboard/import-catalog':        'can_manage_products',

  '/dashboard/orders':           'can_view_orders',
  '/dashboard/dropship-orders':  'can_view_orders',
  '/dashboard/reviews':          'can_view_products',
  '/dashboard/coupons':          'can_manage_products',

  '/dashboard/wallet':         'can_manage_wallet',
  '/dashboard/tax-expenses':   'can_manage_wallet',

  '/dashboard/delivery-zones': 'can_manage_settings',
  '/dashboard/domain':         'can_manage_settings',
  '/dashboard/templates':      'can_manage_settings',
  '/dashboard/niches':         'can_manage_settings',
  '/dashboard/settings':       'can_manage_settings',

  '/dashboard/jumia':  'can_manage_products',
  '/dashboard/konga':  'can_manage_products',
  '/dashboard/jiji':   'can_manage_products',

  '/dashboard/analytics': 'can_view_analytics',
};

/** Looks up the permission required for a path, falling back to the longest matching prefix
 * (handles sub-routes like /dashboard/orders/:id that aren't listed verbatim). */
export function getRequiredPermission(pathname: string): PermissionKey | null | undefined {
  if (pathname in PATH_PERMISSIONS) return PATH_PERMISSIONS[pathname];
  const match = Object.keys(PATH_PERMISSIONS)
    .filter((p) => p !== '/dashboard' && pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PATH_PERMISSIONS[match] : undefined; // undefined = unknown path, default-restrict
}

/** True if a staff member with the given permissions can see/access this path. */
export function staffCanAccess(
  pathname: string,
  permissions: Record<PermissionKey, boolean> | null,
): boolean {
  const required = getRequiredPermission(pathname);
  if (required === null) return true;       // always-visible page
  if (required === undefined) return false; // unknown path — default-restrict
  return Boolean(permissions?.[required]);
}

/** Filters the full sidebar tree down to what a staff member with these permissions may see. */
export function getVisibleSidebarItems(
  items: NavItem[],
  isStaff: boolean,
  staffPermissions: Record<PermissionKey, boolean> | null,
): NavItem[] {
  if (!isStaff) return items;

  return items
    .map((item) => {
      if (item.children) {
        const visibleChildren = item.children.filter((c) => staffCanAccess(c.path, staffPermissions));
        if (visibleChildren.length === 0) return null;
        return { ...item, children: visibleChildren };
      }
      return staffCanAccess(item.path, staffPermissions) ? item : null;
    })
    .filter((item): item is NavItem => item !== null);
}

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

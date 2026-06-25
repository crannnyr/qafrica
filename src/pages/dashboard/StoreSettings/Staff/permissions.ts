export const PERMISSIONS = [
  {
    key: 'can_view_orders',
    label: 'View Orders',
    description: 'See incoming orders for this store',
    defaultOn: true,
  },
  {
    key: 'can_update_orders',
    label: 'Update Orders',
    description: 'Change order status (confirm, ship, etc.)',
    defaultOn: true,
  },
  {
    key: 'can_view_products',
    label: 'View Products',
    description: 'See the product list, including inactive items',
    defaultOn: true,
  },
  {
    key: 'can_manage_products',
    label: 'Manage Products',
    description: 'Add, edit, or delete products',
    defaultOn: false,
  },
  {
    key: 'can_manage_wallet',
    label: 'Wallet & Withdrawals',
    description: 'View balance and request withdrawals',
    defaultOn: false,
  },
  {
    key: 'can_manage_settings',
    label: 'Store Settings',
    description: 'Edit store settings, domain, and subscription',
    defaultOn: false,
  },
  {
    key: 'can_view_analytics',
    label: 'Analytics & Pricing',
    description: 'View sales analytics and pricing data',
    defaultOn: false,
  },
] as const;

export type PermissionKey = typeof PERMISSIONS[number]['key'];

export type StaffPermissions = Record<PermissionKey, boolean>;

export type Tab = 'account' | 'general' | 'images' | 'branding' | 'payments' | 'social' | 'location' | 'password' | 'staff';

export const TABS: { id: Tab; label: string }[] = [
  { id: 'account',  label: 'Account'  },
  { id: 'general',  label: 'General'  },
  { id: 'images',   label: 'Images'   },
  { id: 'branding', label: 'Branding' },
  { id: 'payments', label: 'Payments' },
  { id: 'social',   label: 'Social'   },
  { id: 'location', label: 'Location' },
  { id: 'password', label: 'Password' },
  { id: 'staff',    label: 'Staff'    },
];

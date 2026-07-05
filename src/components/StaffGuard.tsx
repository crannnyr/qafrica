import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore, useStoreStore } from '@/stores';
import { supabase } from '@/services';

// Mirrors the boolean permission columns on public.store_staff
type StaffPermissionKey =
  | 'can_view_orders'
  | 'can_update_orders'
  | 'can_view_products'
  | 'can_manage_products'
  | 'can_manage_wallet'
  | 'can_manage_settings'
  | 'can_view_analytics';

interface Props {
  children: React.ReactNode;
  // Omit this prop entirely to hard-block staff from this route no matter
  // what permissions the owner grants (used for Settings, Subscription).
  permission?: StaffPermissionKey;
}

export default function StaffGuard({ children, permission }: Props) {
  const { user } = useAuthStore();
  const { currentStore } = useStoreStore();
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    // Store owners/admins always pass through untouched
    if (user?.role !== 'staff') {
      setAllowed(true);
      setChecked(true);
      return;
    }

    // No permission key passed → this route is hard-blocked for every staff
    // member regardless of their toggles (e.g. Settings, Subscription).
    if (!permission) {
      setAllowed(false);
      setChecked(true);
      return;
    }

    if (!currentStore?.id) {
      setAllowed(false);
      setChecked(true);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from('store_staff')
        .select(permission)
        .eq('store_id', currentStore.id)
        .eq('staff_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (!cancelled) {
        setAllowed(Boolean((data as Record<string, boolean> | null)?.[permission]));
        setChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, currentStore?.id, permission]);

  if (!checked) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

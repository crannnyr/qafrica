import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services';
import { toast } from 'sonner';
import type { StoreStaff } from '@/types';
import type { PermissionKey } from './permissions';

export function useStaffData(storeId: string, ownerId: string) {
  const [staffList, setStaffList] = useState<StoreStaff[]>([]);
  const [staffLimit, setStaffLimit] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const loadStaff = useCallback(async () => {
    if (!storeId) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('store_staff')
      .select('*')
      .eq('store_id', storeId)
      .neq('status', 'removed')
      .order('created_at', { ascending: false });
    setStaffList((data as StoreStaff[]) ?? []);
    setIsLoading(false);
  }, [storeId]);

  const loadLimit = useCallback(async () => {
    if (!ownerId) return;
    const { data } = await supabase.rpc('get_staff_limit', { p_user_id: ownerId });
    setStaffLimit(data ?? 0);
  }, [ownerId]);

  useEffect(() => {
    if (storeId && ownerId) {
      loadStaff();
      loadLimit();
    }
  }, [storeId, ownerId, loadStaff, loadLimit]);

  const callStaffManagement = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('staff-management', { body: payload });
    if (error) throw new Error(error.message ?? 'Request failed');
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const invite = async (email: string) => {
    try {
      await callStaffManagement({ action: 'invite', store_id: storeId, email });
      toast.success(`Invite sent to ${email}`);
      await loadStaff();
      return true;
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send invite');
      return false;
    }
  };

  const remove = async (staffId: string) => {
    setMutatingId(staffId);
    try {
      await callStaffManagement({ action: 'remove', staff_id: staffId });
      toast.success('Staff member removed');
      await loadStaff();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove staff member');
    } finally {
      setMutatingId(null);
    }
  };

  const resend = async (staffId: string) => {
    setMutatingId(staffId);
    try {
      await callStaffManagement({ action: 'resend', staff_id: staffId });
      toast.success('Invite resent');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to resend invite');
    } finally {
      setMutatingId(null);
    }
  };

  const togglePermission = async (staffId: string, permission: PermissionKey, value: boolean) => {
    // Optimistic update so the switch responds instantly
    setStaffList(prev => prev.map(s => (s.id === staffId ? { ...s, [permission]: value } : s)));
    try {
      await callStaffManagement({ action: 'toggle_permission', staff_id: staffId, permission, value });
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update permission');
      // Revert on failure
      setStaffList(prev => prev.map(s => (s.id === staffId ? { ...s, [permission]: !value } : s)));
    }
  };

  const activeCount = staffList.filter(s => s.status !== 'removed').length;
  const canInvite = staffLimit > 0 && activeCount < staffLimit;

  return {
    staffList,
    staffLimit,
    isLoading,
    mutatingId,
    activeCount,
    canInvite,
    invite,
    remove,
    resend,
    togglePermission,
    refresh: loadStaff,
  };
}

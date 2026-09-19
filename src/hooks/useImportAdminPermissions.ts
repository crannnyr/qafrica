import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';

export type ImportAdminPermission = string;

interface ImportAdminPermissionsState {
  permissions: Set<ImportAdminPermission>;
  loading: boolean;
  error: string | null;
}

export function useImportAdminPermissions(): ImportAdminPermissionsState & {
  hasPermission: (permission: ImportAdminPermission) => boolean;
  reload: () => Promise<void>;
} {
  const [permissions, setPermissions] = useState<Set<ImportAdminPermission>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      // Legacy Import Manager sessions do not use Supabase Auth.
      // They remain handled by the existing manager-token flow.
      if (!user) {
        setPermissions(new Set());
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      // Import Admin RBAC is only available to platform admins.
      // Having profiles.role = 'admin' alone does not grant Import Admin permissions.
      if (profile?.role !== 'admin') {
        setPermissions(new Set());
        return;
      }

      const { data: assignments, error: assignmentsError } = await supabase
        .from('import_admin_user_roles')
        .select('role_id')
        .eq('user_id', user.id);

      if (assignmentsError) throw assignmentsError;

      const roleIds = (assignments ?? []).map((assignment) => assignment.role_id);

      if (roleIds.length === 0) {
        setPermissions(new Set());
        return;
      }

      const { data: rolePermissions, error: rolePermissionsError } = await supabase
        .from('import_admin_role_permissions')
        .select('permission_id')
        .in('role_id', roleIds);

      if (rolePermissionsError) throw rolePermissionsError;

      const permissionIds = Array.from(
        new Set((rolePermissions ?? []).map((rolePermission) => rolePermission.permission_id)),
      );

      if (permissionIds.length === 0) {
        setPermissions(new Set());
        return;
      }

      const { data: permissionRows, error: permissionsError } = await supabase
        .from('import_admin_permissions')
        .select('key')
        .in('id', permissionIds);

      if (permissionsError) throw permissionsError;

      const next = new Set<string>(
        (permissionRows ?? [])
          .map((permission) => permission.key)
          .filter((key): key is string => Boolean(key)),
      );
      setPermissions(next);
    } catch (err) {
      console.error('[Import Admin RBAC] Failed to load permissions:', err);
      setPermissions(new Set());
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPermission = useCallback(
    (permission: ImportAdminPermission) => permissions.has(permission),
    [permissions],
  );

  return { permissions, loading, error, hasPermission, reload: load };
}

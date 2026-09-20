import { useCallback, useEffect, useState } from 'react';
import CONFIG from '@/lib/config';

export type ImportAdminPermission = string;

interface ImportAdminPermissionsState {
  permissions: Set<ImportAdminPermission>;
  loading: boolean;
  error: string | null;
}

export function useImportAdminPermissions(managerToken?: string | null): ImportAdminPermissionsState & {
  hasPermission: (permission: ImportAdminPermission) => boolean;
  reload: () => Promise<void>;
} {
  const [permissions, setPermissions] = useState<Set<ImportAdminPermission>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!managerToken) {
      setPermissions(new Set());
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${CONFIG.SUPABASE_URL}/functions/v1/china-import?action=admin-permissions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ manager_token: managerToken }),
        },
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to load Import Admin permissions');

      const next = new Set<string>(
        Array.isArray(data.permissions)
          ? data.permissions.filter((key: unknown): key is string => typeof key === 'string' && key.length > 0)
          : [],
      );
      setPermissions(next);
    } catch (err) {
      console.error('[Import Admin RBAC] Failed to load legacy manager permissions:', err);
      setPermissions(new Set());
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, [managerToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPermission = useCallback(
    (permission: ImportAdminPermission) => permissions.has(permission),
    [permissions],
  );

  return { permissions, loading, error, hasPermission, reload: load };
}

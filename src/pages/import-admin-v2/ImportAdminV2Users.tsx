import ImportAdminCustomers from '@/pages/import-admin/ImportAdminCustomers';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

export default function ImportAdminV2Users() {
  const token = sessionStorage.getItem('import_manager_token') || '';
  const { hasPermission, loading, error } = useImportAdminPermissions(token);

  if (loading) return <div className="p-8 text-center text-sm text-gray-400">Checking Users access…</div>;
  if (error) return <div className="p-8 text-center text-sm text-red-500">{error}</div>;
  if (!hasPermission('import.clients.view')) {
    return <div className="p-8 text-center text-sm text-gray-400">You do not have permission to view Users.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Users</h2>
        <p className="text-xs text-gray-400">Customer accounts, order history, spending, and payment status.</p>
      </div>
      <ImportAdminCustomers token={token} />
    </div>
  );
}

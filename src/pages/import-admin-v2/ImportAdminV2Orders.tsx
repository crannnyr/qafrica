import { OrdersList } from '@/pages/import-admin/ImportAdminPage';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

export default function ImportAdminV2Orders() {
  const token = sessionStorage.getItem('import_manager_token') || '';
  const { hasPermission, loading, error } = useImportAdminPermissions(token);

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-400">Checking Orders access…</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-sm text-red-500">{error}</div>;
  }

  if (!hasPermission('import.total_orders.view')) {
    return <div className="p-8 text-center text-sm text-gray-400">You do not have permission to view Orders.</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Orders</h2>
        <p className="text-xs text-gray-400">All import orders, with search, status filters, billing, and order details.</p>
      </div>
      <OrdersList token={token} />
    </div>
  );
}

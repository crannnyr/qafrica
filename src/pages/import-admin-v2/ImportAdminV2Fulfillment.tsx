import ChinaImportFulfillmentManager from '@/pages/import-admin/ChinaImportFulfillmentManager';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';
import { getManagementToken } from './ManagementAuth';

export default function ImportAdminV2Fulfillment() {
  const token = getManagementToken();
  const { hasPermission, loading } = useImportAdminPermissions(token);

  if (!token || loading) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-xs text-gray-500">Loading fulfillment permissions…</div>;
  }

  if (!hasPermission('import.orders.view')) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center"><p className="text-sm font-semibold text-gray-900">Fulfillment access restricted</p><p className="text-xs text-gray-500 mt-1">Your Import Admin account does not have permission to view fulfillment.</p></div>;
  }

  return <ChinaImportFulfillmentManager token={token} canReceive={hasPermission('import.orders.update')} />;
}

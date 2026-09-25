import ChinaImportFulfillmentManager from '@/pages/import-admin/ChinaImportFulfillmentManager';
import { getManagementToken } from './ManagementAuth';

export default function ImportAdminV2Fulfillment() {
  const token = getManagementToken();

  if (!token) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <p className="text-sm font-semibold text-gray-900">Import Admin session required</p>
        <p className="text-xs text-gray-500 mt-1">Please sign in again to manage fulfillment.</p>
      </div>
    );
  }

  return <ChinaImportFulfillmentManager token={token} canReceive />;
}

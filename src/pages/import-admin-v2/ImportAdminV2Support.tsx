import { Loader2 } from 'lucide-react';
import AiSupportInbox from '@/pages/import-admin/AiSupportInbox';
import { getManagementToken } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

export default function ImportAdminV2Support() {
  const token = getManagementToken();
  const { loading, error, hasPermission } = useImportAdminPermissions(token);

  if (!token) return null;

  if (loading) {
    return (
      <div className="min-h-[240px] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-sm font-bold text-red-700">Could not load permissions</h2>
        <p className="text-xs text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!hasPermission('import.messages.view')) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-bold text-gray-900">Support access required</h2>
        <p className="text-xs text-gray-500 mt-1">Your manager account does not have permission to view support conversations.</p>
      </div>
    );
  }

  return <AiSupportInbox token={token} />;
}

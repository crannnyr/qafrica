import AiSupportInbox, { AiSupportAlertMonitor } from '@/pages/import-admin/AiSupportInbox';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';
import { getManagementToken } from './ManagementAuth';

export default function ImportAdminV2Support() {
  const token = getManagementToken();
  const { hasPermission, loading } = useImportAdminPermissions(token);

  if (!token || loading) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-xs text-gray-500">Loading support permissions…</div>;
  }

  if (!hasPermission('import.messages.view')) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center"><p className="text-sm font-semibold text-gray-900">AI Support access restricted</p><p className="text-xs text-gray-500 mt-1">Your Import Admin account does not have permission to view AI Support.</p></div>;
  }

  return (
    <>
      <AiSupportAlertMonitor token={token} enabled={hasPermission('import.messages.view')} />
      <AiSupportInbox token={token} />
    </>
  );
}

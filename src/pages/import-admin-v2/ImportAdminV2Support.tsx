import AiSupportInbox, { AiSupportAlertMonitor } from '@/pages/import-admin/AiSupportInbox';
import { getManagementToken } from './ManagementAuth';

export default function ImportAdminV2Support() {
  const token = getManagementToken();

  if (!token) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <p className="text-sm font-semibold text-gray-900">Import Admin session required</p>
        <p className="text-xs text-gray-500 mt-1">Please sign in again to open AI Support.</p>
      </div>
    );
  }

  return (
    <>
      <AiSupportAlertMonitor token={token} enabled />
      <AiSupportInbox token={token} />
    </>
  );
}

import { Mail, ShieldCheck } from 'lucide-react';
import ConfirmedOrderMessagingManager from '@/pages/import-admin/ConfirmedOrderMessagingManager';
import { getManagementToken } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

export default function ImportAdminV2EmailTemplates() {
  const token = getManagementToken();
  const { hasPermission, loading } = useImportAdminPermissions(token);

  if (!token || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasPermission('import.messages.view')) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center">
        <ShieldCheck className="w-9 h-9 mx-auto text-gray-200" />
        <Mail className="w-5 h-5 mx-auto text-gray-300 mt-4" />
        <h2 className="font-black text-gray-900 mt-3">Email Templates</h2>
        <p className="text-sm text-gray-400 mt-1">
          You do not have permission to view email templates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gray-950 px-6 py-7 text-white">
        <div className="absolute -right-10 -top-16 w-48 h-48 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-orange-500/15 border border-orange-400/20 flex items-center justify-center">
            <Mail className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-orange-400">Customer communications</p>
            <h2 className="text-2xl font-black tracking-tight mt-1">Email Templates</h2>
            <p className="text-sm text-gray-400 mt-1 max-w-2xl">
              Send customer emails and edit the templates used throughout the import process from one place.
            </p>
          </div>
        </div>
      </div>

      <ConfirmedOrderMessagingManager token={token} />
    </div>
  );
}

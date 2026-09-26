import { CheckCircle2 } from 'lucide-react';
import ConfirmedPaymentsManager from '@/pages/import-admin/ConfirmedPaymentsManager';
import { getManagementToken } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

export default function ImportAdminV2ConfirmedPayments() {
  const token = getManagementToken();
  const { hasPermission, loading, error } = useImportAdminPermissions(token);

  if (loading) {
    return <div className="min-h-[320px] flex items-center justify-center text-sm text-gray-400">Loading permissions…</div>;
  }

  if (error) {
    return <div className="bg-white rounded-2xl border border-red-100 p-6 text-sm text-red-600">{error}</div>;
  }

  if (!token || !hasPermission('import.confirmed_payments.view')) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">You do not have permission to view Confirmed Payments.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          <h2 className="text-2xl font-black text-gray-900">Confirmed Payments</h2>
        </div>
        <p className="text-sm text-gray-500 mt-1">Review paid import orders, payment methods, items, and customer profiles.</p>
      </div>
      <ConfirmedPaymentsManager token={token} />
    </div>
  );
}

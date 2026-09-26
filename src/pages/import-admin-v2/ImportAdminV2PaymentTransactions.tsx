import { CreditCard, ShieldCheck } from 'lucide-react';
import PaystackTransactions from '@/pages/import-admin/PaystackTransactions';
import { getManagementToken } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

export default function ImportAdminV2PaymentTransactions() {
  const token = getManagementToken();
  const { hasPermission, loading } = useImportAdminPermissions(token);

  if (!token || loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasPermission('import.paystack_transactions.view')) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-10 text-center">
        <ShieldCheck className="w-9 h-9 mx-auto text-gray-200" />
        <CreditCard className="w-5 h-5 mx-auto text-gray-300 mt-4" />
        <h2 className="font-black text-gray-900 mt-3">Payment Transactions</h2>
        <p className="text-sm text-gray-400 mt-1">
          You do not have permission to view payment transactions.
        </p>
      </div>
    );
  }

  return <PaystackTransactions token={token} />;
}

import { TrendingUp } from 'lucide-react';
import TrendingManager from '@/pages/import-admin/TrendingManager';
import { getManagementToken } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

export default function ImportAdminV2Trending() {
  const token = getManagementToken();
  const { hasPermission, loading, error } = useImportAdminPermissions(token);

  if (loading) {
    return <div className="min-h-[320px] flex items-center justify-center text-sm text-gray-400">Loading permissions…</div>;
  }

  if (error) {
    return <div className="bg-white rounded-2xl border border-red-100 p-6 text-sm text-red-600">{error}</div>;
  }

  if (!token || !hasPermission('import.trending.view')) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-400">You do not have permission to view Trending.</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-500" />
          <h2 className="text-2xl font-black text-gray-900">Trending</h2>
        </div>
        <p className="text-sm text-gray-500 mt-1">Manage the products featured in the Trending section.</p>
      </div>
      <TrendingManager token={token} />
    </div>
  );
}

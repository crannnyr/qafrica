import ManagementAnalytics from './ManagementAnalytics';

export default function ImportAdminV2Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">Overview</p>
        <h2 className="text-2xl font-black text-gray-900 mt-1">Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">Track import revenue, paid orders, units sold, and expected profit.</p>
      </div>
      <ManagementAnalytics />
    </div>
  );
}

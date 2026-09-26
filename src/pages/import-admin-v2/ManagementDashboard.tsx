import { getManagementManager } from './ManagementAuth';
import ImportAdminV2Analytics from './ImportAdminV2Analytics';

export default function ManagementDashboard() {
  const manager = getManagementManager();
  const name = manager?.full_name || manager?.name || 'Manager';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">Management</p>
        <h2 className="text-2xl font-black text-gray-900 mt-1">Welcome back, {name.split(' ')[0]}</h2>
        <p className="text-sm text-gray-500 mt-1">Import performance across your selected date range.</p>
      </div>

      <ImportAdminV2Analytics />
    </div>
  );
}

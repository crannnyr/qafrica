import { User, ShieldCheck } from 'lucide-react';

type Manager = { full_name?: string; name?: string; email?: string };

function getManager(): Manager | null {
  try {
    return JSON.parse(sessionStorage.getItem('management_manager') || 'null');
  } catch {
    return null;
  }
}

export default function ManagementDashboard() {
  const manager = getManager();
  const name = manager?.full_name || manager?.name || 'Manager';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">Management</p>
        <h2 className="text-2xl font-black text-gray-900 mt-1">Welcome back, {name.split(' ')[0]}</h2>
        <p className="text-sm text-gray-500 mt-1">Manage the areas assigned to you from this workspace.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center mb-4">
            <ShieldCheck className="w-5 h-5 text-orange-500" />
          </div>
          <h3 className="font-bold text-gray-900">Management workspace</h3>
          <p className="text-sm text-gray-500 mt-1">This is a separate Management area and does not render the Import Admin page.</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
            <User className="w-5 h-5 text-gray-500" />
          </div>
          <h3 className="font-bold text-gray-900">Signed-in manager</h3>
          <p className="text-sm text-gray-500 mt-1">{manager?.email || 'Authenticated management account'}</p>
        </div>
      </div>
    </div>
  );
}

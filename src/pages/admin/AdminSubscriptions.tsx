import { useEffect, useState } from 'react';
import { Crown, Users, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { subscriptionService } from '@/services';

export default function AdminSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    const { data } = await subscriptionService.getAllSubscriptions();
    if (data) setSubscriptions(data);
  };

  const tierColors: Record<string, string> = {
    single: 'bg-blue-100 text-blue-800',
    three: 'bg-purple-100 text-purple-800',
    unlimited: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-500 mt-1">Manage platform subscriptions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total</p>
          <p className="text-3xl font-bold text-gray-900">{subscriptions.length}</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Active</p>
          <p className="text-3xl font-bold text-green-600">
            {subscriptions.filter((s) => s.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Expired</p>
          <p className="text-3xl font-bold text-red-600">
            {subscriptions.filter((s) => !s.is_active).length}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Revenue</p>
          <p className="text-3xl font-bold text-orange-600">
            ₦{subscriptions.reduce((sum, s) => sum + (s.amount_paid || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-orange-500" />
                      </div>
                      <span className="font-medium text-gray-900">{sub.user?.full_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      tierColors[sub.tier] || 'bg-gray-100 text-gray-800'
                    }`}>
                      <Crown className="w-3 h-3 mr-1" />
                      {sub.tier}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    ₦{sub.amount_paid?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {sub.is_active ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {new Date(sub.expires_at).toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

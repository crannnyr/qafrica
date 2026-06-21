// src/pages/admin/AdminJumia.tsx
// Mirrors AdminOrders.tsx: search bar + table. Links each row to the detail page for actions.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, Search } from 'lucide-react';
import { useJumiaStore } from '@/stores/jumiaStore';
import JumiaSubmissionStatusBadge from '../dashboard/Jumia/JumiaSubmissionStatusBadge';

export default function AdminJumia() {
  const { allSubmissions, fetchAllSubmissions, isLoading } = useJumiaStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchAllSubmissions();
  }, [fetchAllSubmissions]);

  const filtered = allSubmissions.filter((s) => {
    const matchesSearch =
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.owner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.owner?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = [
    'all', 'pending_payment', 'awaiting_schedule', 'awaiting_dropoff', 'dropped_off',
    'received_by_jumia', 'live', 'out_of_stock', 'paused', 'rejected',
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jumia Submissions</h1>
        <p className="text-gray-500 mt-1">Manage items users have sent to Jumia</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by item or user..."
            className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 focus:border-orange-500 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 rounded-lg border border-gray-200 focus:border-orange-500 outline-none text-sm"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fulfillment</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">No submissions found</p>
                  </td>
                </tr>
              ) : filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link to={`/admin/jumia/${s.id}`} className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {s.images?.[0]
                          ? <img src={s.images[0]} alt="" className="w-full h-full object-cover rounded-lg" />
                          : <Package className="w-5 h-5 text-orange-500" />}
                      </div>
                      <span className="font-medium text-gray-900 hover:text-orange-600">{s.name}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{s.owner?.full_name || '—'}</p>
                    <p className="text-sm text-gray-500">{s.owner?.email}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                    {s.fulfillment_method?.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4">
                    <JumiaSubmissionStatusBadge status={s.status} />
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    ₦{Number(s.selling_price).toLocaleString()}
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

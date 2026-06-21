// src/pages/dashboard/JumiaPage.tsx
// Landing page for the Jumia reseller feature. Minimal, explanatory, status-first.

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, MapPin, Wallet, BookOpen, Package, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores';
import { useJumiaStore } from '@/stores/jumiaStore';
import JumiaSubmissionStatusBadge from './Jumia/JumiaSubmissionStatusBadge';
import JumiaPlanGate from './Jumia/JumiaPlanGate';

function JumiaOverview() {
  const { user } = useAuthStore();
  const { submissions, wallet, fetchSubmissions, fetchWallet, isLoading } = useJumiaStore();

  useEffect(() => {
    if (user?.id) {
      fetchSubmissions(user.id);
      fetchWallet(user.id);
    }
  }, [user?.id, fetchSubmissions, fetchWallet]);

  const liveCount = submissions.filter((s) => s.status === 'live').length;
  const inProgressCount = submissions.filter((s) =>
    ['pending_payment', 'awaiting_schedule', 'awaiting_dropoff', 'dropped_off', 'received_by_jumia'].includes(s.status)
  ).length;
  const recentSubmissions = submissions.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sell on Jumia</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
            Send your products to Jumia and reach more customers. We handle the listing —
            you just keep stock ready and we keep you updated on sales.
          </p>
        </div>
        <Link to="/dashboard/jumia/add">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Send an Item to Jumia
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Live on Jumia</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{liveCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">In Progress</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{inProgressCount}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-sm">
          <p className="text-sm font-medium text-gray-400 mb-1">Jumia Wallet</p>
          <p className="text-2xl font-bold">₦{Number(wallet?.balance ?? 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Add Item', icon: Plus, path: '/dashboard/jumia/add', color: 'bg-orange-500' },
          { label: 'Drop-off Locations', icon: MapPin, path: '/dashboard/jumia/locations', color: 'bg-blue-500' },
          { label: 'Jumia Wallet', icon: Wallet, path: '/dashboard/jumia/wallet', color: 'bg-green-500' },
          { label: 'How to Scale', icon: BookOpen, path: '/dashboard/jumia/how-to-scale', color: 'bg-purple-500' },
        ].map((action) => (
          <Link
            key={action.label}
            to={action.path}
            className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-500 hover:shadow-md transition-all group"
          >
            <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0`}>
              <action.icon className="w-6 h-6 text-white" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white text-sm">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Recent submissions */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Items</h2>
          {submissions.length > 5 && (
            <Link to="/dashboard/jumia/items" className="text-sm text-orange-500 font-bold">View All</Link>
          )}
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : recentSubmissions.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">No items sent to Jumia yet</p>
            <p className="text-gray-400 text-sm mb-4">Send your first item and start reaching Jumia customers.</p>
            <Link to="/dashboard/jumia/add">
              <Button variant="outline" size="sm">Get Started <ArrowRight className="w-4 h-4 ml-2" /></Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {recentSubmissions.map((s) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
              >
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden flex-shrink-0">
                  {s.images?.[0] && <img src={s.images[0]} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white truncate text-sm">{s.name}</p>
                  <p className="text-xs text-gray-500">₦{Number(s.selling_price).toLocaleString()}</p>
                </div>
                <JumiaSubmissionStatusBadge status={s.status} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function JumiaPage() {
  return (
    <JumiaPlanGate>
      <JumiaOverview />
    </JumiaPlanGate>
  );
}

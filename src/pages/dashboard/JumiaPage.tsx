// src/pages/dashboard/JumiaPage.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, MapPin, Wallet, BookOpen, Package, ArrowRight, Download, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useStoreStore } from '@/stores';
import { useJumiaStore } from '@/stores/jumiaStore';
import JumiaSubmissionStatusBadge from './Jumia/JumiaSubmissionStatusBadge';
import JumiaPlanGate from './Jumia/JumiaPlanGate';
import JumiaDropoffTaskCard from './Jumia/JumiaDropoffTaskCard';
import { generateJumiaLabel } from './Jumia/generateJumiaLabel';

type Tab = 'items' | 'dropoffs';

function JumiaOverview() {
  const { user } = useAuthStore();
  const { currentStore } = useStoreStore();
  const { submissions, wallet, dropoffTasks, fetchSubmissions, fetchWallet, fetchUserDropoffTasks, isLoading } = useJumiaStore();
  const [activeTab, setActiveTab] = useState<Tab>('items');

  useEffect(() => {
    if (user?.id) {
      fetchSubmissions(user.id);
      fetchWallet(user.id);
      fetchUserDropoffTasks(user.id);
    }
  }, [user?.id, fetchSubmissions, fetchWallet, fetchUserDropoffTasks]);

  const liveCount = submissions.filter((s) => s.status === 'live').length;
  const inProgressCount = submissions.filter((s) =>
    ['pending_payment', 'awaiting_schedule', 'awaiting_dropoff', 'dropped_off', 'received_by_jumia'].includes(s.status)
  ).length;
  const recentSubmissions = submissions.slice(0, 5);

  // Pending tasks that need action RIGHT NOW
  const pendingTasks = dropoffTasks.filter((t) => t.status === 'notified');
  const mostUrgent = pendingTasks.reduce<typeof pendingTasks[0] | null>((acc, t) => {
    if (!acc || !t.deadline_at || !acc.deadline_at) return acc ?? t;
    return new Date(t.deadline_at) < new Date(acc.deadline_at) ? t : acc;
  }, null);

  const hoursLeft = mostUrgent?.deadline_at
    ? Math.max(0, Math.floor((new Date(mostUrgent.deadline_at).getTime() - Date.now()) / 3600000))
    : null;

  const submissionNameFor = (task: typeof dropoffTasks[0]) =>
    submissions.find((s) => s.id === task.submission_id)?.name ?? 'Item';

  return (
    <div className="space-y-6">
      {/* Urgent banner */}
      {pendingTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 cursor-pointer"
          onClick={() => setActiveTab('dropoffs')}
        >
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-800 dark:text-red-300 text-sm">
              {pendingTasks.length} drop-off{pendingTasks.length > 1 ? 's' : ''} waiting — action required
            </p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              {hoursLeft !== null && `Most urgent: ${hoursLeft}h remaining. `}
              Tap to view your drop-off tasks.
            </p>
          </div>
          <Clock className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sell on Jumia</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
            Send your products to Jumia and reach more customers. We handle the logistics — you track your sales and earnings.
          </p>
        </div>
        <Link to="/dashboard/jumia/add">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus className="w-4 h-4 mr-2" /> Send an Item
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
          { label: 'Add Item',            icon: Plus,     path: '/dashboard/jumia/add',           color: 'bg-orange-500' },
          { label: 'Drop-off Locations',  icon: MapPin,   path: '/dashboard/jumia/locations',      color: 'bg-blue-500'   },
          { label: 'Jumia Wallet',        icon: Wallet,   path: '/dashboard/jumia/wallet',         color: 'bg-green-500'  },
          { label: 'How to Scale',        icon: BookOpen, path: '/dashboard/jumia/how-to-scale',   color: 'bg-purple-500' },
        ].map((action) => (
          <Link key={action.label} to={action.path}
            className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-500 hover:shadow-md transition-all group">
            <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0`}>
              <action.icon className="w-6 h-6 text-white" />
            </div>
            <span className="font-semibold text-gray-900 dark:text-white text-sm">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-700">
          <button onClick={() => setActiveTab('items')}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${
              activeTab === 'items'
                ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            My Items
          </button>
          <button onClick={() => setActiveTab('dropoffs')}
            className={`flex-1 py-4 text-sm font-bold transition-colors relative ${
              activeTab === 'dropoffs'
                ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            Drop-off Tasks
            {pendingTasks.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {pendingTasks.length}
              </span>
            )}
          </button>
        </div>

        {/* Items tab */}
        {activeTab === 'items' && (
          isLoading ? (
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
                <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden flex-shrink-0">
                    {s.images?.[0] && <img src={s.images[0]} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate text-sm">{s.name}</p>
                    <p className="text-xs text-gray-500">₦{Number(s.selling_price).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <JumiaSubmissionStatusBadge status={s.status} />
                    {s.payment_status === 'paid' && (
                      <button
                        onClick={() => generateJumiaLabel(s, currentStore?.name ?? 'My Store', user?.full_name ?? user?.email ?? '')}
                        title="Re-download shipping label"
                        className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )
        )}

        {/* Drop-offs tab */}
        {activeTab === 'dropoffs' && (
          <div className="p-4">
            {dropoffTasks.length === 0 ? (
              <div className="py-12 text-center">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">No drop-off tasks yet</p>
                <p className="text-gray-400 text-sm mt-1">When a sale comes in on a self-dropoff item, your task will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dropoffTasks.map((task) => (
                  <JumiaDropoffTaskCard
                    key={task.id}
                    task={task}
                    submissionName={submissionNameFor(task)}
                  />
                ))}
              </div>
            )}
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

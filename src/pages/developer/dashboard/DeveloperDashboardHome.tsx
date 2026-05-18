// src/pages/developer/dashboard/DeveloperDashboardHome.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Key, Package, ClipboardList, Wallet, ArrowRight,
  AlertTriangle, CheckCircle, Zap, TrendingUp,
  Activity, ExternalLink, Copy, Check,
} from 'lucide-react';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';
import { developerStatsService } from '@/services/developer';
import type { DeveloperDashboardStats } from '@/types/developer';
import { toast } from 'sonner';

// ── Fade-up animation variant ─────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0 },
};

// ── Stat card ─────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color = 'orange',
  delay = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: 'orange' | 'blue' | 'green' | 'purple';
  delay?: number;
}) {
  const colorMap = {
    orange: 'bg-orange-50 text-orange-600',
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay, duration: 0.35 }}
      className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </motion.div>
  );
}

// ── Quick action card ─────────────────────────────────────────
function QuickAction({
  label,
  description,
  icon: Icon,
  to,
  delay = 0,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  to: string;
  delay?: number;
}) {
  const navigate = useNavigate();
  return (
    <motion.button
      variants={fadeUp}
      initial="hidden"
      animate="show"
      transition={{ delay, duration: 0.35 }}
      onClick={() => navigate(to)}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-orange-200 transition-all duration-200 group"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500 transition-colors">
          <Icon className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition-colors flex-shrink-0 mt-0.5" />
      </div>
    </motion.button>
  );
}

// ── Base URL chip ─────────────────────────────────────────────
function BaseUrlChip() {
  const [copied, setCopied] = useState(false);
  const url = 'https://bahiqhpypapvktpxrths.supabase.co/functions/v1';

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Base URL copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
      <code className="text-xs text-gray-700 font-mono flex-1 truncate">{url}</code>
      <button
        onClick={copy}
        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-700"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ── Setup checklist item ──────────────────────────────────────
function ChecklistItem({
  done,
  label,
  action,
  onClick,
}: {
  done: boolean;
  label: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-green-500' : 'bg-gray-200'}`}>
        {done
          ? <Check className="w-3 h-3 text-white" />
          : <span className="w-2 h-2 rounded-full bg-white" />
        }
      </div>
      <span className={`text-sm flex-1 ${done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
        {label}
      </span>
      {!done && action && onClick && (
        <button
          onClick={onClick}
          className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors"
        >
          {action} →
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function DeveloperDashboardHome() {
  const navigate  = useNavigate();
  const { developer } = useDeveloperAuthStore();

  const [stats, setStats]       = useState<DeveloperDashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await developerStatsService.getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('[Dashboard] Stats load failed:', err);
      } finally {
        setStatsLoading(false);
      }
    }
    load();
  }, []);

  if (!developer) return null;

  const displayName = developer.account_type === 'company'
    ? developer.company_name ?? developer.full_name
    : developer.full_name;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // Days until plan expiry
  const daysLeft = developer.plan_expires_at
    ? Math.ceil((new Date(developer.plan_expires_at).getTime() - Date.now()) / 86_400_000)
    : null;

  // Setup checklist
  const checklist = [
    { done: developer.email_verified,        label: 'Verify your email address',           action: 'Verify',   onClick: () => navigate('/developer/verify-email') },
    { done: developer.paystack_connected,    label: 'Connect your Paystack account',       action: 'Connect',  onClick: () => navigate('/developer/onboarding') },
    { done: stats ? stats.active_imports > 0 || true : false,
      /* key count > 0 */                    label: 'Generate your first API key',         action: 'Create',   onClick: () => navigate('/developer/dashboard/api-keys') },
    { done: stats ? stats.active_imports > 0 : false,
                                             label: 'Import a product from the catalog',   action: 'Browse',   onClick: () => navigate('/developer/dashboard/catalog') },
    { done: stats ? stats.orders_this_month > 0 : false,
                                             label: 'Place your first order via the API',  action: 'View docs', onClick: () => navigate('/developer/dashboard/docs') },
  ];

  const completedSteps = checklist.filter((c) => c.done).length;
  const allDone = completedSteps === checklist.length;

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.3 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}, {displayName.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          {developer.platform_name} — {developer.plan.charAt(0).toUpperCase() + developer.plan.slice(1)} Plan
          {daysLeft !== null && daysLeft <= 7 && (
            <span className={`ml-2 font-medium ${daysLeft <= 2 ? 'text-red-500' : 'text-orange-500'}`}>
              · {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
            </span>
          )}
        </p>
      </motion.div>

      {/* ── Paystack warning banner ─────────────────────────── */}
      {!developer.paystack_connected && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mb-6 flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-4"
        >
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-yellow-800">Paystack account not connected</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              You need to connect Paystack before you can create orders through the API.
            </p>
          </div>
          <button
            onClick={() => navigate('/developer/onboarding')}
            className="text-xs font-semibold text-yellow-800 bg-yellow-200 hover:bg-yellow-300 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
          >
            Connect now
          </button>
        </motion.div>
      )}

      {/* ── Stats grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="API Calls Today"
          value={statsLoading ? '—' : (stats?.api_calls_today ?? 0).toLocaleString()}
          sub="Resets at midnight"
          icon={Activity}
          color="orange"
          delay={0.1}
        />
        <StatCard
          label="Active Imports"
          value={statsLoading ? '—' : (stats?.active_imports ?? 0).toLocaleString()}
          sub="Products in your catalog"
          icon={Package}
          color="blue"
          delay={0.15}
        />
        <StatCard
          label="Orders This Month"
          value={statsLoading ? '—' : (stats?.orders_this_month ?? 0).toLocaleString()}
          sub="Via API"
          icon={ClipboardList}
          color="green"
          delay={0.2}
        />
        <StatCard
          label="Wallet Balance"
          value={statsLoading ? '—' : `₦${(stats?.wallet_balance ?? 0).toLocaleString()}`}
          sub="Available to withdraw"
          icon={Wallet}
          color="purple"
          delay={0.25}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left column ──────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Quick actions */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <h2 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">Quick actions</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <QuickAction
                label="Browse Product Catalog"
                description="Find importable products from QAFRICA stores."
                icon={Package}
                to="/developer/dashboard/catalog"
                delay={0.32}
              />
              <QuickAction
                label="Manage API Keys"
                description="Generate, view, and revoke your API keys."
                icon={Key}
                to="/developer/dashboard/api-keys"
                delay={0.34}
              />
              <QuickAction
                label="View Orders"
                description="Track all orders placed through your integration."
                icon={ClipboardList}
                to="/developer/dashboard/orders"
                delay={0.36}
              />
              <QuickAction
                label="Configure Webhooks"
                description="Set up event notifications for your platform."
                icon={Zap}
                to="/developer/dashboard/webhooks"
                delay={0.38}
              />
            </div>
          </motion.div>

          {/* API base URL */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.4, duration: 0.35 }}
            className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">API Base URL</h2>
              <a
                href="/developer/dashboard/docs"
                className="text-xs text-orange-600 font-medium hover:underline flex items-center gap-1"
              >
                Full docs <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <BaseUrlChip />
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-mono text-orange-600 font-medium">GET</span>
                <span className="ml-2">/api-products</span>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-mono text-blue-600 font-medium">POST</span>
                <span className="ml-2">/api-orders</span>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-mono text-green-600 font-medium">POST</span>
                <span className="ml-2">/api-imports</span>
              </div>
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-mono text-purple-600 font-medium">GET</span>
                <span className="ml-2">/api-delivery/zones/:id</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Right column ─────────────────────────────────── */}
        <div className="space-y-6">

          {/* Setup checklist */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.42, duration: 0.35 }}
            className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-gray-900">Setup checklist</h2>
              <span className="text-xs font-medium text-gray-500">
                {completedSteps}/{checklist.length}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(completedSteps / checklist.length) * 100}%` }}
                transition={{ delay: 0.6, duration: 0.6, ease: 'easeOut' }}
                className="h-full bg-orange-500 rounded-full"
              />
            </div>

            {allDone ? (
              <div className="flex items-center gap-2 py-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <p className="text-sm font-medium text-green-700">All set! You're ready to integrate.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {checklist.map((item, i) => (
                  <ChecklistItem key={i} {...item} />
                ))}
              </div>
            )}
          </motion.div>

          {/* Plan info */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.48, duration: 0.35 }}
            className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Current plan</h2>
              <button
                onClick={() => navigate('/developer/dashboard/subscription')}
                className="text-xs text-orange-600 font-medium hover:underline"
              >
                Manage
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Plan</span>
                <span className="font-semibold text-gray-900 capitalize">{developer.plan}</span>
              </div>
              {daysLeft !== null && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Expires</span>
                  <span className={`font-semibold ${daysLeft <= 3 ? 'text-red-500' : 'text-gray-900'}`}>
                    {daysLeft === 0 ? 'Today' : `${daysLeft} days`}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Rate limit</span>
                <span className="font-semibold text-gray-900">
                  {developer.plan === 'free' ? '20' :
                   developer.plan === 'starter' ? '60' :
                   developer.plan === 'growth' ? '150' : '500'} req/min
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Paystack</span>
                <span className={`font-semibold flex items-center gap-1 ${developer.paystack_connected ? 'text-green-600' : 'text-yellow-600'}`}>
                  {developer.paystack_connected
                    ? <><Check className="w-3.5 h-3.5" /> Connected</>
                    : <><AlertTriangle className="w-3.5 h-3.5" /> Not connected</>
                  }
                </span>
              </div>
            </div>

            {developer.plan === 'free' && (
              <button
                onClick={() => navigate('/developer/dashboard/subscription')}
                className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                Upgrade to Starter
              </button>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
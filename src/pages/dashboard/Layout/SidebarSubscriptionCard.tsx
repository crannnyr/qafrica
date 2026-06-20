// src/pages/dashboard/Layout/SidebarSubscriptionCard.tsx

import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  isSidebarOpen: boolean;
  subscription: { tier: string; daysLeft: number } | null;
}

export default function SidebarSubscriptionCard({
  isSidebarOpen,
  subscription,
}: Props) {
  // ── Collapsed: just crown icon ─────────────────────────────────────────────
  if (!isSidebarOpen) {
    return (
      <div className="hidden lg:flex px-2 pb-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 justify-center">
        <Link to="/dashboard/subscription" title="Subscription">
          <div className="w-9 h-9 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
            <Crown className="w-4 h-4 text-white" />
          </div>
        </Link>
      </div>
    );
  }

  // ── Expanded: full plan card ───────────────────────────────────────────────
  return (
    <div className="px-3 pb-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-3 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Crown className="w-4 h-4" />
          <span className="font-semibold text-sm capitalize">
            {subscription?.tier || 'Free'} Plan
          </span>
        </div>
        <p className="text-xs text-orange-100 mb-2.5">
          {subscription
            ? `Expires in ${subscription.daysLeft} days`
            : 'Upgrade for more features'}
        </p>
        <Link to="/dashboard/subscription">
          <Button
            size="sm"
            variant="secondary"
            className="w-full bg-white text-orange-600 hover:bg-orange-50 h-7 text-xs"
          >
            Manage
          </Button>
        </Link>
      </div>
    </div>
  );
}
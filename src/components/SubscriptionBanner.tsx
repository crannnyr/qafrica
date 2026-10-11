import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

export default function SubscriptionBanner() {
  const { isExpired, isExpiringSoon, daysRemaining, loading, subscription } = useSubscriptionStatus();
  const [dismissed, setDismissed] = useState(false);
  const { user } = useAuthStore();
  const noticeType = 'expiring';
  const storageKey = user?.id ? `qafrica-subscription-banner:${user.id}:${new Date().toISOString().slice(0, 10)}` : null;

  useEffect(() => {
    setDismissed(false);
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      setDismissed(stored === noticeType);
    } catch {
      setDismissed(false);
    }
  }, [storageKey, noticeType]);

  const dismissForToday = () => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, noticeType); } catch { /* storage may be disabled */ }
    }
    setDismissed(true);
  };

  if (loading || !user?.id || !subscription || dismissed) return null;

  // This banner is a reminder only: show it once per day during the final
  // three days before expiry. Expired plans are handled on the Subscription page.
  if (isExpired || !isExpiringSoon || daysRemaining > 3) return null;

  // Expiring soon (3 days or less)
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-orange-50 border-b border-orange-200 px-4 py-3"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-orange-900">
              Your plan expires {daysRemaining === 1 ? 'tomorrow' : `in ${daysRemaining} days`}
            </h3>
            <p className="text-sm text-orange-700">
              Renew within the next 3 days to keep your store active.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard/subscription">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              Upgrade Now
            </Button>
          </Link>
          <Button aria-label="Dismiss subscription notice for today" variant="ghost" size="icon" onClick={dismissForToday} className="text-orange-700 hover:bg-orange-100">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
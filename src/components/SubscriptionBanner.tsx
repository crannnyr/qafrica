import { motion } from 'framer-motion';
import { AlertTriangle, Clock, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

export default function SubscriptionBanner() {
  const { isExpired, isExpiringSoon, daysRemaining, loading } = useSubscriptionStatus();

  if (loading) return null;

  // Don't show if subscription is active and not expiring soon
  if (!isExpired && !isExpiringSoon) return null;

  if (isExpired) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-red-50 border-b border-red-200 px-4 py-3"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900">Your plan has expired</h3>
              <p className="text-sm text-red-700">
                Renew now to keep your store active and avoid losing access to your products.
              </p>
            </div>
          </div>
          <Link to="/dashboard/subscription">
            <Button className="bg-red-600 hover:bg-red-700 text-white">
              Renew Subscription
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

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
              Your {daysRemaining === 1 ? 'free plan expires' : `free plan expires in ${daysRemaining} days`}
            </h3>
            <p className="text-sm text-orange-700">
              Upgrade now to avoid interruption and keep selling.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/subscription">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              Upgrade Now
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
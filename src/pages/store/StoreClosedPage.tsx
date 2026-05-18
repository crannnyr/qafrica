import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Store, ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StoreClosedPageProps {
  storeName?: string;
  reason?: 'expired' | 'suspended' | 'payment_overdue';
}

export default function StoreClosedPage({ storeName, reason = 'expired' }: StoreClosedPageProps) {
  const messages = {
    expired: {
      title: 'Store Temporarily Closed',
      message: 'This store subscription has expired. The owner needs to renew their subscription to reopen.',
      icon: Clock,
    },
    suspended: {
      title: 'Store Suspended',
      message: 'This store has been temporarily suspended. Please check back later.',
      icon: Store,
    },
    payment_overdue: {
      title: 'Store Unavailable',
      message: 'This store is currently unavailable due to an overdue payment.',
      icon: Clock,
    },
  };

  const { title, message, icon: Icon } = messages[reason];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 md:p-12">
          {/* Icon */}
          <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon className="w-12 h-12 text-orange-500" />
          </div>

          {/* Content */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {title}
          </h1>
          
          {storeName && (
            <p className="text-lg text-orange-600 dark:text-orange-400 font-medium mb-4">
              {storeName}
            </p>
          )}

          <p className="text-gray-600 dark:text-gray-400 mb-8">
            {message}
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <Link to="/">
              <Button className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Browse Other Stores
              </Button>
            </Link>

            <a 
              href="mailto:support@qafrica.store"
              className="flex items-center justify-center gap-2 w-full h-12 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Mail className="w-5 h-5" />
              Contact Support
            </a>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Are you the store owner?{' '}
              <Link to="/login" className="text-orange-500 hover:text-orange-600 font-medium">
                Log in to renew
              </Link>
            </p>
          </div>
        </div>

        {/* Powered by */}
        <p className="mt-6 text-sm text-gray-400">
          Powered by <span className="font-semibold text-orange-500">QAFRICA</span>
        </p>
      </motion.div>
    </div>
  );
}

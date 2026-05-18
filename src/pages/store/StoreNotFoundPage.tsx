import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Store, ArrowLeft, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StoreNotFoundPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 md:p-12">
          {/* 404 Display */}
          <div className="relative mb-8">
            <div className="text-8xl font-bold text-gray-100 dark:text-gray-700">404</div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <Search className="w-12 h-12 text-orange-500" />
              </div>
            </div>
          </div>

          {/* Content */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Store Not Found
          </h1>

          <p className="text-gray-600 dark:text-gray-400 mb-2">
            We couldn't find the store you're looking for.
          </p>
          
          <p className="text-gray-500 dark:text-gray-500 text-sm mb-8">
            The store may have been removed, renamed, or the URL might be incorrect.
          </p>

          {/* Possible Reasons */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-8 text-left">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              Possible reasons:
            </p>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                The store URL was typed incorrectly
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                The store has been permanently closed
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-2 flex-shrink-0" />
                The store has moved to a new address
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link to="/">
              <Button className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Browse All Stores
              </Button>
            </Link>

            <Link to="/signup">
              <Button 
                variant="outline" 
                className="w-full h-12 border-gray-200 dark:border-gray-600"
              >
                <Store className="w-5 h-5 mr-2" />
                Create Your Own Store
              </Button>
            </Link>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Looking for a specific store?
          </p>
          <a 
            href="mailto:support@qafrica.store"
            className="text-orange-500 hover:text-orange-600 font-medium text-sm"
          >
            Contact our support team
          </a>
        </div>

        {/* Powered by */}
        <p className="mt-6 text-sm text-gray-400">
          Powered by <span className="font-semibold text-orange-500">QAFRICA</span>
        </p>
      </motion.div>
    </div>
  );
}

// src/pages/dashboard/NicheCustomization/NicheInfoBox.tsx

import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

export default function NicheInfoBox() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-100 dark:border-orange-800 p-6"
    >
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-orange-900 dark:text-orange-300 mb-2">
            About Niche Management
          </h3>
          <ul className="space-y-2 text-sm text-orange-800 dark:text-orange-400">
            <li>• You can add niches up to your plan limit</li>
            <li>• Niches with products or sales cannot be removed</li>
            <li>• Each niche has specific categories for your products</li>
            <li>• Upgrade your plan to access more niches</li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
}
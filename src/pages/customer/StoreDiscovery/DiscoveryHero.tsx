// src/pages/customer/StoreDiscovery/DiscoveryHero.tsx

import { motion } from 'framer-motion';
import { Search } from 'lucide-react';

interface Props {
  searchQuery: string;
  onSearch: (value: string) => void;
}

export default function DiscoveryHero({ searchQuery, onSearch }: Props) {
  return (
    <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white py-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Discover Amazing Stores
          </h1>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            Browse hundreds of verified sellers across Nigeria.
            Find everything you need in one place.
          </p>

          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search stores..."
              className="w-full pl-12 pr-4 py-4 rounded-xl text-gray-900 focus:outline-none focus:ring-4 focus:ring-orange-300"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
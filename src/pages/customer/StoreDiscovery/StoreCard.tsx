// src/pages/customer/StoreDiscovery/StoreCard.tsx

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, ChevronRight } from 'lucide-react';
import type { StoreDisplay } from './constants';

interface Props {
  store: StoreDisplay;
  index: number;
}

export default function StoreCard({ store, index }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        to={`/${store.slug}`}
        className="block bg-white rounded-xl border hover:shadow-lg transition-shadow overflow-hidden group"
      >
        {/* Banner */}
        <div
          className="h-24 relative bg-cover bg-center"
          style={{
            backgroundImage: store.banner_url ? `url(${store.banner_url})` : 'none',
            backgroundColor: store.banner_url
              ? 'transparent'
              : (store.primary_color || '#F97316'),
          }}
        >
          {store.banner_url && (
            <div className="absolute inset-0 bg-black/20" />
          )}

          {/* Logo */}
          <div className="absolute -bottom-8 left-4">
            <div className="w-16 h-16 bg-white rounded-xl shadow-md flex items-center justify-center relative z-10">
              {store.logo_url ? (
                <img
                  src={store.logo_url}
                  alt={store.name}
                  className="w-12 h-12 object-contain"
                />
              ) : (
                <span
                  className="text-2xl font-bold"
                  style={{ color: store.primary_color || '#F97316' }}
                >
                  {store.name.charAt(0)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="pt-10 pb-4 px-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-lg group-hover:text-orange-600 transition-colors">
                {store.name}
              </h3>
              {store.is_verified && (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  <Star className="w-3 h-3 fill-current" />
                  Verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-4 h-4 text-yellow-400 fill-current" />
              <span className="font-medium">{store.rating || 4.5}</span>
            </div>
          </div>

          <p className="text-gray-500 text-sm line-clamp-2 mb-4">
            {store.description || 'No description available'}
          </p>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {store.product_count || 0} products
            </span>
            <span className="text-orange-600 font-medium flex items-center gap-1">
              Visit Store
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
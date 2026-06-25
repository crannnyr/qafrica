// src/pages/landing/Landing/NichesSection.tsx

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { niches } from './constants';

export default function NichesSection() {
  return (
    <section id="niches" className="py-20 lg:py-32 bg-orange-50 dark:bg-gray-900">
      <div className="container-custom">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1 bg-orange-200 text-orange-700 rounded-full text-sm font-medium mb-4">
            Niches
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Built for Your Industry
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Each niche comes with tailored themes, relevant features, and a
            curated product catalog ready to import.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {niches.map((niche, i) => (
            <motion.div
              key={niche.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="group p-6 bg-white dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-orange-300 hover:shadow-lg transition-all duration-300 cursor-pointer"
            >
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-orange-500 transition-colors">
                <ShoppingBag className="w-6 h-6 text-orange-500 group-hover:text-white transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                {niche.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {niche.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link to="/signup">
            <Button
              variant="outline"
              className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
            >
              Explore All Niches
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

      </div>
    </section>
  );
}
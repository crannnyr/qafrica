// src/pages/landing/Landing/FeaturesSection.tsx

import { motion } from 'framer-motion';
import { features } from './constants';

export default function FeaturesSection() {
  return (
    <section id="features" className="py-20 lg:py-32">
      <div className="container-custom">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1 bg-orange-100 text-orange-600 rounded-full text-sm font-medium mb-4">
            Features
          </span>
          <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Everything You Need to Sell Online
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Purpose-built tools for Nigerian entrepreneurs — from store setup
            to order fulfilment and payments.
          </p>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group p-8 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-orange-200 hover:shadow-xl transition-all duration-300"
            >
              <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mb-6 group-hover:bg-orange-500 transition-colors duration-300">
                <f.icon className="w-7 h-7 text-orange-500 group-hover:text-white transition-colors duration-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {f.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
// src/pages/landing/Landing/StatsSection.tsx

import { motion } from 'framer-motion';
import { stats } from './constants';

export default function StatsSection() {
  return (
    <section className="py-16 bg-gray-900">
      <div className="container-custom">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <p className="text-3xl lg:text-4xl font-bold text-orange-500 mb-2">
                {stat.value}
              </p>
              <p className="text-gray-400">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
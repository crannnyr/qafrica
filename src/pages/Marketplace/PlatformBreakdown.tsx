// src/pages/Marketplace/PlatformBreakdown.tsx

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const PLATFORMS = [
  {
    id:       'jumia',
    name:     'Jumia Nigeria',
    tagline:  "Africa's #1 marketplace",
    logo:     'J',
    logoStyle:'bg-gray-900 text-white',
    cardStyle:'border-orange-200 dark:border-orange-900',
    badgeStyle:'bg-orange-50 text-orange-700 border-orange-200',
    ctaStyle: 'bg-gray-900 hover:bg-gray-800 text-white',
    accentColor: '#F97316',
    stats: [
      { label: 'Monthly visitors',  value: '3M+'                      },
      { label: 'Top categories',    value: 'Electronics, Fashion, Beauty' },
      { label: 'Avg order value',   value: '₦12,000 – ₦45,000'        },
      { label: 'Platform fee',      value: '~12% commission'           },
      { label: 'QC strictness',     value: '🔴 Very strict'            },
    ],
  },
  {
    id:       'konga',
    name:     'Konga',
    tagline:  'Shop smarter, pay better',
    logo:     'K',
    logoStyle:'bg-pink-600 text-white',
    cardStyle:'border-pink-200 dark:border-pink-900',
    badgeStyle:'bg-pink-50 text-pink-700 border-pink-200',
    ctaStyle: 'bg-pink-600 hover:bg-pink-700 text-white',
    accentColor: '#E91E8C',
    stats: [
      { label: 'Monthly visitors',  value: '2M+'                         },
      { label: 'Top categories',    value: 'Home, Electronics, Beauty'   },
      { label: 'Avg order value',   value: '₦8,000 – ₦35,000'           },
      { label: 'Platform fee',      value: '~10% commission'             },
      { label: 'QC strictness',     value: '🟡 Moderate'                 },
    ],
  },
  {
    id:       'jiji',
    name:     'Jiji Nigeria',
    tagline:  'Buy & sell instantly',
    logo:     'Ji',
    logoStyle:'bg-green-600 text-white',
    cardStyle:'border-green-200 dark:border-green-900',
    badgeStyle:'bg-green-50 text-green-700 border-green-200',
    ctaStyle: 'bg-green-600 hover:bg-green-700 text-white',
    accentColor: '#00A651',
    stats: [
      { label: 'Monthly visitors',  value: '1.5M+'                    },
      { label: 'Top categories',    value: 'Fashion, Phones, Vehicles' },
      { label: 'Avg order value',   value: '₦5,000 – ₦25,000'         },
      { label: 'Platform fee',      value: 'Listing-based'             },
      { label: 'QC strictness',     value: '🟢 Flexible'               },
    ],
  },
];

export default function PlatformBreakdown() {
  return (
    <section className="py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <span className="inline-block bg-orange-100 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            Platform Breakdown
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
            Know your marketplaces
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg">
            Understand who you're selling to on each platform before you list.
            QAFRICA handles all three simultaneously.
          </p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLATFORMS.map((p, i) => (
            <motion.div
              key={p.id}
              id={p.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`bg-white dark:bg-gray-900 rounded-2xl border-2 ${p.cardStyle} p-6 flex flex-col`}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm ${p.logoStyle}`}>
                  {p.logo}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-400">{p.tagline}</p>
                </div>
                <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.badgeStyle}`}>
                  Live ✓
                </span>
              </div>

              {/* Stats */}
              <div className="flex-1 space-y-2.5 mb-5">
                {p.stats.map((stat, j) => (
                  <div
                    key={j}
                    className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 dark:border-gray-800 last:border-0"
                  >
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {stat.label}
                    </span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-white text-right">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link
                to="/signup"
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-colors ${p.ctaStyle}`}
              >
                Sell on {p.name.split(' ')[0]} via QAFRICA
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
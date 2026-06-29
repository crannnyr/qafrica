// src/pages/Marketplace/MarketplaceCtaBanner.tsx

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function MarketplaceCtaBanner() {
  return (
    <section className="py-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 rounded-3xl p-12 lg:p-16 overflow-hidden text-center">

          {/* Background blobs */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-16 -left-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-16 -right-16 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          </div>

          {/* Platform pills */}
          <div className="relative z-10 flex items-center justify-center gap-2 flex-wrap mb-6">
            {[
              { label: 'JUMIA',  style: 'bg-white/20 text-white border-white/30'         },
              { label: 'KONGA',  style: 'bg-white/20 text-white border-white/30'         },
              { label: 'JIJI',   style: 'bg-white/20 text-white border-white/30'         },
              { label: 'YOUR STORE', style: 'bg-white text-orange-600 border-white/50'   },
            ].map(p => (
              <span
                key={p.label}
                className={`px-3 py-1 rounded-full text-xs font-bold border ${p.style}`}
              >
                {p.label}
              </span>
            ))}
          </div>

          {/* Headline */}
          <h2 className="relative z-10 text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 tracking-tight">
            Ready to sell on Jumia,<br className="hidden sm:block"/> Konga & Jiji?
          </h2>

          <p className="relative z-10 text-sm text-orange-100 mb-8 max-w-md mx-auto leading-relaxed">
            One account. One upload. Four sales channels.
            Start your free trial — no credit card needed.
          </p>

          {/* Buttons */}
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 bg-white text-orange-600 hover:bg-orange-50 px-7 py-3 rounded-xl text-sm font-bold transition-colors shadow-lg"
            >
              Start Free Trial
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/importations"
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 px-7 py-3 rounded-xl text-sm font-semibold transition-colors"
            >
              Browse Import Catalog
            </Link>
          </div>

          {/* Trust line */}
          <p className="relative z-10 text-xs text-orange-200 mt-6">
            Free trial · No credit card · Cancel anytime
          </p>

        </div>
      </div>
    </section>
  );
}
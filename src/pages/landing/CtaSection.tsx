// src/pages/landing/Landing/CtaSection.tsx

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function CtaSection() {
  return (
    <section className="py-20 lg:py-32">
      <div className="container-custom">
        <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 rounded-3xl p-12 lg:p-20 overflow-hidden">

          {/* Background blobs */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          </div>

          {/* Content */}
          <div className="relative z-10 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Your Store. Your Customers. Your Revenue.
            </h2>
            <p className="text-lg text-orange-100 mb-8">
              Join Nigerian entrepreneurs already growing their business on QAFRICA.
              Start your free trial today — no credit card needed.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="bg-white text-orange-600 hover:bg-orange-50 px-8"
                >
                  Start Free Trial
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/stores">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white/10"
                >
                  Browse Stores
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
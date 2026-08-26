// src/pages/recommendations/LogisticsBlogPage.tsx
// "How does logistics work?" — explains why shipping cost isn't shown
// upfront (order pooling), and introduces GIG Logistics as the delivery
// partner handling door-to-door delivery nationwide.
// Route: /recommendations/logistics
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, X, ShoppingBag, Users2, Truck, MapPinned } from 'lucide-react';
import { useImportPwaManifest } from '@/hooks/useImportPwaManifest';

const GALLERY_IMAGES = [
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.8566548358244728.webp',
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.42678237174556055.webp',
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.09752996319874485.webp',
];

const STEPS = [
  {
    icon: ShoppingBag,
    title: 'You order — even just one item',
    body: 'No minimum. Order a single item and it still qualifies for our shipping rates, same as everyone else.',
  },
  {
    icon: Users2,
    title: 'We group it with other orders',
    body: 'Every order placed around the same time gets pooled together into one shipment, instead of shipping alone.',
  },
  {
    icon: Truck,
    title: 'One shipment, split cost',
    body: "A shipping and clearance fee that would cost a lone order a lot gets divided across everyone in the group — often down to a few hundred naira each.",
  },
  {
    icon: MapPinned,
    title: 'Delivered to your door',
    body: 'Once it lands in Nigeria, our delivery partner takes it the rest of the way — straight to your address, anywhere in the country.',
  },
];

export default function LogisticsBlogPage() {
  useImportPwaManifest();
  const navigate = useNavigate();
  const [zoomedSrc, setZoomedSrc] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Signature: a dashed delivery route arcing behind the headline */}
        <svg
          className="absolute -top-6 right-[-40px] w-64 h-64 lg:w-80 lg:h-80 text-orange-100 pointer-events-none"
          viewBox="0 0 200 200" fill="none"
        >
          <path d="M10 150 Q 70 30 100 100 T 190 40" stroke="currentColor" strokeWidth="3" strokeDasharray="6 8" strokeLinecap="round" />
          <circle cx="190" cy="40" r="6" fill="currentColor" />
        </svg>

        <div className="relative max-w-2xl lg:max-w-4xl mx-auto px-4 pt-10 pb-8 lg:pt-16 lg:pb-12">
          <p className="text-[11px] font-bold text-orange-500 uppercase tracking-widest mb-3">Shipping &amp; logistics</p>
          <h1 className="text-3xl lg:text-5xl font-black text-gray-900 leading-[1.1] mb-4 max-w-xl">
            We deliver to your door — in every state in Nigeria.
          </h1>
          <p className="text-gray-500 text-sm lg:text-base leading-relaxed max-w-lg">
            No pickup points, no "closest terminal." We work with a trusted logistics partner to take
            your order the full distance, from the moment it lands in the country to the moment it's
            in your hands.
          </p>
        </div>
      </section>

      {/* How the cost-splitting works */}
      <section className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-8 lg:py-10">
        <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-1">Why shipping isn't a fixed price</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-lg">
          Shipping and customs clearance cost roughly the same whether one person orders or a hundred
          do. So instead of charging every single order a full share of that cost, we combine orders
          and split it — the more people in a shipment, the smaller everyone's piece.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {STEPS.map((step) => (
            <div key={step.title} className="bg-gray-50 rounded-2xl p-4 lg:p-5">
              <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center mb-3">
                <step.icon className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-sm font-bold text-gray-900 mb-1 leading-snug">{step.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3.5">
          <p className="text-xs text-orange-800 leading-relaxed">
            That's why a single item can sometimes ship for as low as a few hundred naira — you're
            never paying for a truck or a customs clearance alone.
          </p>
        </div>
      </section>

      {/* Delivery partner */}
      <section className="max-w-2xl lg:max-w-4xl mx-auto px-4 py-8 lg:py-10 border-t border-gray-50">
        <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-1">Who gets it to your door</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-lg leading-relaxed">
          Once your order clears into Nigeria, it's handed to <strong className="text-gray-700">GIG Logistics</strong>,
          one of Nigeria's largest courier and logistics networks, to complete the final leg. They run
          fleets and pickup/delivery operations across Nigerian cities and several other African
          countries, and they're who physically brings your package to your address — no need to
          collect it from a station or agent.
        </p>

        {/* Gallery — click to zoom */}
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          {GALLERY_IMAGES.map((src, i) => (
            <button
              key={src}
              onClick={() => setZoomedSrc(src)}
              className="aspect-square rounded-xl lg:rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 group relative"
            >
              <img src={src} alt={`GIG Logistics ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-300 mt-2">Tap an image to zoom</p>
      </section>

      {/* Footer CTA */}
      <section className="max-w-2xl lg:max-w-4xl mx-auto px-4 pb-12">
        <div className="bg-gray-900 rounded-2xl px-5 py-6 lg:px-8 lg:py-8 text-center">
          <p className="text-white font-bold text-base lg:text-lg mb-1">Still have a question?</p>
          <p className="text-gray-400 text-xs lg:text-sm mb-4">Ask us right from any product page — we're always happy to help.</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-colors"
          >
            Back to shopping
          </button>
        </div>
      </section>

      {/* Zoom lightbox */}
      <AnimatePresence>
        {zoomedSrc && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setZoomedSrc(null)}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          >
            <button
              onClick={() => setZoomedSrc(null)}
              aria-label="Close"
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <motion.img
              initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
              src={zoomedSrc} alt="" onClick={e => e.stopPropagation()}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { X, Truck, Globe, Package, Clock } from 'lucide-react';

const COMING_FEATURES = [
  {
    icon: Globe,
    title: 'International Shipping',
    desc: 'Ship beyond Nigeria to Ghana, Kenya, UK, US and more.',
  },
  {
    icon: Truck,
    title: 'Multiple Carriers',
    desc: 'DHL, GIG Logistics, Kwik, Sendbox and more — all in one place.',
  },
  {
    icon: Package,
    title: 'Doorstep Pickup',
    desc: 'Couriers come to your location, pick up and deliver directly.',
  },
  {
    icon: Clock,
    title: 'Live Tracking',
    desc: 'Customers get real-time tracking updates on every order.',
  },
];

export function ComingSoonModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-orange-500 to-orange-600 p-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
            <Truck className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold">Advanced Delivery — Coming Soon</h2>
          <p className="text-sm text-orange-100 mt-1">
            We're building something much bigger than local delivery.
          </p>
        </div>

        {/* Features */}
        <div className="p-5 space-y-4">
          {COMING_FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <div className="p-3 bg-orange-50 border border-orange-100 rounded-xl">
            <p className="text-xs text-orange-700 text-center">
              You'll be notified as soon as this feature is available for your store.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full mt-3 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
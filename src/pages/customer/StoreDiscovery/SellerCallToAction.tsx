// src/pages/customer/StoreDiscovery/SellerCallToAction.tsx

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function SellerCallToAction() {
  return (
    <div className="mt-16 bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-white text-center">
      <h2 className="text-2xl font-bold mb-2">Have products to sell?</h2>
      <p className="text-gray-300 mb-6 max-w-lg mx-auto">
        Join thousands of sellers on QAfrica and reach millions
        of customers across Nigeria.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link to="/signup">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8">
            Start Selling
          </Button>
        </Link>
        <Link to="/pricing">
          <Button
            variant="outline"
            className="border-white text-white hover:bg-white/10"
          >
            View Pricing
          </Button>
        </Link>
      </div>
    </div>
  );
}
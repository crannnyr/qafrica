// src/components/storefront/MarketplaceReturnBar.tsx
// Thin strip shown above a seller's store when the shopper arrived from the
// marketplace (/stores). One tap returns them to the exact spot they left.

import { ArrowLeft } from 'lucide-react';
import { useSmartBack } from '@/lib/navigation';

export default function MarketplaceReturnBar({ fallback }: { fallback: string }) {
  const { goBack, fromMarketplace } = useSmartBack(fallback);
  if (!fromMarketplace) return null;
  return (
    <div className="bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-9 flex items-center">
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white/90 hover:text-white focus-visible:outline-none focus-visible:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to QAFRICA Marketplace
        </button>
      </div>
    </div>
  );
}

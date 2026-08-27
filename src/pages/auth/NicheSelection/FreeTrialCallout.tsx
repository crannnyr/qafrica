// src/pages/auth/NicheSelection/FreeTrialCallout.tsx

import { Sparkles } from 'lucide-react';

export default function FreeTrialCallout() {
  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-8">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h4 className="font-semibold text-orange-900 mb-1">Starter Pack — ₦5,000 / 3 months</h4>
          <p className="text-sm text-orange-700">
            Every store starts with 1 niche on the Starter Pack.
            Upgrade anytime to access more niches and features.
          </p>
        </div>
      </div>
    </div>
  );
}
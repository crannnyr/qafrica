// src/pages/auth/Pricing/PricingSummary.tsx

import { ArrowRight, Loader2, Clock, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { durations } from './constants';

interface Props {
  selectedPlanName: string | undefined;
  selectedDuration: number;
  selectedNiches: string[];
  currentPrice: number;
  billingType: 'monthly' | 'lifetime';
  isLoading: boolean;
  isSkipLoading: boolean;
  onSubscribe: () => void;
  onContinueWithFree: () => void;
  onBack: () => void;
}

export default function PricingSummary({
  selectedPlanName,
  selectedDuration,
  selectedNiches,
  currentPrice,
  billingType,
  isLoading,
  isSkipLoading,
  onSubscribe,
  onContinueWithFree,
  onBack,
}: Props) {
  const durationLabel = durations.find((d) => d.value === selectedDuration)?.label;

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 max-w-2xl mx-auto">
        {/* Summary */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-gray-500 mb-1 text-sm">Your Selection</p>
            <p className="text-lg font-bold text-gray-900">
              {selectedPlanName}
              {billingType === 'monthly' && ` • ${durationLabel}`}
            </p>
            <p className="text-sm text-gray-500">
              {selectedNiches.length} niche{selectedNiches.length !== 1 ? 's' : ''} selected
            </p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-3xl font-bold text-orange-600">
              ₦{currentPrice.toLocaleString()}
            </p>
            <p className="text-sm text-gray-500">
              {billingType === 'lifetime' ? 'One-time payment' : 'Total amount'}
            </p>
          </div>
        </div>

        {/* CTAs */}
        <div className="mt-6 pt-6 border-t space-y-3">
          <Button
            onClick={onSubscribe}
            disabled={isLoading}
            className={`w-full h-14 text-lg font-semibold ${
              billingType === 'lifetime'
                ? 'bg-purple-500 hover:bg-purple-600 text-white'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                {billingType === 'lifetime' ? 'Purchase Lifetime Access' : 'Proceed to Payment'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>

          {/* Free trial skip */}
          <button
            onClick={onContinueWithFree}
            disabled={isSkipLoading}
            className="w-full py-3 text-gray-500 hover:text-gray-700 font-medium transition-colors flex items-center justify-center gap-2 border border-dashed border-gray-200 rounded-xl hover:border-orange-300"
          >
            {isSkipLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Clock className="w-4 h-4" />
                or Try Free for 4 Days Instead
              </>
            )}
          </button>

          <p className="text-center text-sm text-gray-400">
            Secure payment powered by Paystack
          </p>

          <div className="flex justify-center">
            <a
              href="https://wa.me/447404707531"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1.5 underline underline-offset-2"
            >
              <MessageCircle className="w-4 h-4" />
              Having trouble with payment? Chat with us on WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="text-center mt-8">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 font-medium">
          ← Back
        </button>
      </div>
    </>
  );
}

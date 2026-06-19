// src/pages/auth/NicheSelection/OnboardingProgress.tsx

import { Check } from 'lucide-react';

const STEPS = ['Account', 'Niche', 'Store', 'Plan'];

interface Props {
  step: number;
}

export default function OnboardingProgress({ step }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 mb-12">
      {STEPS.map((label, index) => {
        const stepNum = index + 1;
        const isComplete = step > stepNum;
        const isCurrent = step === stepNum;

        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                isComplete ? 'bg-green-500 text-white' :
                isCurrent  ? 'bg-orange-500 text-white' :
                              'bg-gray-200 text-gray-500'
              }`}>
                {isComplete ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${
                isComplete ? 'text-green-600' :
                isCurrent  ? 'text-orange-600' :
                              'text-gray-400'
              }`}>{label}</span>
            </div>

            {index < STEPS.length - 1 && (
              <div className={`w-8 sm:w-12 h-0.5 mx-2 ${
                step > stepNum ? 'bg-orange-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
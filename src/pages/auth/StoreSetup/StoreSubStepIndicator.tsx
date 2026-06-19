// src/pages/auth/StoreSetup/StoreSubStepIndicator.tsx

import { Check } from 'lucide-react';
import { SUB_STEPS } from './constants';

interface Props {
  subStep: number;
}

export default function StoreSubStepIndicator({ subStep }: Props) {
  return (
    <div className="flex items-center justify-center gap-4 mb-8">
      {SUB_STEPS.map((s, index) => (
        <div key={s.number} className="flex items-center">
          <div className={`flex items-center gap-2 ${
            subStep >= s.number ? 'text-orange-600' : 'text-gray-400'
          }`}>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
              subStep > s.number   ? 'bg-green-500 text-white'  :
              subStep === s.number ? 'bg-orange-500 text-white' :
                                      'bg-gray-200 text-gray-400'
            }`}>
              {subStep > s.number
                ? <Check className="w-4 h-4" />
                : <s.icon className="w-4 h-4" />}
            </div>
            <span className="hidden sm:block text-sm font-medium">{s.title}</span>
          </div>

          {index < SUB_STEPS.length - 1 && (
            <div className={`w-8 sm:w-12 h-0.5 mx-3 ${
              subStep > s.number ? 'bg-orange-500' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}
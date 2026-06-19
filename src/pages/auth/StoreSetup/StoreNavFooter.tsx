// src/pages/auth/StoreSetup/StoreNavFooter.tsx

import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  subStep: number;
  isSaving: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export default function StoreNavFooter({
  subStep,
  isSaving,
  onBack,
  onNext,
  onSubmit,
}: Props) {
  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
      <button
        onClick={onBack}
        disabled={isSaving}
        className="text-gray-500 hover:text-gray-700 font-medium"
      >
        ← Back
      </button>

      {subStep < 3 ? (
        <Button
          onClick={onNext}
          className="bg-orange-500 hover:bg-orange-600 text-white px-8 h-11"
        >
          Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      ) : (
        <Button
          onClick={onSubmit}
          disabled={isSaving}
          className="bg-orange-500 hover:bg-orange-600 text-white px-8 h-11"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Creating Store…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Create Store <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      )}
    </div>
  );
}
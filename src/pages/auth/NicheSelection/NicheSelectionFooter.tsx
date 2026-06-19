// src/pages/auth/NicheSelection/NicheSelectionFooter.tsx

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  isSaving: boolean;
  hasSelection: boolean;
  onBack: () => void;
  onContinue: () => void;
}

export default function NicheSelectionFooter({ isSaving, hasSelection, onBack, onContinue }: Props) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onBack}
        className="text-gray-500 hover:text-gray-700 font-medium"
      >
        ← Back
      </button>

      <Button
        onClick={onContinue}
        disabled={!hasSelection || isSaving}
        className="bg-orange-500 hover:bg-orange-600 text-white px-8 h-12"
      >
        {isSaving ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Saving…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Continue <ArrowRight className="w-5 h-5" />
          </span>
        )}
      </Button>
    </div>
  );
}
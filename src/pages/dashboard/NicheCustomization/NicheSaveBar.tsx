// src/pages/dashboard/NicheCustomization/NicheSaveBar.tsx

import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export default function NicheSaveBar({ isSaving, onSave, onDiscard }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          You have unsaved changes
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onDiscard}
            disabled={isSaving}
          >
            Discard
          </Button>

          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
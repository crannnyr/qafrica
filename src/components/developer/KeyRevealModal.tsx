// src/components/developer/KeyRevealModal.tsx
// Shows a newly-created API key exactly once.
// The modal cannot be closed until the user ticks the confirmation checkbox.
// Import this in DeveloperApiKeysPage (or anywhere keys are created).

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, Eye, EyeOff, Check, AlertTriangle, X } from 'lucide-react';
import { CopyButton } from './CopyButton';

interface KeyRevealModalProps {
  rawKey:  string;      // the full plaintext key — never stored again after this
  keyName: string;
  onClose: () => void;
}

export function KeyRevealModal({ rawKey, keyName, onClose }: KeyRevealModalProps) {
  const [revealed,   setRevealed]   = useState(false);
  const [confirmed,  setConfirmed]  = useState(false);

  const maskedKey = rawKey.slice(0, 20) + '•'.repeat(Math.max(0, rawKey.length - 20));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
              <Key className="w-4.5 h-4.5 text-green-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">API Key Created</h2>
              <p className="text-xs text-gray-500 truncate max-w-[200px]">{keyName}</p>
            </div>
          </div>
          <button
            onClick={confirmed ? onClose : undefined}
            disabled={!confirmed}
            title={confirmed ? 'Close' : 'Confirm you have saved the key first'}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600
              disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>This is shown only once.</strong>{' '}
              Copy it to your environment variables or a secrets manager now.
              We store a hash and cannot recover the original key.
            </p>
          </div>

          {/* Key display */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
              <span className="text-xs text-gray-500 font-mono">API Key</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setRevealed((r) => !r)}
                  className="p-1 rounded text-gray-500 hover:text-gray-300 transition-colors"
                  title={revealed ? 'Hide' : 'Show full key'}
                >
                  {revealed
                    ? <EyeOff className="w-3.5 h-3.5" />
                    : <Eye className="w-3.5 h-3.5" />
                  }
                </button>
                <CopyButton text={rawKey} size="sm" silent={false} />
              </div>
            </div>
            <div className="px-4 py-3.5">
              <code className="text-xs font-mono text-green-400 break-all leading-relaxed">
                {revealed ? rawKey : maskedKey}
              </code>
            </div>
          </div>

          {/* Quick integration hint */}
          <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-800">
              <span className="text-xs text-gray-500 font-mono">Usage</span>
            </div>
            <pre className="px-4 py-3 text-xs font-mono text-gray-300 overflow-x-auto">
{`Authorization: Bearer ${revealed ? rawKey : maskedKey}`}
            </pre>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-orange-500
                focus:ring-orange-500 cursor-pointer"
            />
            <span className="text-sm text-gray-700">
              I have copied and stored this key securely. I understand it will
              not be shown again.
            </span>
          </label>

          <button
            onClick={onClose}
            disabled={!confirmed}
            className="w-full h-11 bg-orange-500 hover:bg-orange-600
              disabled:opacity-40 disabled:cursor-not-allowed
              text-white font-semibold rounded-xl transition-colors text-sm
              flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Done — close this window
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default KeyRevealModal;
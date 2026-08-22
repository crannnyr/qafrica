// src/pages/recommendations/ManualPaymentFlow.tsx
// Shared manual bank-transfer flow: a fraud warning gate, then account
// details, then a self-reported "I have paid" step that only then reveals
// the community link. Used by:
//   - ImportCheckoutSheet.tsx (paying for an order)
//   - ImporterDashboardPage.tsx (paying a consolidation drop-off bill)
//
// Deliberately three separate steps (not one screen) so a customer can't
// screenshot the account number without also seeing the warning, and can't
// claim "I didn't see the warning" — each step requires an explicit tap.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Copy, Check, CheckCircle2, ArrowRight } from 'lucide-react';

// The one real destination for every manual transfer in the importation
// section. If this ever needs to change, update it here — every screen that
// shows bank details for a manual payment pulls from this component.
export const COMMUNITY_LINK = 'https://chat.whatsapp.com/H0e7sUP8sYV2r3dhjm4Cfa?s=cl&p=a&ilr=0';

interface BankDetails {
  bank_account_number: string;
  bank_account_name: string;
  bank_name: string;
}

interface Props {
  amountLabel: string;      // e.g. "₦12,000" — shown for context, not required
  bank: BankDetails;
  onConfirmPaid: () => Promise<void> | void; // called when they tap "I have paid"
  onClose: () => void;
  dashboardHref?: string;   // if provided, shows a "Go to My Dashboard" button on the final screen
}

type Step = 'warning' | 'details' | 'confirming' | 'done';

export default function ManualPaymentFlow({ amountLabel, bank, onConfirmPaid, onClose, dashboardHref }: Props) {
  const [step, setStep] = useState<Step>('warning');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleCopy = () => {
    navigator.clipboard?.writeText(bank.bank_account_number).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleIHavePaid = async () => {
    setStep('confirming');
    setError('');
    try {
      await onConfirmPaid();
      setStep('done');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong. Please try again.');
      setStep('details');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center sm:p-4"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 26 }}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6"
      >
        <AnimatePresence mode="wait">
          {/* ── Step 1: fraud warning ─────────────────────────────────── */}
          {step === 'warning' && (
            <motion.div key="warning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg text-center mb-2">Before you see the account</h3>
              <p className="text-sm text-gray-600 text-center mb-1">
                You're about to make a bank transfer{amountLabel ? ` of ${amountLabel}` : ''}.
              </p>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mt-4 mb-5">
                <p className="text-xs text-red-700 leading-relaxed">
                  Initiating a fake or false transaction claim — saying you've paid when you haven't —
                  can lead to serious action against your account with us, including suspension.
                  Only tap "I have paid" once the transfer has actually gone through.
                </p>
              </div>
              <button
                onClick={() => setStep('details')}
                className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors mb-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="w-full py-2 text-xs text-gray-400 font-medium">Cancel</button>
            </motion.div>
          )}

          {/* ── Step 2: account details ──────────────────────────────── */}
          {step === 'details' && (
            <motion.div key="details" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h3 className="font-bold text-gray-900 text-lg mb-1">Transfer to this account</h3>
              {amountLabel && <p className="text-gray-400 text-xs mb-4">Amount: <span className="font-bold text-gray-700">{amountLabel}</span></p>}

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900 text-base tracking-wide">{bank.bank_account_number}</p>
                  <button onClick={handleCopy} className="flex items-center gap-1 text-[11px] font-semibold text-orange-600 bg-white px-2 py-1 rounded-lg border border-orange-100">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-gray-600">{bank.bank_name}</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mb-5">
                <p className="text-[11px] text-gray-400 mb-0.5">Account name</p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  You may see this reflect as either <span className="font-semibold text-gray-800">"{bank.bank_account_name}"</span> —
                  both are correct and belong to QAfrica. Don't worry if the name doesn't match ours exactly.
                </p>
              </div>

              {error && (
                <p className="text-red-500 text-xs font-medium bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>
              )}

              <button
                onClick={handleIHavePaid}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-colors mb-2"
              >
                I have paid
              </button>
              <button onClick={onClose} className="w-full py-2 text-xs text-gray-400 font-medium">Close</button>
            </motion.div>
          )}

          {/* ── Step 3: submitting ───────────────────────────────────── */}
          {step === 'confirming' && (
            <motion.div key="confirming" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-10 text-center">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto" />
            </motion.div>
          )}

          {/* ── Step 4: done — community link + dashboard ────────────── */}
          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="text-center mb-5">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">Thanks — we'll confirm shortly</h3>
                <p className="text-gray-400 text-xs">
                  We'll verify your transfer and update your status. This usually takes a little while, not instantly.
                </p>
              </div>

              <a
                href={COMMUNITY_LINK} target="_blank" rel="noopener noreferrer"
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors mb-2"
              >
                Join the QAFRICA community
              </a>

              {dashboardHref && (
                <Link
                  to={dashboardHref}
                  className="w-full py-3 border border-gray-200 text-gray-700 font-semibold text-sm rounded-xl flex items-center justify-center gap-2 mb-2"
                >
                  Go to My Dashboard
                </Link>
              )}

              <button onClick={onClose} className="w-full py-2 text-xs text-gray-400 font-medium">Close</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// src/pages/recommendations/ManualPaymentFlow.tsx
// Shared manual bank-transfer flow: a bank-selection gate (commercial banks
// only), a fraud warning gate, then account details, then a self-reported
// "I have paid" step that only then reveals the community link. Used by:
//   - ImportCheckoutSheet.tsx (paying for an order)
//   - ImporterDashboardPage.tsx (paying a consolidation drop-off bill)
//
// The bank-selection step is a hard gate: customers can only proceed to the
// manual transfer instructions if their own bank is a CBN-licensed
// commercial bank (see public.commercial_banks). Fintech/MFB customers
// (Moniepoint, Opay, Palmpay, Kuda, etc.) don't see their bank in the list
// and are pointed to Paystack instead — manual transfer is never shown to
// them.
//
// Deliberately separate steps (not one screen) so a customer can't
// screenshot the account number without also seeing the warning, and can't
// claim "I didn't see the warning" — each step requires an explicit tap.
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Copy, Check, Clock as Clock3, ArrowRight, Search, Landmark } from 'lucide-react';
import { supabase } from '@/services';

// The one real destination for every manual transfer in the importation
// section. If this ever needs to change, update it here — every screen that
// shows bank details for a manual payment pulls from this component.
export const COMMUNITY_LINK = 'https://chat.whatsapp.com/DggRK0IeD94F0vyszfhfPW';

interface BankDetails {
  bank_account_number: string;
  bank_account_name: string;
  bank_name: string;
}

interface CommercialBank {
  id: string;
  name: string;
}

interface SenderInfo {
  senderBankName: string; // the commercial bank the customer selected
  senderName: string;     // the name on the customer's own account
}

interface Props {
  amountLabel: string;      // e.g. "₦12,000" — shown for context, not required
  bank: BankDetails;
  // called when they tap "I have paid" — receives the sender's declared bank
  // and account name so it can be stored (e.g. in admin_note / metadata) for
  // reconciliation against the actual incoming transfer.
  onConfirmPaid: (sender: SenderInfo) => Promise<void> | void;
  onClose: () => void;
  onUsePaystackInstead?: () => void; // called when their bank isn't a commercial bank
  dashboardHref?: string;   // if provided, shows a "Go to My Dashboard" button on the final screen
}

type Step = 'selectBank' | 'warning' | 'details' | 'confirming' | 'done';

export default function ManualPaymentFlow({
  amountLabel,
  bank,
  onConfirmPaid,
  onClose,
  onUsePaystackInstead,
  dashboardHref,
}: Props) {
  const [step, setStep] = useState<Step>('selectBank');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // ── Bank selection state ────────────────────────────────────────────
  const [banks, setBanks] = useState<CommercialBank[]>([]);
  const [banksLoading, setBanksLoading] = useState(true);
  const [banksError, setBanksError] = useState('');
  const [query, setQuery] = useState('');
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBanksLoading(true);
      setBanksError('');
      const { data, error } = await supabase
        .from('commercial_banks')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (error) {
        setBanksError('Could not load the bank list. Please try again.');
      } else {
        setBanks(data ?? []);
      }
      setBanksLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredBanks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => b.name.toLowerCase().includes(q));
  }, [banks, query]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(bank.bank_account_number).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const selectedBankName = banks.find((b) => b.id === selectedBankId)?.name ?? '';

  const handleIHavePaid = async () => {
    setStep('confirming');
    setError('');
    try {
      await onConfirmPaid({ senderBankName: selectedBankName, senderName: senderName.trim() });
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
          {/* ── Step 0: select your bank (commercial banks only) ─────── */}
          {step === 'selectBank' && (
            <motion.div key="selectBank" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Landmark className="w-6 h-6 text-gray-700" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg text-center mb-1">Which bank are you paying from?</h3>
              <p className="text-xs text-gray-400 text-center mb-3">
                Manual transfer is only available from these banks. If yours isn't listed, use Paystack instead.
              </p>

              <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
                <p className="text-[11px] text-red-700 leading-relaxed font-medium">
                  Transfers sent from any bank not on this list will be rejected and are not refundable.
                  Make sure you send from the exact bank you select below.
                </p>
              </div>

              <div className="relative mb-3">
                <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your bank"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50 mb-3">
                {banksLoading && (
                  <div className="py-6 text-center text-xs text-gray-400">Loading banks…</div>
                )}
                {!banksLoading && banksError && (
                  <div className="py-6 text-center text-xs text-red-500">{banksError}</div>
                )}
                {!banksLoading && !banksError && filteredBanks.length === 0 && (
                  <div className="py-6 text-center text-xs text-gray-400">No matching bank found.</div>
                )}
                {!banksLoading && !banksError && filteredBanks.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBankId(b.id)}
                    className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                      selectedBankId === b.id ? 'bg-gray-900 text-white font-semibold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <label className="text-[11px] text-gray-400 mb-1 block">
                  Name on your account (the sender name)
                </label>
                <input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Chinedu Okafor"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  This must match the name on the account you're transferring from.
                </p>
                <p className="text-[10px] text-amber-600 mt-1 font-medium">
                  ⚠️ An incorrect or false sender name may delay verification by our team.
                </p>
              </div>

              <button
                onClick={() => setStep('warning')}
                disabled={!selectedBankId || !senderName.trim()}
                className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors mb-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>

              {onUsePaystackInstead && (
                <button
                  onClick={onUsePaystackInstead}
                  className="w-full py-2 text-xs text-orange-600 font-semibold mb-1"
                >
                  Don't see your bank? Pay with Paystack instead
                </button>
              )}
              <button onClick={onClose} className="w-full py-2 text-xs text-gray-400 font-medium">Cancel</button>
            </motion.div>
          )}

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

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 mt-3 text-xs text-gray-600 flex items-center justify-between">
                <span>Sending from <span className="font-semibold text-gray-800">{selectedBankName}</span> as <span className="font-semibold text-gray-800">{senderName.trim()}</span></span>
                <button onClick={() => setStep('selectBank')} className="text-orange-600 font-semibold shrink-0 ml-2">Edit</button>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mt-3 mb-5">
                <p className="text-xs text-red-700 leading-relaxed">
                  Transfers from any bank other than the one you selected will be rejected and are not
                  refundable. Initiating a fake or false transaction claim — saying you've paid when you
                  haven't — can also lead to serious action against your account with us, including
                  suspension. Only tap "I have paid" once the transfer has actually gone through. An
                  incorrect or false sender name will delay our team verifying your payment.
                </p>
              </div>
              <button
                onClick={() => setStep('details')}
                className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-colors mb-2"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
              <button onClick={() => setStep('selectBank')} className="w-full py-2 text-xs text-gray-400 font-medium">Back</button>
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
                <p className="text-sm font-semibold text-gray-800">{bank.bank_account_name}</p>
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
                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock3 className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-1">Submitted — awaiting confirmation</h3>
                <p className="text-gray-400 text-xs">
                  We haven't verified your transfer yet. An admin will check and confirm it —
                  this usually takes a little while, not instantly.
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

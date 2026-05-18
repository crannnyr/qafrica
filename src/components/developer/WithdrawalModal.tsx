// src/components/developer/WithdrawalModal.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Wallet, Check, AlertTriangle } from 'lucide-react';
import { developerWalletService } from '@/services/developer';
import { useDeveloperAuthStore }  from '@/stores/developerAuthStore';
import type { WithdrawalFormData } from '@/types/developer';
import { toast } from 'sonner';

interface WithdrawalModalProps {
  walletBalance: number;
  onClose:       () => void;
  onSuccess:     () => void;  // call to re-fetch wallet after submission
}

function InputField({
  label, name, type = 'text', value, onChange,
  placeholder, hint, error, required,
}: {
  label: string; name: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  hint?: string; error?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-orange-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full h-11 px-4 rounded-xl border text-sm text-gray-900
          placeholder-gray-400 focus:outline-none focus:ring-2
          focus:ring-orange-500/20 focus:border-orange-500 transition-colors bg-white
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
      />
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

const MIN_WITHDRAWAL = 1000;

export function WithdrawalModal({
  walletBalance,
  onClose,
  onSuccess,
}: WithdrawalModalProps) {
  const { developer } = useDeveloperAuthStore();

  const [form, setForm] = useState({
    amount:         '',
    bank_name:      '',
    account_number: '',
    account_name:   '',
  });
  const [errors,     setErrors]     = useState<Record<string, string>>({});
  const [isLoading,  setIsLoading]  = useState(false);
  const [submitted,  setSubmitted]  = useState(false);

  function setField(key: string) {
    return (val: string) => {
      setForm((f) => ({ ...f, [key]: val }));
      setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
    };
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const amount = parseFloat(form.amount);

    if (!form.amount || isNaN(amount) || amount <= 0) {
      errs.amount = 'Enter a valid withdrawal amount.';
    } else if (amount < MIN_WITHDRAWAL) {
      errs.amount = `Minimum withdrawal is ₦${MIN_WITHDRAWAL.toLocaleString()}.`;
    } else if (amount > walletBalance) {
      errs.amount = `Insufficient balance. Available: ₦${walletBalance.toLocaleString()}.`;
    }

    if (!form.bank_name.trim())      errs.bank_name      = 'Bank name is required.';
    if (!form.account_number.trim()) errs.account_number = 'Account number is required.';
    else if (!/^\d{10}$/.test(form.account_number.trim())) {
      errs.account_number = 'Account number must be exactly 10 digits.';
    }
    if (!form.account_name.trim())   errs.account_name   = 'Account name is required.';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const payload: WithdrawalFormData = {
        amount:         parseFloat(form.amount),
        bank_name:      form.bank_name.trim(),
        account_number: form.account_number.trim(),
        account_name:   form.account_name.trim(),
      };

      await developerWalletService.requestWithdrawal(payload);
      setSubmitted(true);
      onSuccess();
    } catch (err: any) {
      const msg = err?.message ?? 'Withdrawal request failed. Please try again.';
      if (msg.includes('Insufficient') || msg.includes('balance')) {
        setErrors({ amount: msg });
      } else {
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }

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
            <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center">
              <Wallet className="w-4.5 h-4.5 text-orange-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Request Withdrawal</h2>
              <p className="text-xs text-gray-500">
                Available: <span className="font-semibold text-gray-800">₦{walletBalance.toLocaleString()}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          // Success state
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-green-500" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Request submitted</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Your withdrawal of <strong>₦{parseFloat(form.amount).toLocaleString()}</strong> has
              been submitted. Processing takes 2–3 business days.
            </p>
            <button
              onClick={onClose}
              className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white
                font-semibold rounded-xl transition-colors text-sm"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Processing time notice */}
            <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                <strong>Note:</strong> This wallet balance reflects commission tracking.
                For most orders, funds arrive directly in your Paystack account via Split.
                This request is for any residual balance shown here.
                Processing: <strong>2–3 business days</strong>.
              </p>
            </div>

            <InputField
              label="Amount (₦)"
              name="amount"
              type="number"
              value={form.amount}
              onChange={setField('amount')}
              placeholder={`Min ₦${MIN_WITHDRAWAL.toLocaleString()}`}
              error={errors.amount}
              hint={`Maximum: ₦${walletBalance.toLocaleString()}`}
              required
            />

            <InputField
              label="Bank name"
              name="bank_name"
              value={form.bank_name}
              onChange={setField('bank_name')}
              placeholder="e.g. First Bank, GTBank, Access Bank"
              error={errors.bank_name}
              required
            />

            <InputField
              label="Account number"
              name="account_number"
              value={form.account_number}
              onChange={(v) => setField('account_number')(v.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit NUBAN"
              error={errors.account_number}
              hint="Your 10-digit Nigerian bank account number."
              required
            />

            <InputField
              label="Account name"
              name="account_name"
              value={form.account_name}
              onChange={setField('account_name')}
              placeholder="As it appears on your bank account"
              error={errors.account_name}
              hint="Must match the registered name on the bank account exactly."
              required
            />

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 border border-gray-200 text-gray-600 font-medium
                  rounded-xl hover:bg-gray-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 h-11 bg-orange-500 hover:bg-orange-600 disabled:opacity-50
                  disabled:cursor-not-allowed text-white font-semibold rounded-xl
                  transition-colors text-sm flex items-center justify-center gap-2"
              >
                {isLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                  : 'Submit request'
                }
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export default WithdrawalModal;
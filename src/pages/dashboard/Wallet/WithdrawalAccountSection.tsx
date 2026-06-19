// src/pages/dashboard/Wallet/WithdrawalAccountSection.tsx

import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, CreditCard, CheckCircle2, Edit2,
  Shield, X, Eye, EyeOff, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SavedAccount {
  bank_name: string;
  account_number: string;
  account_name: string;
}

interface EditForm {
  bank_name: string;
  account_number: string;
  account_name: string;
}

interface Props {
  savedAccount: SavedAccount | null;
  isLoadingAccount: boolean;
  isEditingAccount: boolean;
  editForm: EditForm;
  otpSent: boolean;
  otpInput: string;
  isSendingOtp: boolean;
  isVerifyingOtp: boolean;
  showAccountNumber: boolean;
  userEmail: string | undefined;
  onEditFormChange: (field: keyof EditForm, value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveFirstTime: () => void;
  onRequestOtp: () => void;
  onVerifyAndSave: () => void;
  onOtpInput: (value: string) => void;
  onResetOtp: () => void;
  onToggleAccountNumber: () => void;
}

export default function WithdrawalAccountSection({
  savedAccount,
  isLoadingAccount,
  isEditingAccount,
  editForm,
  otpSent,
  otpInput,
  isSendingOtp,
  isVerifyingOtp,
  showAccountNumber,
  userEmail,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSaveFirstTime,
  onRequestOtp,
  onVerifyAndSave,
  onOtpInput,
  onResetOtp,
  onToggleAccountNumber,
}: Props) {
  const inputClass = `w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600
    focus:ring-2 focus:ring-orange-500 outline-none text-sm
    bg-white dark:bg-gray-700 text-gray-900 dark:text-white`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28 }}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <Building2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Withdrawal Account
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Bank account for your withdrawals
            </p>
          </div>
        </div>

        {savedAccount && !isEditingAccount && (
          <button
            onClick={onStartEdit}
            className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium px-3 py-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
          >
            <Edit2 className="w-4 h-4" /> Change
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoadingAccount && (
        <div className="flex items-center gap-3 py-4">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
          <span className="text-sm text-gray-500">Loading account details…</span>
        </div>
      )}

      {/* No account saved */}
      {!isLoadingAccount && !savedAccount && !isEditingAccount && (
        <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-6 text-center">
          <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
            No withdrawal account saved
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Add your bank account to enable withdrawals
          </p>
          <Button
            onClick={onStartEdit}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Add Bank Account
          </Button>
        </div>
      )}

      {/* Saved account display */}
      {!isLoadingAccount && savedAccount && !isEditingAccount && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-sm font-semibold text-green-700 dark:text-green-400">
              Verified withdrawal account
            </span>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Bank</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {savedAccount.bank_name}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Account Number
              </p>
              <div className="flex items-center gap-2">
                <p className="font-mono font-bold text-gray-900 dark:text-white tracking-wider">
                  {showAccountNumber
                    ? savedAccount.account_number
                    : `••••••${savedAccount.account_number.slice(-4)}`}
                </p>
                <button
                  onClick={onToggleAccountNumber}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {showAccountNumber
                    ? <EyeOff className="w-4 h-4" />
                    : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Account Name
              </p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {savedAccount.account_name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Edit form + OTP */}
      <AnimatePresence>
        {isEditingAccount && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 pt-2">
              {/* Security warning for existing account */}
              {savedAccount && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
                  <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    For your security, changing your withdrawal account requires
                    email verification. A 6-digit code will be sent to{' '}
                    <strong>{userEmail}</strong>.
                  </p>
                </div>
              )}

              {/* Form fields */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={editForm.bank_name}
                    onChange={(e) => onEditFormChange('bank_name', e.target.value)}
                    className={inputClass}
                    placeholder="e.g. GTBank"
                    disabled={otpSent}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={editForm.account_number}
                    onChange={(e) => onEditFormChange(
                      'account_number',
                      e.target.value.replace(/\D/g, '').slice(0, 10),
                    )}
                    className={`${inputClass} font-mono tracking-widest`}
                    placeholder="0123456789"
                    maxLength={10}
                    disabled={otpSent}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Account Name
                  </label>
                  <input
                    type="text"
                    value={editForm.account_name}
                    onChange={(e) => onEditFormChange('account_name', e.target.value)}
                    className={inputClass}
                    placeholder="John Doe"
                    disabled={otpSent}
                  />
                </div>
              </div>

              {/* OTP input */}
              {otpSent && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="text-xs text-green-800 dark:text-green-300">
                      Code sent to <strong>{userEmail}</strong>. Check your inbox.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      value={otpInput}
                      onChange={(e) => onOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className={`${inputClass} font-mono text-2xl tracking-[0.4em] text-center`}
                      placeholder="000000"
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={onResetOtp}
                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                  >
                    Didn't receive it? Go back and resend
                  </button>
                </motion.div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onCancelEdit}
                  className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>

                {!savedAccount ? (
                  <Button
                    onClick={onSaveFirstTime}
                    disabled={isSendingOtp}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6"
                  >
                    {isSendingOtp
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : 'Save Account'}
                  </Button>
                ) : !otpSent ? (
                  <Button
                    onClick={onRequestOtp}
                    disabled={isSendingOtp}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6"
                  >
                    {isSendingOtp ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending code…</>
                    ) : (
                      <><Shield className="w-4 h-4 mr-2" /> Send Verification Code</>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={onVerifyAndSave}
                    disabled={isVerifyingOtp || otpInput.length < 6}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6"
                  >
                    {isVerifyingOtp ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Verifying…</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4 mr-2" /> Confirm Change</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
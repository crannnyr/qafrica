import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, ArrowUpRight, History,
  Loader2, AlertCircle, Clock, Lock,
  Building2, CreditCard, CheckCircle2,
  Edit2, Shield, X, Eye, EyeOff, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useWalletStore } from '@/stores';
import { supabase } from '@/services/supabase';
import { sendEmail } from '@/services/email';
import { toast } from 'sonner';

// ─── OTP email helper ────────────────────────────────────────────────────────
const sendBankChangeOtp = async (email: string, otp: string, name: string) => {
  return sendEmail({
    to: email,
    subject: 'QAFRICA — Confirm your withdrawal account change',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="background:#F97316;border-radius:12px;padding:12px 18px;display:inline-block;">
            <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
          </div>
        </td></tr>
        <tr><td style="background:#fff;border-radius:16px;padding:36px 32px;box-shadow:0 4px 20px rgba(0,0,0,0.07);">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">Withdrawal Account Change</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6B7280;">Hi ${name}, someone requested a change to your withdrawal bank account. Use the code below to confirm.</p>
          <div style="background:#FFF7ED;border:2px dashed #F97316;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#F97316;text-transform:uppercase;letter-spacing:1px;">Your OTP Code</p>
            <p style="margin:0;font-size:36px;font-weight:800;color:#111827;letter-spacing:8px;">${otp}</p>
            <p style="margin:8px 0 0;font-size:12px;color:#9CA3AF;">Expires in 15 minutes</p>
          </div>
          <div style="background:#FEF2F2;border-left:3px solid #EF4444;border-radius:0 8px 8px 0;padding:12px 16px;">
            <p style="margin:0;font-size:13px;color:#991B1B;">If you didn't request this change, contact us immediately on <a href="https://wa.me/447404707531" style="color:#F97316;">WhatsApp</a>.</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  });
};

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

export default function WalletPage() {
  const { user } = useAuthStore();
  const {
    wallet,
    transactions,
    availableBalance,
    escrowBalance,
    fetchWallet,
    fetchTransactions,
    fetchWithdrawalRequests,
    withdrawalRequests,
    submitWithdrawal,
  } = useWalletStore();

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [savedAccount, setSavedAccount] = useState<{
    bank_name: string; account_number: string; account_name: string;
  } | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [showAccountNumber, setShowAccountNumber] = useState(false);

  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editForm, setEditForm] = useState({ bank_name: '', account_number: '', account_name: '' });
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchWallet(user.id);
      fetchTransactions(user.id);
      fetchWithdrawalRequests(user.id);
      loadSavedAccount();
    }
  }, [user?.id]);

  const loadSavedAccount = async () => {
    if (!user?.id) return;
    setIsLoadingAccount(true);
    const { data, error } = await supabase
      .from('wallets')
      .select('withdrawal_bank_name, withdrawal_account_number, withdrawal_account_name')
      .eq('user_id', user.id)
      .single();

    if (!error && data?.withdrawal_account_number) {
      setSavedAccount({
        bank_name: data.withdrawal_bank_name || '',
        account_number: data.withdrawal_account_number || '',
        account_name: data.withdrawal_account_name || '',
      });
      setEditForm({
        bank_name: data.withdrawal_bank_name || '',
        account_number: data.withdrawal_account_number || '',
        account_name: data.withdrawal_account_name || '',
      });
    } else {
      setSavedAccount(null);
    }
    setIsLoadingAccount(false);
  };

  const handleSaveAccountFirstTime = async () => {
    if (!editForm.bank_name || !editForm.account_number || !editForm.account_name) {
      toast.error('Please fill in all bank account fields');
      return;
    }
    if (editForm.account_number.length < 10) {
      toast.error('Please enter a valid 10-digit account number');
      return;
    }
    setIsSendingOtp(true);
    const { error } = await supabase
      .from('wallets')
      .update({
        withdrawal_bank_name: editForm.bank_name,
        withdrawal_account_number: editForm.account_number,
        withdrawal_account_name: editForm.account_name,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user!.id);
    setIsSendingOtp(false);

    if (error) { toast.error('Failed to save account details'); return; }
    setSavedAccount({ ...editForm });
    setIsEditingAccount(false);
    toast.success('Withdrawal account saved');
  };

  const handleRequestOtp = async () => {
    if (!editForm.bank_name || !editForm.account_number || !editForm.account_name) {
      toast.error('Please fill in all bank account fields'); return;
    }
    if (editForm.account_number.length < 10) {
      toast.error('Please enter a valid 10-digit account number'); return;
    }
    setIsSendingOtp(true);
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error: otpError } = await supabase
      .from('wallets')
      .update({ bank_change_otp: otp, bank_change_otp_expires_at: expiresAt })
      .eq('user_id', user!.id);
    if (otpError) { toast.error('Failed to generate verification code'); setIsSendingOtp(false); return; }
    await sendBankChangeOtp(user!.email, otp, user!.full_name || 'there');
    setIsSendingOtp(false);
    setOtpSent(true);
    toast.success(`Verification code sent to ${user?.email}`);
  };

  const handleVerifyAndSave = async () => {
    if (!otpInput || otpInput.length < 6) { toast.error('Please enter the 6-digit code'); return; }
    setIsVerifyingOtp(true);
    const { data: walletData, error: fetchError } = await supabase
      .from('wallets')
      .select('bank_change_otp, bank_change_otp_expires_at')
      .eq('user_id', user!.id)
      .single();
    if (fetchError || !walletData?.bank_change_otp) {
      toast.error('Verification code not found. Please request a new one.'); setIsVerifyingOtp(false); return;
    }
    if (new Date(walletData.bank_change_otp_expires_at) < new Date()) {
      toast.error('Verification code expired. Please request a new one.');
      setIsVerifyingOtp(false); setOtpSent(false); setOtpInput(''); return;
    }
    if (walletData.bank_change_otp !== otpInput.trim()) {
      toast.error('Incorrect code. Please try again.'); setIsVerifyingOtp(false); return;
    }
    const { error: saveError } = await supabase
      .from('wallets')
      .update({
        withdrawal_bank_name: editForm.bank_name,
        withdrawal_account_number: editForm.account_number,
        withdrawal_account_name: editForm.account_name,
        bank_change_otp: null,
        bank_change_otp_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user!.id);
    setIsVerifyingOtp(false);
    if (saveError) { toast.error('Failed to update account details'); return; }
    setSavedAccount({ ...editForm });
    setIsEditingAccount(false); setOtpSent(false); setOtpInput('');
    toast.success('Withdrawal account updated successfully');
  };

  const handleCancelEdit = () => {
    setIsEditingAccount(false); setOtpSent(false); setOtpInput('');
    if (savedAccount) setEditForm({ ...savedAccount });
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { toast.error('Please enter a valid amount'); return; }
    if (amount < 20000) { toast.error('Minimum withdrawal is ₦20,000'); return; }
    if (amount > availableBalance) {
      toast.error(`Insufficient balance. Available: ₦${availableBalance.toLocaleString()}`); return;
    }
    if (!savedAccount?.account_number) {
      toast.error('Please save your withdrawal account details first');
      setShowWithdrawModal(false); return;
    }

    setIsSubmitting(true);
    const result = await submitWithdrawal({
      user_id: user!.id,
      amount,
      bank_name: savedAccount.bank_name,
      account_number: savedAccount.account_number,
      account_name: savedAccount.account_name,
    });

    if (result.success) {
      await sendEmail({
        to: user!.email,
        subject: 'QAFRICA — Withdrawal Request Received',
        html: withdrawalEmailHtml({
          name: user!.full_name || 'there',
          amount,
          bank_name: savedAccount.bank_name,
          account_number: savedAccount.account_number,
          account_name: savedAccount.account_name,
          status: 'submitted',
        }),
      }).catch(console.error);

      toast.success('Withdrawal request submitted. You\'ll be paid within 34 hours.');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    } else {
      toast.error(result.error || 'Failed to submit withdrawal request');
    }
    setIsSubmitting(false);
  };

  const escrowTxs = transactions.filter((tx) => tx.status === 'escrow');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your earnings and withdrawals</p>
      </div>

      {/* Balance Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
        >
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-orange-100 mb-1 font-medium">Available to Withdraw</p>
                <p className="text-4xl font-bold">₦{availableBalance.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <button
                onClick={() => setShowWithdrawModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-orange-600 rounded-lg font-bold hover:bg-orange-50 transition-colors shadow-sm"
              >
                <ArrowUpRight className="w-4 h-4" />
                Withdraw
              </button>
            </div>
          </div>
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm flex flex-col justify-center"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1 font-medium flex items-center gap-2">
                In Escrow <Lock className="w-3 h-3 text-gray-400" />
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">₦{escrowBalance.toLocaleString()}</p>
            </div>
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg border border-gray-100 dark:border-gray-600">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            Releases 7 days after seller marks order as shipped.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm"
        >
          <p className="text-gray-500 dark:text-gray-400 mb-1 font-medium">Total Earned (Lifetime)</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">₦{(wallet?.total_earned || 0).toLocaleString()}</p>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 mb-1 text-sm">Total Withdrawn</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">₦{(wallet?.total_withdrawn || 0).toLocaleString()}</p>
          </div>
        </motion.div>
      </div>

      {/* ── Payout Info Banner ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
        className="rounded-xl p-4 flex items-start gap-3 border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
      >
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Payouts are processed every Wednesday, Friday, and Sunday within 34 hours. Minimum withdrawal is ₦20,000. No fees.
        </p>
      </motion.div>

      {/* ── Expected Funds (Escrow Timeline) ─────────────────────────────────── */}
      {escrowTxs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Expected Funds</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Escrow releases — when they become withdrawable</p>
            </div>
          </div>

          <div className="space-y-3">
            {escrowTxs.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{tx.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Held since {new Date(tx.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-600">+₦{tx.amount.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <Lock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-400">In escrow</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Funds release 7 days after the seller marks the order as shipped, provided no dispute is filed.
              Once released, they appear in your available balance and can be withdrawn on the next payout day.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Withdrawal Requests History ───────────────────────────────────────── */}
      {withdrawalRequests.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6"
        >
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Withdrawal Requests</h2>
          <div className="space-y-3">
            {withdrawalRequests.slice(0, 5).map((req) => (
              <div key={req.id} className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">₦{req.amount.toLocaleString()}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {req.bank_name} · ••••{req.account_number.slice(-4)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(req.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  req.status === 'paid'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : req.status === 'rejected'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Withdrawal Account Section ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Withdrawal Account</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Bank account for your withdrawals</p>
            </div>
          </div>
          {savedAccount && !isEditingAccount && (
            <button
              onClick={() => setIsEditingAccount(true)}
              className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium px-3 py-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Change
            </button>
          )}
        </div>

        {isLoadingAccount ? (
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            <span className="text-sm text-gray-500">Loading account details…</span>
          </div>
        ) : !savedAccount && !isEditingAccount ? (
          <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-6 text-center">
            <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">No withdrawal account saved</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Add your bank account to enable withdrawals</p>
            <Button onClick={() => setIsEditingAccount(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
              Add Bank Account
            </Button>
          </div>
        ) : savedAccount && !isEditingAccount ? (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm font-semibold text-green-700 dark:text-green-400">Verified withdrawal account</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Bank</p>
                <p className="font-semibold text-gray-900 dark:text-white">{savedAccount.bank_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Account Number</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-bold text-gray-900 dark:text-white tracking-wider">
                    {showAccountNumber ? savedAccount.account_number : `••••••${savedAccount.account_number.slice(-4)}`}
                  </p>
                  <button onClick={() => setShowAccountNumber(v => !v)} className="text-gray-400 hover:text-gray-600">
                    {showAccountNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Account Name</p>
                <p className="font-semibold text-gray-900 dark:text-white">{savedAccount.account_name}</p>
              </div>
            </div>
          </div>
        ) : null}

        <AnimatePresence>
          {isEditingAccount && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="space-y-4 pt-2">
                {savedAccount && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2">
                    <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      For your security, changing your withdrawal account requires email verification.
                      A 6-digit code will be sent to <strong>{user?.email}</strong>.
                    </p>
                  </div>
                )}
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bank Name</label>
                    <input type="text" value={editForm.bank_name}
                      onChange={e => setEditForm(f => ({ ...f, bank_name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="e.g. GTBank" disabled={otpSent} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Number</label>
                    <input type="text" value={editForm.account_number}
                      onChange={e => setEditForm(f => ({ ...f, account_number: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 outline-none text-sm font-mono tracking-widest bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="0123456789" maxLength={10} disabled={otpSent} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Name</label>
                    <input type="text" value={editForm.account_name}
                      onChange={e => setEditForm(f => ({ ...f, account_name: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 outline-none text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="John Doe" disabled={otpSent} />
                  </div>
                </div>
                {otpSent && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <p className="text-xs text-green-800 dark:text-green-300">
                        Code sent to <strong>{user?.email}</strong>. Check your inbox and enter it below.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Verification Code</label>
                      <input type="text" value={otpInput}
                        onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 outline-none font-mono text-2xl tracking-[0.4em] text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="000000" maxLength={6} autoFocus />
                    </div>
                    <button onClick={() => { setOtpSent(false); setOtpInput(''); }}
                      className="text-xs text-gray-500 hover:text-gray-700 underline">
                      Didn't receive it? Go back and resend
                    </button>
                  </motion.div>
                )}
                <div className="flex gap-3 pt-2">
                  <button onClick={handleCancelEdit}
                    className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium">
                    <X className="w-4 h-4" /> Cancel
                  </button>
                  {!savedAccount ? (
                    <Button onClick={handleSaveAccountFirstTime} disabled={isSendingOtp} className="bg-orange-500 hover:bg-orange-600 text-white px-6">
                      {isSendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Account'}
                    </Button>
                  ) : !otpSent ? (
                    <Button onClick={handleRequestOtp} disabled={isSendingOtp} className="bg-orange-500 hover:bg-orange-600 text-white px-6">
                      {isSendingOtp
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending code…</>
                        : <><Shield className="w-4 h-4 mr-2" />Send Verification Code</>}
                    </Button>
                  ) : (
                    <Button onClick={handleVerifyAndSave} disabled={isVerifyingOtp || otpInput.length < 6} className="bg-orange-500 hover:bg-orange-600 text-white px-6">
                      {isVerifyingOtp
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Verifying…</>
                        : <><CheckCircle2 className="w-4 h-4 mr-2" />Confirm Change</>}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Transaction History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm"
      >
        <div className="flex items-center gap-3 p-6 border-b border-gray-100 dark:border-gray-700">
          <History className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Transaction History</h2>
        </div>
        {transactions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100 dark:border-gray-600">
              <History className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">No transactions yet</p>
            <p className="text-sm text-gray-400 mt-1">Your earnings and withdrawals will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-medium">
                      {new Date(tx.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{tx.description}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        tx.status === 'escrow' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : tx.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : tx.status === 'reversed' ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        : tx.type === 'credit' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                        {tx.status === 'escrow' ? 'In Escrow'
                          : tx.status === 'pending' ? 'Processing'
                          : tx.status === 'reversed' ? 'Reversed'
                          : tx.type === 'credit' ? 'Credit' : 'Debit'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-sm font-bold text-right ${tx.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'credit' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white text-right">
                      ₦{tx.balance_after.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Withdraw Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Withdraw Funds</h2>
                <button onClick={() => { setShowWithdrawModal(false); setWithdrawAmount(''); }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {!savedAccount ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                    <Building2 className="w-7 h-7 text-orange-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">No withdrawal account saved</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Add your bank account details before withdrawing.
                    </p>
                  </div>
                  <Button onClick={() => { setShowWithdrawModal(false); setIsEditingAccount(true); }}
                    className="bg-orange-500 hover:bg-orange-600 text-white w-full">
                    Add Bank Account
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Amount (₦)</label>
                    <input type="number" value={withdrawAmount}
                      onChange={e => setWithdrawAmount(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-orange-500 outline-none font-medium text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="0.00" max={availableBalance} />
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-sm font-medium text-orange-600">
                        Available: ₦{availableBalance.toLocaleString()}
                      </p>
                      <button onClick={() => setWithdrawAmount(availableBalance.toString())}
                        className="text-xs font-bold text-gray-500 hover:text-gray-900 uppercase tracking-wider bg-gray-100 dark:bg-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                        Max
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Minimum ₦20,000 · No fees · Processed within 34 hours</p>
                  </div>

                  {escrowBalance > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 rounded-xl flex gap-3 items-start">
                      <Lock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                        <span className="font-bold">₦{escrowBalance.toLocaleString()}</span> is in escrow and cannot be withdrawn yet.
                        It releases 7 days after orders are shipped.
                      </p>
                    </div>
                  )}

                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-100 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Withdrawing to</p>
                      <button onClick={() => { setShowWithdrawModal(false); setIsEditingAccount(true); }}
                        className="text-xs text-orange-500 hover:text-orange-600 underline">Change</button>
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white">{savedAccount.account_name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{savedAccount.bank_name} · ••••{savedAccount.account_number.slice(-4)}</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { setShowWithdrawModal(false); setWithdrawAmount(''); }}
                      className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                      Cancel
                    </button>
                    <Button
                      onClick={handleWithdraw}
                      disabled={
                        isSubmitting ||
                        !withdrawAmount ||
                        parseFloat(withdrawAmount) < 20000
                      }
                      className="flex-1 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold disabled:opacity-50"
                    >
                      {isSubmitting
                        ? <Loader2 className="w-5 h-5 animate-spin" />
                        : 'Submit Request'}
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Withdrawal email template ────────────────────────────────────────────────
function withdrawalEmailHtml({
  name, amount, bank_name, account_number, account_name, status, reason
}: {
  name: string; amount: number; bank_name: string;
  account_number: string; account_name: string;
  status: 'submitted' | 'paid' | 'rejected'; reason?: string;
}) {
  const statusConfig = {
    submitted: { color: '#F97316', label: 'Request Received', message: 'Your withdrawal request has been received and will be processed within 34 hours.' },
    paid: { color: '#10B981', label: 'Payment Sent', message: 'Your withdrawal has been processed and sent to your bank account.' },
    rejected: { color: '#EF4444', label: 'Request Rejected', message: reason || 'Your withdrawal request was rejected. Your funds have been returned to your wallet.' },
  }[status];

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="background:#F97316;border-radius:12px;padding:12px 18px;display:inline-block;">
            <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
          </div>
        </td></tr>
        <tr><td style="background:#fff;border-radius:16px;padding:36px 32px;box-shadow:0 4px 20px rgba(0,0,0,0.07);">
          <div style="background:${statusConfig.color}15;border-left:4px solid ${statusConfig.color};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:24px;">
            <p style="margin:0;font-size:16px;font-weight:700;color:${statusConfig.color};">${statusConfig.label}</p>
          </div>
          <p style="margin:0 0 24px;font-size:14px;color:#6B7280;">Hi ${name}, ${statusConfig.message}</p>
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:16px;">
            <table width="100%" style="font-size:13px;">
              <tr><td style="color:#6B7280;padding:4px 0;">Amount</td><td style="text-align:right;font-weight:700;color:#111827;">₦${amount.toLocaleString()}</td></tr>
              <tr><td style="color:#6B7280;padding:4px 0;">Bank</td><td style="text-align:right;font-weight:600;color:#111827;">${bank_name}</td></tr>
              <tr><td style="color:#6B7280;padding:4px 0;">Account</td><td style="text-align:right;font-weight:600;color:#111827;">••••${account_number.slice(-4)} · ${account_name}</td></tr>
            </table>
          </div>
          <p style="margin:0;font-size:12px;color:#9CA3AF;">If you have questions, contact us on <a href="https://wa.me/447404707531" style="color:#F97316;">WhatsApp</a>.</p>
        </td></tr>
        <tr><td align="center" style="padding:20px 0 0;">
          <p style="margin:0;font-size:12px;color:#D1D5DB;">© ${new Date().getFullYear()} QAFRICA</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
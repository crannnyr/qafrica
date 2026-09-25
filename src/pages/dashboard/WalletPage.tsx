// src/pages/dashboard/WalletPage.tsx

import { useState, useEffect } from 'react';
import { useAuthStore, useWalletStore } from '@/stores';
import { supabase } from '@/services';
import { sendEmail } from '@/services/email';
import { toast } from 'sonner';

import WalletBalanceCards from './Wallet/WalletBalanceCards';
import PayoutInfoBanner from './Wallet/PayoutInfoBanner';
import EscrowTimeline from './Wallet/EscrowTimeline';
import WithdrawalRequestsList from './Wallet/WithdrawalRequestsList';
import WithdrawalAccountSection from './Wallet/WithdrawalAccountSection';
import TransactionTable from './Wallet/TransactionTable';
import WithdrawModal from './Wallet/WithdrawModal';
import { withdrawalEmailHtml } from './Wallet/emailTemplates';

interface SavedAccount {
  bank_name: string;
  account_number: string;
  account_name: string;
}

export default function WalletPage() {
  const { user } = useAuthStore();
  const {
    wallet, transactions, availableBalance, escrowBalance,
    fetchWallet, fetchTransactions, fetchWithdrawalRequests,
    withdrawalRequests, submitWithdrawal,
  } = useWalletStore();

  // ── Withdraw modal ─────────────────────────────────────────────────────────
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount]       = useState('');
  const [isSubmitting, setIsSubmitting]           = useState(false);

  // ── Saved account ──────────────────────────────────────────────────────────
  const [savedAccount, setSavedAccount]           = useState<SavedAccount | null>(null);
  const [isLoadingAccount, setIsLoadingAccount]   = useState(true);
  const [showAccountNumber, setShowAccountNumber] = useState(false);

  // ── Edit / OTP ─────────────────────────────────────────────────────────────
  const [isEditingAccount, setIsEditingAccount]   = useState(false);
  const [editForm, setEditForm]                   = useState({ bank_name: '', account_number: '', account_name: '' });
  const [isSendingOtp, setIsSendingOtp]           = useState(false);
  const [otpSent, setOtpSent]                     = useState(false);
  const [otpInput, setOtpInput]                   = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp]       = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchWallet(user.id);
      fetchTransactions(user.id);
      fetchWithdrawalRequests(user.id);
      loadSavedAccount();
    }
  }, [user?.id]);

  // ── Load account ───────────────────────────────────────────────────────────
  const loadSavedAccount = async () => {
    if (!user?.id) return;
    setIsLoadingAccount(true);
    const { data, error } = await supabase
      .from('wallets')
      .select('withdrawal_bank_name, withdrawal_account_number, withdrawal_account_name')
      .eq('user_id', user.id)
      .single();

    if (!error && data?.withdrawal_account_number) {
      const account = {
        bank_name:      data.withdrawal_bank_name      || '',
        account_number: data.withdrawal_account_number || '',
        account_name:   data.withdrawal_account_name   || '',
      };
      setSavedAccount(account);
      setEditForm(account);
    } else {
      setSavedAccount(null);
    }
    setIsLoadingAccount(false);
  };

  // ── Save account (first time, no OTP) ─────────────────────────────────────
  const handleSaveAccountFirstTime = async () => {
    if (!editForm.bank_name || !editForm.account_number || !editForm.account_name) {
      toast.error('Please fill in all bank account fields'); return;
    }
    if (editForm.account_number.length < 10) {
      toast.error('Please enter a valid 10-digit account number'); return;
    }
    setIsSendingOtp(true);
    const { error } = await supabase
      .from('wallets')
      .update({
        withdrawal_bank_name:    editForm.bank_name,
        withdrawal_account_number: editForm.account_number,
        withdrawal_account_name: editForm.account_name,
        updated_at:              new Date().toISOString(),
      })
      .eq('user_id', user!.id);
    setIsSendingOtp(false);
    if (error) { toast.error('Failed to save account details'); return; }
    setSavedAccount({ ...editForm });
    setIsEditingAccount(false);
    toast.success('Withdrawal account saved');
  };

  // ── Request code (server generates, stores a hash bound to the new account, emails it) ──
  const bankChange = async (body: Record<string, string>) => {
    const { data, error } = await supabase.functions.invoke('bank-change', { body });
    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = await (error as any)?.context?.json?.().then((j: { error?: string }) => j?.error).catch(() => null);
      return { ok: false as const, error: msg ?? 'Something went wrong. Please try again.' };
    }
    return { ok: true as const, data };
  };

  const handleRequestOtp = async () => {
    if (!editForm.bank_name || !editForm.account_number || !editForm.account_name) {
      toast.error('Please fill in all bank account fields'); return;
    }
    if (editForm.account_number.length < 10) {
      toast.error('Please enter a valid 10-digit account number'); return;
    }
    setIsSendingOtp(true);
    const r = await bankChange({ action: 'request', bank_name: editForm.bank_name, account_number: editForm.account_number, account_name: editForm.account_name });
    setIsSendingOtp(false);
    if (!r.ok) { toast.error(r.error); return; }
    setOtpSent(true);
    toast.success(`Verification code sent to ${user?.email}`);
  };

  // ── Verify code + save (server checks the code and updates the account) ──
  const handleVerifyAndSave = async () => {
    if (!otpInput || otpInput.length < 6) { toast.error('Please enter the 6-digit code'); return; }
    setIsVerifyingOtp(true);
    const r = await bankChange({ action: 'confirm', code: otpInput.trim(), bank_name: editForm.bank_name, account_number: editForm.account_number, account_name: editForm.account_name });
    setIsVerifyingOtp(false);
    if (!r.ok) { toast.error(r.error); return; }
    setSavedAccount({ ...editForm });
    setIsEditingAccount(false); setOtpSent(false); setOtpInput('');
    toast.success('Withdrawal account updated successfully');
  };

  const handleCancelEdit = () => {
    setIsEditingAccount(false); setOtpSent(false); setOtpInput('');
    if (savedAccount) setEditForm({ ...savedAccount });
  };

  // ── Withdraw ───────────────────────────────────────────────────────────────
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0)       { toast.error('Please enter a valid amount'); return; }
    if (amount < 20000)               { toast.error('Minimum withdrawal is ₦20,000'); return; }
    if (amount > availableBalance)    { toast.error(`Insufficient balance. Available: ₦${availableBalance.toLocaleString()}`); return; }
    if (!savedAccount?.account_number) {
      toast.error('Please save your withdrawal account details first');
      setShowWithdrawModal(false); return;
    }
    setIsSubmitting(true);
    const result = await submitWithdrawal({
      user_id:        user!.id,
      amount,
      bank_name:      savedAccount.bank_name,
      account_number: savedAccount.account_number,
      account_name:   savedAccount.account_name,
    });
    if (result.success) {
      await sendEmail({
        to:      user!.email,
        subject: 'QAFRICA — Withdrawal Request Received',
        html:    withdrawalEmailHtml({
          name:           user!.full_name || 'there',
          amount,
          bank_name:      savedAccount.bank_name,
          account_number: savedAccount.account_number,
          account_name:   savedAccount.account_name,
          status:         'submitted',
        }),
      }).catch(console.error);
      toast.success("Withdrawal request submitted. You'll be paid within 34 hours.");
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    } else {
      toast.error(result.error || 'Failed to submit withdrawal request');
    }
    setIsSubmitting(false);
  };

  const escrowTxs = transactions.filter((tx) => tx.status === 'escrow');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage your earnings and withdrawals
        </p>
      </div>

      <WalletBalanceCards
        availableBalance={availableBalance}
        escrowBalance={escrowBalance}
        totalEarned={wallet?.total_earned || 0}
        totalWithdrawn={wallet?.total_withdrawn || 0}
        onWithdraw={() => setShowWithdrawModal(true)}
      />

      <PayoutInfoBanner />

      <EscrowTimeline escrowTxs={escrowTxs} />

      <WithdrawalRequestsList withdrawalRequests={withdrawalRequests} />

      <WithdrawalAccountSection
        savedAccount={savedAccount}
        isLoadingAccount={isLoadingAccount}
        isEditingAccount={isEditingAccount}
        editForm={editForm}
        otpSent={otpSent}
        otpInput={otpInput}
        isSendingOtp={isSendingOtp}
        isVerifyingOtp={isVerifyingOtp}
        showAccountNumber={showAccountNumber}
        userEmail={user?.email}
        onEditFormChange={(field, value) =>
          setEditForm((prev) => ({ ...prev, [field]: value }))
        }
        onStartEdit={() => setIsEditingAccount(true)}
        onCancelEdit={handleCancelEdit}
        onSaveFirstTime={handleSaveAccountFirstTime}
        onRequestOtp={handleRequestOtp}
        onVerifyAndSave={handleVerifyAndSave}
        onOtpInput={setOtpInput}
        onResetOtp={() => { setOtpSent(false); setOtpInput(''); }}
        onToggleAccountNumber={() => setShowAccountNumber((v) => !v)}
      />

      <TransactionTable transactions={transactions} />

      <WithdrawModal
        isOpen={showWithdrawModal}
        savedAccount={savedAccount}
        availableBalance={availableBalance}
        escrowBalance={escrowBalance}
        withdrawAmount={withdrawAmount}
        isSubmitting={isSubmitting}
        onClose={() => { setShowWithdrawModal(false); setWithdrawAmount(''); }}
        onAmountChange={setWithdrawAmount}
        onSetMax={() => setWithdrawAmount(availableBalance.toString())}
        onWithdraw={handleWithdraw}
        onAddAccount={() => { setShowWithdrawModal(false); setIsEditingAccount(true); }}
        onChangeAccount={() => { setShowWithdrawModal(false); setIsEditingAccount(true); }}
      />
    </div>
  );
}
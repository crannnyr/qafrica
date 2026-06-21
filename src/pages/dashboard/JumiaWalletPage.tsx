// src/pages/dashboard/JumiaWalletPage.tsx
// Mirrors WalletPage.tsx's structure. Reuses WithdrawalAccountSection and TransactionTable
// as-is (generic, no escrow assumptions). Uses Jumia-specific balance cards + withdraw modal
// since those hardcode escrow copy and a ₦20,000 minimum that don't apply to Jumia.
// Jumia keeps its own separate bank account fields, stored on jumia_wallets — never reads
// or writes the main wallets table.

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores';
import { useJumiaStore } from '@/stores/jumiaStore';
import { supabase } from '@/services';
import { sendBankChangeOtp, generateOtp } from './Wallet/emailTemplates';
import { toast } from 'sonner';

import JumiaWalletBalanceCards from './Jumia/JumiaWalletBalanceCards';
import JumiaWithdrawModal from './Jumia/JumiaWithdrawModal';
import WithdrawalAccountSection from './Wallet/WithdrawalAccountSection';
import TransactionTable from './Wallet/TransactionTable';

interface SavedAccount { bank_name: string; account_number: string; account_name: string; }

export default function JumiaWalletPage() {
  const { user } = useAuthStore();
  const { wallet, transactions, withdrawalRequests, fetchWallet, fetchTransactions, fetchWithdrawalRequests, submitWithdrawal } = useJumiaStore();

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [savedAccount, setSavedAccount] = useState<SavedAccount | null>(null);
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
      .from('jumia_wallets')
      .select('withdrawal_bank_name, withdrawal_account_number, withdrawal_account_name')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!error && data?.withdrawal_account_number) {
      const account = {
        bank_name: data.withdrawal_bank_name || '',
        account_number: data.withdrawal_account_number || '',
        account_name: data.withdrawal_account_name || '',
      };
      setSavedAccount(account);
      setEditForm(account);
    } else {
      setSavedAccount(null);
    }
    setIsLoadingAccount(false);
  };

  const ensureWalletRow = async () => {
    // jumia_wallets only gets a row once a sale or this page creates one. Safe upsert.
    await supabase.from('jumia_wallets').upsert({ user_id: user!.id }, { onConflict: 'user_id', ignoreDuplicates: true });
  };

  const handleSaveAccountFirstTime = async () => {
    if (!editForm.bank_name || !editForm.account_number || !editForm.account_name) {
      toast.error('Please fill in all bank account fields'); return;
    }
    if (editForm.account_number.length < 10) { toast.error('Please enter a valid 10-digit account number'); return; }
    setIsSendingOtp(true);
    await ensureWalletRow();
    const { error } = await supabase
      .from('jumia_wallets')
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
    toast.success('Jumia withdrawal account saved');
  };

  const handleRequestOtp = async () => {
    if (!editForm.bank_name || !editForm.account_number || !editForm.account_name) {
      toast.error('Please fill in all bank account fields'); return;
    }
    setIsSendingOtp(true);
    const otp = generateOtp();
    // Reuses the same bank_change_otp columns pattern as the main wallets table.
    // NOTE: jumia_wallets does not yet have bank_change_otp columns — add them via
    // migration before shipping this, or this update will fail silently below.
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('jumia_wallets')
      .update({ bank_change_otp: otp, bank_change_otp_expires_at: expiresAt })
      .eq('user_id', user!.id);
    if (error) { toast.error('Failed to generate verification code'); setIsSendingOtp(false); return; }
    await sendBankChangeOtp(user!.email, otp, user!.full_name || 'there');
    setIsSendingOtp(false);
    setOtpSent(true);
    toast.success(`Verification code sent to ${user?.email}`);
  };

  const handleVerifyAndSave = async () => {
    if (!otpInput || otpInput.length < 6) { toast.error('Please enter the 6-digit code'); return; }
    setIsVerifyingOtp(true);
    const { data: walletData, error: fetchError } = await supabase
      .from('jumia_wallets')
      .select('bank_change_otp, bank_change_otp_expires_at')
      .eq('user_id', user!.id)
      .single();
    if (fetchError || !walletData?.bank_change_otp) {
      toast.error('Verification code not found. Please request a new one.'); setIsVerifyingOtp(false); return;
    }
    if (new Date(walletData.bank_change_otp_expires_at) < new Date()) {
      toast.error('Verification code expired.'); setIsVerifyingOtp(false); setOtpSent(false); setOtpInput(''); return;
    }
    if (walletData.bank_change_otp !== otpInput.trim()) {
      toast.error('Incorrect code. Please try again.'); setIsVerifyingOtp(false); return;
    }
    const { error: saveError } = await supabase
      .from('jumia_wallets')
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
    toast.success('Jumia withdrawal account updated');
  };

  const handleCancelEdit = () => {
    setIsEditingAccount(false); setOtpSent(false); setOtpInput('');
    if (savedAccount) setEditForm({ ...savedAccount });
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) { toast.error('Please enter a valid amount'); return; }
    if (!savedAccount?.account_number) {
      toast.error('Please save your withdrawal account details first');
      setShowWithdrawModal(false); return;
    }
    setIsSubmitting(true);
    const result = await submitWithdrawal({
      user_id: user!.id, amount,
      bank_name: savedAccount.bank_name,
      account_number: savedAccount.account_number,
      account_name: savedAccount.account_name,
    });
    if (result.success) {
      toast.success('Withdrawal request submitted. An admin will review and pay it out manually.');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      fetchWithdrawalRequests(user!.id);
    } else {
      toast.error(result.error || 'Failed to submit withdrawal request');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <Link to="/dashboard/jumia" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Jumia
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Jumia Wallet</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Earnings from items sold on Jumia. Kept separate from your main store wallet.
        </p>
      </div>

      <JumiaWalletBalanceCards
        balance={Number(wallet?.balance ?? 0)}
        totalEarned={Number(wallet?.total_earned ?? 0)}
        totalWithdrawn={Number(wallet?.total_withdrawn ?? 0)}
        onWithdraw={() => setShowWithdrawModal(true)}
      />

      {withdrawalRequests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Withdrawal Requests</h2>
          <div className="space-y-2">
            {withdrawalRequests.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <span className="text-gray-600 dark:text-gray-300">₦{Number(w.amount).toLocaleString()}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                  w.status === 'paid' ? 'bg-green-100 text-green-800' :
                  w.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                  w.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                }`}>{w.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
        onEditFormChange={(field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))}
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

      <JumiaWithdrawModal
        isOpen={showWithdrawModal}
        savedAccount={savedAccount}
        balance={Number(wallet?.balance ?? 0)}
        withdrawAmount={withdrawAmount}
        isSubmitting={isSubmitting}
        onClose={() => { setShowWithdrawModal(false); setWithdrawAmount(''); }}
        onAmountChange={setWithdrawAmount}
        onSetMax={() => setWithdrawAmount(String(wallet?.balance ?? 0))}
        onWithdraw={handleWithdraw}
        onAddAccount={() => { setShowWithdrawModal(false); setIsEditingAccount(true); }}
        onChangeAccount={() => { setShowWithdrawModal(false); setIsEditingAccount(true); }}
      />
    </div>
  );
}

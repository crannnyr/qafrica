import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services';
import { toast } from 'sonner';

interface InviteInfo {
  store_name: string;
  owner_name: string;
  email: string;
  staff_id: string;
  token: string;
}

export default function AcceptStaffInvitePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') ?? '';

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'already_accepted'>('loading');

  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    loadInvite();
  }, [token]);

  const loadInvite = async () => {
    // Step 1: Load the invitation row on its own — no joins, no FK ambiguity
    const { data: invite, error } = await supabase
      .from('staff_invitations')
      .select('token, email, staff_id, accepted_at, expires_at, store_id, owner_id')
      .eq('token', token)
      .single();

    if (error || !invite) { setStatus('invalid'); return; }
    if (invite.accepted_at) { setStatus('already_accepted'); return; }
    if (new Date(invite.expires_at) < new Date()) { setStatus('invalid'); return; }

    // Step 2: Fetch store name separately
    const { data: storeData } = await supabase
      .from('stores')
      .select('name')
      .eq('id', invite.store_id)
      .single();

    // Step 3: Fetch owner name separately
    const { data: ownerData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', invite.owner_id)
      .single();

    setInviteInfo({
      store_name: storeData?.name      ?? 'Unknown Store',
      owner_name: ownerData?.full_name ?? 'Store Owner',
      email:      invite.email,
      staff_id:   invite.staff_id,
      token:      invite.token,
    });
    setStatus('valid');
  };

  const handleSignupAndAccept = async () => {
    if (!inviteInfo) return;
    if (!fullName.trim()) { toast.error('Enter your full name'); return; }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }

    setIsSubmitting(true);
    try {
      // Sign up
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: inviteInfo.email,
        password,
        options: { data: { full_name: fullName, user_type: 'staff' } },
      });

      if (signUpError) {
        // Might already have account
        if (signUpError.message.includes('already registered')) {
          toast.error('This email already has an account. Use "I already have an account" below.');
        } else {
          toast.error(signUpError.message);
        }
        setIsSubmitting(false);
        return;
      }

      const userId = authData.user?.id;
      if (!userId) { toast.error('Signup failed — no user returned'); setIsSubmitting(false); return; }

      // Accept invitation
      const { data: rpcData, error: rpcError } = await supabase.rpc('accept_staff_invitation', {
        p_token:     token,
        p_user_id:   userId,
        p_full_name: fullName,
      });

      if (rpcError || !rpcData?.success) {
        toast.error(rpcData?.error ?? rpcError?.message ?? 'Failed to accept invitation');
        setIsSubmitting(false);
        return;
      }

      toast.success(`Welcome to ${inviteInfo.store_name}!`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginAndAccept = async () => {
    if (!inviteInfo) return;
    if (!password) { toast.error('Enter your password'); return; }

    setIsSubmitting(true);
    try {
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteInfo.email,
        password,
      });

      if (signInError) { toast.error('Incorrect password'); setIsSubmitting(false); return; }

      const userId = authData.user?.id;
      if (!userId) { toast.error('Login failed'); setIsSubmitting(false); return; }

      const { data: rpcData, error: rpcError } = await supabase.rpc('accept_staff_invitation', {
        p_token:     token,
        p_user_id:   userId,
        p_full_name: authData.user?.user_metadata?.full_name ?? '',
      });

      if (rpcError || !rpcData?.success) {
        toast.error(rpcData?.error ?? rpcError?.message ?? 'Failed to accept invitation');
        setIsSubmitting(false);
        return;
      }

      toast.success(`Welcome to ${inviteInfo.store_name}!`);
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── States ──────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm border">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid or Expired Invitation</h1>
          <p className="text-gray-500 text-sm mb-6">
            This invitation link is no longer valid. Ask the store owner to send a new invite.
          </p>
          <Link to="/">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white w-full">
              Go to Homepage
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'already_accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm border">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Already Accepted</h1>
          <p className="text-gray-500 text-sm mb-6">
            This invitation has already been accepted. Log in to access your dashboard.
          </p>
          <Link to="/login">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white w-full">
              Log In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-violet-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">You're Invited!</h1>
          <p className="text-gray-500 text-sm mt-1">
            <strong>{inviteInfo!.owner_name}</strong> invited you to manage{' '}
            <strong>{inviteInfo!.store_name}</strong> on QAFRICA.
          </p>
        </div>

        {/* Store badge */}
        <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-100 rounded-xl mb-6">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Store className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{inviteInfo!.store_name}</p>
            <p className="text-xs text-gray-500">Invitation for {inviteInfo!.email}</p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-5">
          {(['signup', 'login'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === m
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m === 'signup' ? 'Create Account' : 'I Already Have an Account'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                placeholder="Your full name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={inviteInfo!.email}
              disabled
              className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                placeholder={mode === 'signup' ? 'Create a password' : 'Your password'}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none text-sm"
                placeholder="Confirm password"
              />
            </div>
          )}

          <Button
            onClick={mode === 'signup' ? handleSignupAndAccept : handleLoginAndAccept}
            disabled={isSubmitting}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white h-12 font-semibold"
          >
            {isSubmitting
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : mode === 'signup'
                ? 'Create Account & Accept Invite'
                : 'Log In & Accept Invite'
            }
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

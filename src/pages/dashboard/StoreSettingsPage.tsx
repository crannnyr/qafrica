import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Link2, Palette, Save, Loader2, Moon, Image as ImageIcon,
  Globe, Clock, AlertCircle, CreditCard, Banknote, AlertTriangle,
  Instagram, Facebook, Twitter, Youtube, MessageCircle, Lock,
  Eye, EyeOff, CheckCircle, Users, Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import DarkModeToggle from '@/components/DarkModeToggle';
import { SingleImageUpload } from '@/components/ImageUpload';
import { useStoreStore, useAuthStore } from '@/stores';
import { toast } from 'sonner';
import { supabase } from '@/services';
import type { StoreStaff } from '@/types';

type Tab = 'general' | 'images' | 'branding' | 'payments' | 'social' | 'password' | 'staff';

const TABS: { id: Tab; label: string }[] = [
  { id: 'general',  label: 'General'  },
  { id: 'images',   label: 'Images'   },
  { id: 'branding', label: 'Branding' },
  { id: 'payments', label: 'Payments' },
  { id: 'social',   label: 'Social'   },
  { id: 'password', label: 'Password' },
  { id: 'staff',    label: 'Staff'    },
];

// ── Staff Tab Component ────────────────────────────────────────────────────
function StaffTab({
  storeId, ownerId, ownerEmail, storeName,
}: {
  storeId: string; ownerId: string; ownerEmail: string; storeName: string;
}) {
  const [staffList, setStaffList]       = useState<StoreStaff[]>([]);
  const [staffLimit, setStaffLimit]     = useState(0);
  const [inviteEmail, setInviteEmail]   = useState('');
  const [isInviting, setIsInviting]     = useState(false);
  const [isLoading, setIsLoading]       = useState(true);
  const [removingId, setRemovingId]     = useState<string | null>(null);

  useEffect(() => {
    if (storeId && ownerId) {
      loadStaff();
      loadLimit();
    }
  }, [storeId, ownerId]);

  const loadStaff = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('store_staff')
      .select('*')
      .eq('store_id', storeId)
      .neq('status', 'removed')
      .order('created_at', { ascending: false });
    setStaffList((data as StoreStaff[]) ?? []);
    setIsLoading(false);
  };

  const loadLimit = async () => {
    const { data } = await supabase
      .rpc('get_staff_limit', { p_user_id: ownerId });
    setStaffLimit(data ?? 0);
  };

  const activeCount = staffList.filter(s => s.status !== 'removed').length;
  const canInvite   = staffLimit > 0 && activeCount < staffLimit;

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { toast.error('Enter an email address'); return; }
    if (!inviteEmail.includes('@')) { toast.error('Enter a valid email'); return; }
    if (!canInvite) { toast.error('Staff limit reached for your plan'); return; }
    if (inviteEmail.toLowerCase() === ownerEmail.toLowerCase()) {
      toast.error("You can't invite yourself"); return;
    }

    setIsInviting(true);
    try {
      // Create store_staff record
      const { data: staffData, error: staffError } = await supabase
        .from('store_staff')
        .insert({ store_id: storeId, owner_id: ownerId, email: inviteEmail.trim().toLowerCase() })
        .select()
        .single();

      if (staffError) {
        if (staffError.code === '23505') toast.error('This email has already been invited');
        else toast.error('Failed to create staff record');
        setIsInviting(false);
        return;
      }

      // Create invitation token
      const { data: inviteData, error: inviteError } = await supabase
        .from('staff_invitations')
        .insert({
          store_id: storeId,
          owner_id: ownerId,
          staff_id: staffData.id,
          email:    inviteEmail.trim().toLowerCase(),
        })
        .select('token')
        .single();

      if (inviteError || !inviteData?.token) {
        toast.error('Failed to generate invite token');
        setIsInviting(false);
        return;
      }

      // Send invite email via existing edge function
      const inviteUrl = `${window.location.origin}/accept-staff-invite?token=${inviteData.token}`;
      await supabase.functions.invoke('send-email', {
        body: {
          to: inviteEmail.trim(),
          subject: `You've been invited to manage ${storeName} on QAFRICA`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
                <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
              </div>
              <h2 style="color:#111827;margin:0 0 8px;">You're Invited!</h2>
              <p style="color:#6B7280;margin:0 0 24px;">
                You've been invited to join <strong style="color:#111827;">${storeName}</strong>
                as a staff member. Click below to create your account and get started.
              </p>
              <a href="${inviteUrl}"
                 style="display:inline-block;background:#F97316;color:#fff;padding:14px 28px;
                        border-radius:10px;font-weight:700;text-decoration:none;font-size:15px;">
                Accept Invitation
              </a>
              <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
                This link expires in 7 days. If you didn't expect this email, ignore it.
              </p>
            </div>
          `,
        },
      });

      toast.success(`Invite sent to ${inviteEmail}`);
      setInviteEmail('');
      await loadStaff();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (staffId: string) => {
    setRemovingId(staffId);
    const { error } = await supabase
      .from('store_staff')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', staffId)
      .eq('owner_id', ownerId);

    if (error) toast.error('Failed to remove staff member');
    else { toast.success('Staff member removed'); await loadStaff(); }
    setRemovingId(null);
  };

  const handleResendInvite = async (staffId: string, email: string) => {
    // Delete old pending invitations for this staff record, create new one
    await supabase
      .from('staff_invitations')
      .delete()
      .eq('staff_id', staffId)
      .is('accepted_at', null);

    const { data: inviteData } = await supabase
      .from('staff_invitations')
      .insert({ store_id: storeId, owner_id: ownerId, staff_id: staffId, email })
      .select('token')
      .single();

    if (!inviteData?.token) { toast.error('Failed to generate new invite'); return; }

    const inviteUrl = `${window.location.origin}/accept-staff-invite?token=${inviteData.token}`;
    await supabase.functions.invoke('send-email', {
      body: {
        to: email,
        subject: `Reminder: You're invited to manage ${storeName} on QAFRICA`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2>Invitation Reminder</h2>
          <p>You were invited to manage <strong>${storeName}</strong> on QAFRICA.</p>
          <a href="${inviteUrl}" style="display:inline-block;background:#F97316;color:#fff;padding:14px 28px;border-radius:10px;font-weight:700;text-decoration:none;">
            Accept Invitation
          </a>
          <p style="color:#9CA3AF;font-size:12px;margin-top:16px;">Expires in 7 days.</p>
        </div>`,
      },
    });
    toast.success('Invite resent');
  };

  const statusBadge = (status: StoreStaff['status']) => {
    const map = {
      active:    'bg-green-100 text-green-700',
      pending:   'bg-yellow-100 text-yellow-700',
      suspended: 'bg-red-100 text-red-700',
      removed:   'bg-gray-100 text-gray-500',
    };
    return map[status] ?? map.pending;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Manage Staff</h2>
            <p className="text-sm text-gray-500">Invite team members to help manage orders</p>
          </div>
        </div>
        {staffLimit > 0 && (
          <span className="text-xs font-medium bg-violet-50 text-violet-700 px-3 py-1.5 rounded-full border border-violet-100">
            {activeCount} / {staffLimit} used
          </span>
        )}
      </div>

      {/* Plan gate */}
      {staffLimit === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
          <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700 mb-1">Available on Growth & Enterprise</p>
          <p className="text-sm text-gray-500 mb-4 max-w-xs mx-auto">
            Upgrade to Growth to add up to 10 staff, or Enterprise for up to 20.
          </p>
          <Link to="/dashboard/subscription">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Upgrade Plan
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Invite input */}
          <div className="flex gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
              placeholder="staff@email.com"
              disabled={!canInvite}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              onClick={handleInvite}
              disabled={isInviting || !canInvite || !inviteEmail.trim()}
              className="bg-orange-500 hover:bg-orange-600 text-white px-5"
            >
              {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invite'}
            </Button>
          </div>

          {!canInvite && staffLimit > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-100">
              Staff limit reached ({staffLimit}/{staffLimit}). Remove a staff member to invite someone new.
            </p>
          )}

          {/* Staff list */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : staffList.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No staff invited yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {staffList.map(staff => (
                <div
                  key={staff.id}
                  className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-violet-700 font-bold text-sm">
                        {(staff.full_name ?? staff.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {staff.full_name ?? '—'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{staff.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${statusBadge(staff.status)}`}>
                      {staff.status}
                    </span>
                    {staff.status === 'pending' && (
                      <button
                        onClick={() => handleResendInvite(staff.id, staff.email)}
                        className="text-xs text-orange-600 hover:text-orange-700 font-medium px-2 py-1 rounded-lg hover:bg-orange-50"
                      >
                        Resend
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(staff.id)}
                      disabled={removingId === staff.id}
                      className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {removingId === staff.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : 'Remove'
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Permissions notice */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-800 mb-2">What staff can and cannot do:</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-blue-700 font-medium mb-1">✅ Allowed</p>
                <ul className="text-xs text-blue-600 space-y-0.5">
                  <li>View & update orders</li>
                  <li>View products</li>
                  <li>View dashboard</li>
                </ul>
              </div>
              <div>
                <p className="text-xs text-red-700 font-medium mb-1">🚫 Restricted</p>
                <ul className="text-xs text-red-600 space-y-0.5">
                  <li>Add/edit/delete products</li>
                  <li>Wallet & withdrawals</li>
                  <li>Settings & subscription</li>
                  <li>Prices, domains, analytics</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function StoreSettingsPage() {
  const { currentStore, updateStore } = useStoreStore();
  const { user } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('general');

  // ── Domain request status ──────────────────────────────────────────────────
  const [domainRequest, setDomainRequest] = useState<{
    admin_approved: boolean; status: string;
    domain_name: string; payment_status: string;
  } | null>(null);

  useEffect(() => {
    if (currentStore?.id) fetchDomainRequestStatus();
  }, [currentStore?.id]);

  const fetchDomainRequestStatus = async () => {
    if (!currentStore?.id) return;
    const { data, error } = await supabase
      .from('domain_requests')
      .select('admin_approved, status, domain_name, payment_status')
      .eq('store_id', currentStore.id)
      .order('created_at', { ascending: false })
      .maybeSingle();
    if (!error && data) setDomainRequest(data);
    else setDomainRequest(null);
  };

  // ── General form ───────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name:            currentStore?.name            || '',
    description:     currentStore?.description     || '',
    primary_color:   currentStore?.primary_color   || '#F97316',
    secondary_color: currentStore?.secondary_color || '#FED7AA',
    logo_url:        currentStore?.logo_url        || '',
    banner_url:      currentStore?.banner_url      || '',
  });
  const [isLoading, setIsLoading] = useState(false);

  // ── Payment form ───────────────────────────────────────────────────────────
  const [paymentSettings, setPaymentSettings] = useState({
    payment_method:        (currentStore?.payment_method || 'paystack') as 'paystack' | 'direct_transfer',
    direct_bank_name:      currentStore?.direct_bank_name      || '',
    direct_account_number: currentStore?.direct_account_number || '',
    direct_account_name:   currentStore?.direct_account_name   || '',
    cod_enabled:           currentStore?.cod_enabled            || false,
  });
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // ── Social form ────────────────────────────────────────────────────────────
  const [socialData, setSocialData] = useState({
    instagram:      currentStore?.social_links?.instagram  || '',
    facebook:       currentStore?.social_links?.facebook   || '',
    twitter:        currentStore?.social_links?.twitter    || '',
    tiktok:         currentStore?.social_links?.tiktok     || '',
    whatsapp:       currentStore?.social_links?.whatsapp   || '',
    youtube:        currentStore?.social_links?.youtube    || '',
    group_chat_url: currentStore?.group_chat_url           || '',
  });
  const [isSavingSocial, setIsSavingSocial] = useState(false);

  // ── Password form ──────────────────────────────────────────────────────────
  const [passwordData, setPasswordData] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
  });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw,     setShowNewPw]     = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isSavingPw,   setIsSavingPw]    = useState(false);

  // Sync state when store loads
  useEffect(() => {
    if (!currentStore) return;
    setFormData({
      name:            currentStore.name            || '',
      description:     currentStore.description     || '',
      primary_color:   currentStore.primary_color   || '#F97316',
      secondary_color: currentStore.secondary_color || '#FED7AA',
      logo_url:        currentStore.logo_url        || '',
      banner_url:      currentStore.banner_url      || '',
    });
    setPaymentSettings({
      payment_method:        currentStore.payment_method        || 'paystack',
      direct_bank_name:      currentStore.direct_bank_name      || '',
      direct_account_number: currentStore.direct_account_number || '',
      direct_account_name:   currentStore.direct_account_name   || '',
      cod_enabled:           currentStore.cod_enabled            || false,
    });
    setSocialData({
      instagram:      currentStore.social_links?.instagram  || '',
      facebook:       currentStore.social_links?.facebook   || '',
      twitter:        currentStore.social_links?.twitter    || '',
      tiktok:         currentStore.social_links?.tiktok     || '',
      whatsapp:       currentStore.social_links?.whatsapp   || '',
      youtube:        currentStore.social_links?.youtube    || '',
      group_chat_url: currentStore.group_chat_url           || '',
    });
  }, [currentStore]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSaveGeneral = async () => {
    if (!currentStore?.id) return;
    setIsLoading(true);
    const result = await updateStore(currentStore.id, formData);
    if (result.success) toast.success('Settings saved');
    else toast.error(result.error || 'Failed to save');
    setIsLoading(false);
  };

  const handleSavePayment = async () => {
    if (!currentStore?.id) return;
    if (paymentSettings.payment_method === 'direct_transfer') {
      if (!paymentSettings.direct_bank_name || !paymentSettings.direct_account_number || !paymentSettings.direct_account_name) {
        toast.error('Please fill in all bank account details'); return;
      }
      if (paymentSettings.direct_account_number.length < 10) {
        toast.error('Please enter a valid 10-digit account number'); return;
      }
    }
    const updates = {
      ...paymentSettings,
      cod_enabled: paymentSettings.payment_method === 'direct_transfer' ? paymentSettings.cod_enabled : false,
    };
    setIsSavingPayment(true);
    const result = await updateStore(currentStore.id, updates);
    if (result.success) toast.success('Payment settings saved');
    else toast.error(result.error || 'Failed to save payment settings');
    setIsSavingPayment(false);
  };

  const handleSaveSocial = async () => {
    if (!currentStore?.id) return;
    setIsSavingSocial(true);
    const { group_chat_url, ...links } = socialData;
    // Strip empty strings so only populated links are stored
    const social_links = Object.fromEntries(
      Object.entries(links).filter(([, v]) => v.trim() !== '')
    );
    const result = await updateStore(currentStore.id, {
      social_links,
      group_chat_url: group_chat_url.trim() || null,
    } as any);
    if (result.success) toast.success('Social links saved');
    else toast.error(result.error || 'Failed to save social links');
    setIsSavingSocial(false);
  };

  const pwRequirements = [
    { label: 'At least 8 characters',    met: passwordData.newPassword.length >= 8 },
    { label: 'Contains uppercase letter', met: /[A-Z]/.test(passwordData.newPassword) },
    { label: 'Contains number',           met: /[0-9]/.test(passwordData.newPassword) },
    { label: 'Contains special character',met: /[!@#$%^&*]/.test(passwordData.newPassword) },
  ];
  const allPwMet = pwRequirements.every(r => r.met);

  const handleChangePassword = async () => {
    if (!user?.email) return;
    if (!passwordData.currentPassword) { toast.error('Enter your current password'); return; }
    if (!allPwMet) { toast.error('New password does not meet requirements'); return; }
    if (passwordData.newPassword !== passwordData.confirmPassword) { toast.error('Passwords do not match'); return; }

    setIsSavingPw(true);
    // Verify old password by re-signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: passwordData.currentPassword,
    });
    if (signInError) {
      toast.error('Current password is incorrect');
      setIsSavingPw(false);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: passwordData.newPassword });
    if (updateError) {
      toast.error(updateError.message || 'Failed to update password');
    } else {
      toast.success('Password updated successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });

      // Send branded confirmation email via Resend
      await supabase.functions.invoke('send-email', {
        body: {
          to: user.email,
          subject: 'Your QAFRICA password was changed',
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <div style="background:#F97316;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:inline-block;">
                <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
              </div>
              <h2 style="color:#111827;margin:0 0 8px;">Password Changed</h2>
              <p style="color:#6B7280;margin:0 0 20px;">
                Hi ${user.full_name || 'there'}, your QAFRICA account password was just successfully updated.
              </p>
              <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0;font-size:14px;color:#374151;">
                  <strong>If you did not make this change</strong>, your account may be compromised. 
                  Please reset your password immediately or contact support.
                </p>
              </div>
              <a href="${window.location.origin}/forgot-password"
                 style="display:inline-block;background:#F97316;color:#fff;padding:12px 24px;border-radius:10px;font-weight:700;text-decoration:none;font-size:14px;">
                Reset Password →
              </a>
              <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">
                © ${new Date().getFullYear()} QAFRICA. If you made this change, you can safely ignore this email.
              </p>
            </div>
          `,
        },
      }).catch(() => {
        // Non-fatal — password was changed successfully regardless
        console.error('Failed to send password change email');
      });
    }
    setIsSavingPw(false);
  };

  // ── Store URL helper ───────────────────────────────────────────────────────
  const getStoreUrlDisplay = () => {
    if (currentStore?.custom_domain && currentStore?.domain_status === 'connected' && domainRequest?.admin_approved) {
      return { url: `https://${currentStore.custom_domain}`, display: currentStore.custom_domain, status: 'active', badge: 'Live Domain' };
    }
    if (currentStore?.custom_domain && currentStore?.domain_status === 'pending' && domainRequest?.domain_name && !domainRequest?.admin_approved) {
      return { url: `/${currentStore.slug}`, display: `qafrica.store/${currentStore.slug}`, status: 'pending', badge: 'Pending Approval', pendingDomain: domainRequest.domain_name };
    }
    return { url: `/${currentStore?.slug}`, display: `qafrica.store/${currentStore?.slug}`, status: 'default', badge: 'Default URL' };
  };
  const urlInfo = getStoreUrlDisplay();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>
        <p className="text-gray-500 mt-1">Manage your store preferences</p>
      </div>

      {/* Tab Nav */}
      <div className="flex items-center flex-wrap gap-0 border-b border-gray-200">
        {TABS.map((tab, i) => (
          <div key={tab.id} className="flex items-center">
            {i > 0 && <span className="text-gray-300 text-sm px-1 select-none">|</span>}
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >

          {/* ── GENERAL ── */}
          {activeTab === 'general' && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Store className="w-5 h-5 text-orange-500" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">General</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Store Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="input-custom" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="input-custom min-h-[100px]" />
                </div>
              </div>

              {/* Store URL */}
              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${urlInfo.status === 'active' ? 'bg-green-100' : urlInfo.status === 'pending' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                    {urlInfo.status === 'active' ? <Globe className="w-4 h-4 text-green-500" /> : urlInfo.status === 'pending' ? <Clock className="w-4 h-4 text-yellow-500" /> : <Link2 className="w-4 h-4 text-blue-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Store URL</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${urlInfo.status === 'active' ? 'bg-green-100 text-green-800' : urlInfo.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>{urlInfo.badge}</span>
                  </div>
                </div>
                <div className={`flex items-center gap-3 p-3 rounded-lg text-sm ${urlInfo.status === 'active' ? 'bg-green-50 border border-green-200' : urlInfo.status === 'pending' ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50 border border-gray-200'}`}>
                  <span className="text-gray-900 font-medium">{urlInfo.display}</span>
                  {urlInfo.status === 'active' && <a href={urlInfo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 ml-auto text-xs">Visit Store →</a>}
                </div>
                {urlInfo.status === 'pending' && (urlInfo as any).pendingDomain && (
                  <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-orange-700">Domain <strong>{(urlInfo as any).pendingDomain}</strong> is awaiting admin approval. Your store is accessible via the default URL until then.</p>
                  </div>
                )}
                {urlInfo.status === 'default' && (
                  <p className="mt-3 text-xs text-gray-500">Set up a custom domain from the <a href="/dashboard/domain" className="text-orange-600 underline">Custom Domain</a> section.</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveGeneral} disabled={isLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
                </Button>
              </div>
            </div>
          )}

          {/* ── IMAGES ── */}
          {activeTab === 'images' && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-pink-500" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Store Images</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Store Logo</label>
                  <SingleImageUpload bucket="store-logos" folder={currentStore?.id || 'general'} value={formData.logo_url} onChange={url => setFormData({ ...formData, logo_url: url as string })} placeholder="Upload Logo" />
                  <p className="text-xs text-gray-500 mt-2">Recommended: 400×400px</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Store Banner</label>
                  <SingleImageUpload bucket="store-banners" folder={currentStore?.id || 'general'} value={formData.banner_url} onChange={url => setFormData({ ...formData, banner_url: url as string })} placeholder="Upload Banner" />
                  <p className="text-xs text-gray-500 mt-2">Recommended: 1200×400px</p>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveGeneral} disabled={isLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Images</>}
                </Button>
              </div>
            </div>
          )}

          {/* ── BRANDING ── */}
          {activeTab === 'branding' && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Palette className="w-5 h-5 text-purple-500" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={formData.primary_color} onChange={e => setFormData({ ...formData, primary_color: e.target.value })} className="w-12 h-12 rounded-lg cursor-pointer" />
                    <input type="text" value={formData.primary_color} onChange={e => setFormData({ ...formData, primary_color: e.target.value })} className="input-custom flex-1" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray.700 mb-2">Secondary Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={formData.secondary_color} onChange={e => setFormData({ ...formData, secondary_color: e.target.value })} className="w-12 h-12 rounded-lg cursor-pointer" />
                    <input type="text" value={formData.secondary_color} onChange={e => setFormData({ ...formData, secondary_color: e.target.value })} className="input-custom flex-1" />
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Moon className="w-5 h-5 text-indigo-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">Appearance</p>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Dark Mode</p>
                    <p className="text-xs text-gray-500">Toggle between light and dark theme for your dashboard</p>
                  </div>
                  <DarkModeToggle />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveGeneral} disabled={isLoading} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Branding</>}
                </Button>
              </div>
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {activeTab === 'payments' && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
                  <p className="text-sm text-gray-500">Control how customers pay in your store</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <button onClick={() => setPaymentSettings(p => ({ ...p, payment_method: 'paystack', cod_enabled: false }))} className={`p-4 rounded-xl border-2 text-left transition-all ${paymentSettings.payment_method === 'paystack' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900 text-sm">Paystack (Recommended)</span>
                  </div>
                  <p className="text-xs text-gray-500">Card, bank transfer, USSD. Funds held in escrow — buyer protected.</p>
                </button>
                <button onClick={() => setPaymentSettings(p => ({ ...p, payment_method: 'direct_transfer' }))} className={`p-4 rounded-xl border-2 text-left transition-all ${paymentSettings.payment_method === 'direct_transfer' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Banknote className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-gray-900 text-sm">Direct Bank Transfer</span>
                  </div>
                  <p className="text-xs text-gray-500">Customers pay directly to your account. No platform escrow.</p>
                </button>
              </div>

              {paymentSettings.payment_method === 'direct_transfer' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800 space-y-1">
                      <p className="font-semibold">Understand the limitations:</p>
                      <ul className="space-y-1 text-amber-700 list-disc list-inside text-xs">
                        <li>Customers shopping across multiple stores may be discouraged from paying all at once</li>
                        <li>No escrow protection — disputes cannot be auto-resolved</li>
                        <li>Dropshipped items always require Paystack regardless of this setting</li>
                        <li>You are responsible for confirming payments manually</li>
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-700">Your Bank Account Details</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                      <input type="text" value={paymentSettings.direct_bank_name} onChange={e => setPaymentSettings(p => ({ ...p, direct_bank_name: e.target.value }))} className="input-custom" placeholder="e.g. GTBank, Access Bank" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                      <input type="text" value={paymentSettings.direct_account_number} onChange={e => setPaymentSettings(p => ({ ...p, direct_account_number: e.target.value.replace(/\D/g, '').slice(0, 10) }))} className="input-custom font-mono tracking-widest" placeholder="0123456789" maxLength={10} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                      <input type="text" value={paymentSettings.direct_account_name} onChange={e => setPaymentSettings(p => ({ ...p, direct_account_name: e.target.value }))} className="input-custom" placeholder="John Doe" />
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Enable Cash on Delivery</p>
                      <p className="text-xs text-gray-500 mt-0.5">Only for direct transfer. Recommended only if you personally handle deliveries.</p>
                    </div>
                    <button onClick={() => setPaymentSettings(p => ({ ...p, cod_enabled: !p.cod_enabled }))} className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${paymentSettings.cod_enabled ? 'bg-orange-500' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${paymentSettings.cod_enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button onClick={handleSavePayment} disabled={isSavingPayment} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
                  {isSavingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Payment Settings'}
                </Button>
              </div>
            </div>
          )}

          {/* ── SOCIAL ── */}
          {activeTab === 'social' && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                  <Globe className="w-5 h-5 text-sky-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Social Links</h2>
                  <p className="text-sm text-gray-500">Only links you fill in will appear in your store footer</p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'instagram', label: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/yourstore', color: 'text-pink-500' },
                  { key: 'facebook',  label: 'Facebook',  icon: Facebook,  placeholder: 'https://facebook.com/yourstore', color: 'text-blue-600' },
                  { key: 'twitter',   label: 'X (Twitter)', icon: Twitter, placeholder: 'https://x.com/yourstore', color: 'text-gray-800' },
                  { key: 'tiktok',    label: 'TikTok',    icon: MessageCircle, placeholder: 'https://tiktok.com/@yourstore', color: 'text-gray-900' },
                  { key: 'whatsapp',  label: 'WhatsApp',  icon: Phone,     placeholder: 'https://wa.me/2348012345678', color: 'text-green-500' },
                  { key: 'youtube',   label: 'YouTube',   icon: Youtube,   placeholder: 'https://youtube.com/@yourstore', color: 'text-red-500' },
                ].map(({ key, label, icon: Icon, placeholder, color }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                      <input
                        type="url"
                        value={socialData[key as keyof typeof socialData]}
                        onChange={e => setSocialData(prev => ({ ...prev, [key]: e.target.value }))}
                        className="input-custom text-sm"
                        placeholder={placeholder}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Group Chat */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Group Chat Link</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    When dropshippers import your products, they'll see an option to join your group chat for promotional content, videos, and updates.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-4 h-4 text-orange-500" />
                  </div>
                  <input
                    type="url"
                    value={socialData.group_chat_url}
                    onChange={e => setSocialData(prev => ({ ...prev, group_chat_url: e.target.value }))}
                    className="input-custom flex-1 text-sm"
                    placeholder="https://chat.whatsapp.com/... or t.me/..."
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveSocial} disabled={isSavingSocial} className="bg-orange-500 hover:bg-orange-600 text-white px-8">
                  {isSavingSocial ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save Social Links</>}
                </Button>
              </div>
            </div>
          )}

          {/* ── PASSWORD ── */}
          {activeTab === 'password' && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Lock className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
                  <p className="text-sm text-gray-500">You'll need your current password to make changes</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                  <div className="relative">
                    <input type={showCurrentPw ? 'text' : 'password'} value={passwordData.currentPassword} onChange={e => setPasswordData(p => ({ ...p, currentPassword: e.target.value }))} className="input-custom pr-12" placeholder="Enter current password" />
                    <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <div className="relative">
                    <input type={showNewPw ? 'text' : 'password'} value={passwordData.newPassword} onChange={e => setPasswordData(p => ({ ...p, newPassword: e.target.value }))} className="input-custom pr-12" placeholder="Create a strong password" />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Requirements */}
                {passwordData.newPassword && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {pwRequirements.map((req, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle className={`w-4 h-4 ${req.met ? 'text-green-500' : 'text-gray-300'}`} />
                        <span className={`text-xs ${req.met ? 'text-green-600' : 'text-gray-500'}`}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                  <div className="relative">
                    <input type={showConfirmPw ? 'text' : 'password'} value={passwordData.confirmPassword} onChange={e => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))} className="input-custom pr-12" placeholder="Confirm your new password" />
                    <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={isSavingPw || !passwordData.currentPassword || !allPwMet || passwordData.newPassword !== passwordData.confirmPassword}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8"
                >
                  {isSavingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4 mr-2" />Update Password</>}
                </Button>
              </div>
            </div>
          )}

          {/* ── STAFF ── */}
          {activeTab === 'staff' && (
            <StaffTab
              storeId={currentStore?.id ?? ''}
              ownerId={user?.id ?? ''}
              ownerEmail={user?.email ?? ''}
              storeName={currentStore?.name ?? ''}
            />
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
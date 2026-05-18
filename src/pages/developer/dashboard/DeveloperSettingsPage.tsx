// src/pages/developer/dashboard/DeveloperSettingsPage.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User, Building2, Globe, Phone, FileText, Save,
  CreditCard, Check, AlertTriangle, ExternalLink,
  Loader2, LogOut, Trash2, Shield, ChevronDown,
} from 'lucide-react';
import { useDeveloperAuthStore } from '@/stores/developerAuthStore';
import {
  developerProfileService,
  developerPaystackService,
} from '@/services/developer';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// ── Shared input ──────────────────────────────────────────────
function Field({
  label, value, onChange, type = 'text', placeholder,
  hint, readOnly, icon: Icon,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
  readOnly?: boolean; icon?: React.ElementType;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full h-11 rounded-xl border text-sm text-gray-900 placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
            transition-colors
            ${Icon ? 'pl-10' : 'pl-4'} pr-4
            ${readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-100' : 'bg-white border-gray-200'}`}
        />
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

function SectionCard({
  title, description, children,
}: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

const PLATFORM_TYPES = [
  { value: '',             label: 'Select type (optional)' },
  { value: 'ecommerce',   label: 'E-commerce Website' },
  { value: 'mobile_app',  label: 'Mobile Application' },
  { value: 'pos',         label: 'Point of Sale (POS)' },
  { value: 'marketplace', label: 'Marketplace / Aggregator' },
  { value: 'erp',         label: 'ERP / Business Software' },
  { value: 'other',       label: 'Other' },
];

export default function DeveloperSettingsPage() {
  const navigate = useNavigate();
  const { developer, fetchProfile, logout } = useDeveloperAuthStore();

  // ── Profile form state ────────────────────────────────────────
  const [profile, setProfile] = useState({
    full_name:     '',
    phone:         '',
    company_name:  '',
    rc_number:     '',
    platform_name: '',
    platform_url:  '',
    platform_type: '',
  });
  const [profileDirty, setProfileDirty] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Paystack state ────────────────────────────────────────────
  const [paystackLoading,      setPaystackLoading]      = useState(false);
  const [disconnectConfirm,    setDisconnectConfirm]    = useState(false);
  const [disconnecting,        setDisconnecting]        = useState(false);

  // ── Danger zone ───────────────────────────────────────────────
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [loggingOut,    setLoggingOut]    = useState(false);

  // ── Populate form ─────────────────────────────────────────────
  useEffect(() => {
    if (developer) {
      setProfile({
        full_name:     developer.full_name,
        phone:         developer.phone ?? '',
        company_name:  developer.company_name ?? '',
        rc_number:     developer.rc_number ?? '',
        platform_name: developer.platform_name,
        platform_url:  developer.platform_url,
        platform_type: developer.platform_type ?? '',
      });
    }
  }, [developer]);

  function setField(key: string) {
    return (val: string) => {
      setProfile((p) => ({ ...p, [key]: val }));
      setProfileDirty(true);
    };
  }

  // ── Save profile ──────────────────────────────────────────────
  async function handleSaveProfile() {
    if (!profileDirty) return;
    setSavingProfile(true);
    try {
      await developerProfileService.updateProfile({
        full_name:     profile.full_name.trim(),
        phone:         profile.phone.trim() || undefined,
        company_name:  profile.company_name.trim() || undefined,
        rc_number:     profile.rc_number.trim() || undefined,
        platform_name: profile.platform_name.trim(),
        platform_url:  profile.platform_url.trim(),
        platform_type: profile.platform_type || undefined,
      });
      await fetchProfile();
      setProfileDirty(false);
      toast.success('Settings saved.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save settings.');
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Connect Paystack ──────────────────────────────────────────
  async function handleConnectPaystack() {
    setPaystackLoading(true);
    try {
      const { connect_url } = await developerPaystackService.getConnectUrl();
      sessionStorage.setItem('dev_paystack_from', 'settings');
      window.location.href = connect_url;
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to start Paystack Connect.');
    } finally {
      setPaystackLoading(false);
    }
  }

  // ── Disconnect Paystack ───────────────────────────────────────
  async function handleDisconnectPaystack() {
    setDisconnecting(true);
    try {
      await developerPaystackService.disconnect();
      await fetchProfile();
      setDisconnectConfirm(false);
      toast.success('Paystack account disconnected.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to disconnect.');
    } finally {
      setDisconnecting(false);
    }
  }

  // ── Logout ────────────────────────────────────────────────────
  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/developer/login', { replace: true });
    } catch {
      toast.error('Logout failed. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  if (!developer) return null;

  const isCompany = developer.account_type === 'company';

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account, platform, and integrations.</p>
      </div>

      {/* ── Identity ──────────────────────────────────────── */}
      <SectionCard
        title={isCompany ? 'Company & Contact' : 'Personal Information'}
        description="Your identity details on the QAFRICA developer platform."
      >
        <div className="space-y-4">
          {/* Read-only: email + account type */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Email address"
              value={developer.email}
              readOnly
              hint="Email cannot be changed."
            />
            <Field
              label="Account type"
              value={isCompany ? 'Company' : 'Individual'}
              readOnly
              icon={isCompany ? Building2 : User}
            />
          </div>

          <Field
            label="Full name"
            value={profile.full_name}
            onChange={setField('full_name')}
            placeholder="Your full name"
            icon={User}
          />

          <Field
            label="Phone number"
            value={profile.phone}
            onChange={setField('phone')}
            placeholder="+234 800 000 0000 (optional)"
            type="tel"
            icon={Phone}
          />

          {isCompany && (
            <>
              <Field
                label="Company name"
                value={profile.company_name}
                onChange={setField('company_name')}
                placeholder="Acme Technologies Ltd."
                icon={Building2}
              />
              <Field
                label="RC Number"
                value={profile.rc_number}
                onChange={setField('rc_number')}
                placeholder="RC1234567 (optional)"
                icon={FileText}
                hint="Your CAC registration number."
              />
            </>
          )}
        </div>
      </SectionCard>

      {/* ── Platform details ──────────────────────────────── */}
      <SectionCard
        title="Platform Details"
        description="Information about the platform you're integrating with QAFRICA."
      >
        <div className="space-y-4">
          <Field
            label="Platform name"
            value={profile.platform_name}
            onChange={setField('platform_name')}
            placeholder="ShopEase Nigeria"
            hint="The name of your app or website."
          />
          <Field
            label="Platform URL"
            value={profile.platform_url}
            onChange={setField('platform_url')}
            placeholder="https://shopease.ng"
            type="url"
            icon={Globe}
            hint="Must start with https://."
          />

          {/* Platform type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Platform type
            </label>
            <div className="relative">
              <select
                value={profile.platform_type}
                onChange={(e) => setField('platform_type')(e.target.value)}
                className="w-full h-11 pl-4 pr-10 rounded-xl border border-gray-200 text-sm text-gray-900
                  focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500
                  bg-white appearance-none transition-colors"
              >
                {PLATFORM_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveProfile}
            disabled={!profileDirty || savingProfile}
            className="h-10 px-6 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed
              text-white font-semibold rounded-xl transition-colors flex items-center gap-2 text-sm"
          >
            {savingProfile
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              : <><Save className="w-4 h-4" /> Save changes</>
            }
          </button>
        </div>
      </SectionCard>

      {/* ── Paystack Connect ──────────────────────────────── */}
      <SectionCard
        title="Paystack Integration"
        description="Connect your Paystack account to receive automatic commission payouts."
      >
        {developer.paystack_connected ? (
          <div className="space-y-4">
            {/* Connected status */}
            <div className="flex items-center gap-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Check className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-800">Paystack account connected</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Subaccount: <span className="font-mono">{developer.paystack_subaccount_code ?? '—'}</span>
                </p>
              </div>
            </div>

            {/* Split info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-400 mb-1">Your share</p>
                <p className="font-bold text-gray-900 text-lg">92%</p>
                <p className="text-xs text-gray-500">of dropship price</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-400 mb-1">QAFRICA fee</p>
                <p className="font-bold text-gray-900 text-lg">8%</p>
                <p className="text-xs text-gray-500">platform fee</p>
              </div>
            </div>

            {/* Disconnect */}
            {!disconnectConfirm ? (
              <button
                onClick={() => setDisconnectConfirm(true)}
                className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
              >
                Disconnect Paystack account
              </button>
            ) : (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm font-semibold text-red-800 mb-1">Are you sure?</p>
                <p className="text-xs text-red-600 mb-3">
                  Disconnecting will prevent you from creating new orders via the API until you reconnect.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDisconnectPaystack}
                    disabled={disconnecting}
                    className="h-9 px-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Yes, disconnect
                  </button>
                  <button
                    onClick={() => setDisconnectConfirm(false)}
                    className="h-9 px-4 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">Not connected</p>
                <p className="text-xs text-yellow-700 mt-0.5">
                  You won't be able to create orders via the API until you connect.
                </p>
              </div>
            </div>

            <button
              onClick={handleConnectPaystack}
              disabled={paystackLoading}
              className="h-11 px-6 bg-[#01C6C6] hover:bg-[#00b3b3] disabled:opacity-60
                text-white font-semibold rounded-xl transition-colors flex items-center gap-2 text-sm"
            >
              {paystackLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>
                : <><ExternalLink className="w-4 h-4" /> Connect Paystack account</>
              }
            </button>
          </div>
        )}
      </SectionCard>

      {/* ── Security ──────────────────────────────────────── */}
      <SectionCard
        title="Security"
        description="Manage your account access."
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
                <Shield className="w-4 h-4 text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Password</p>
                <p className="text-xs text-gray-400">Change your account password</p>
              </div>
            </div>
            <a
              href={`/developer/forgot-password?email=${encodeURIComponent(developer.email)}`}
              className="text-sm font-medium text-orange-600 hover:underline transition-colors"
            >
              Change
            </a>
          </div>

          <div className="flex items-center justify-between p-4 border border-gray-100 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${developer.email_verified ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <Check className={`w-4 h-4 ${developer.email_verified ? 'text-green-600' : 'text-yellow-600'}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Email verification</p>
                <p className="text-xs text-gray-400">
                  {developer.email_verified ? 'Your email is verified' : 'Email not verified yet'}
                </p>
              </div>
            </div>
            {!developer.email_verified && (
              <a
                href="/developer/verify-email"
                className="text-sm font-medium text-orange-600 hover:underline"
              >
                Verify
              </a>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Danger zone ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-red-100">
          <h2 className="font-semibold text-red-800">Danger zone</h2>
          <p className="text-sm text-red-600 mt-0.5">Irreversible actions — proceed with caution.</p>
        </div>
        <div className="p-6 space-y-4">
          {/* Sign out */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Sign out</p>
              <p className="text-xs text-gray-400">End your current developer session.</p>
            </div>
            {!logoutConfirm ? (
              <button
                onClick={() => setLogoutConfirm(true)}
                className="h-9 px-4 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="h-9 px-4 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {loggingOut ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Confirm
                </button>
                <button
                  onClick={() => setLogoutConfirm(false)}
                  className="h-9 px-4 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
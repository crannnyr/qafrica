// src/pages/recommendations/ImportSettingsSheet.tsx
// Settings menu for the importation dashboard: Account & Security (email +
// password), Address Management (full CRUD — the store already had this
// wired up, this is just the first UI for it), and Log Out.
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader, Eye, EyeOff, LogOut, MapPin, ShieldCheck,
  Plus, Trash2, Star, CheckCircle2, ChevronLeft,
} from 'lucide-react';
import { supabase } from '@/services';
import { useCustomerAuthStore } from '@/stores';
import type { CustomerAddress } from '@/types';
import { toast } from 'sonner';

type Panel = 'menu' | 'security' | 'addresses' | 'addressForm';

const emptyAddressDraft = {
  label: 'Home', name: '', phone: '',
  address_line1: '', address_line2: '', city: '', state: '', country: 'Nigeria', postal_code: '',
  is_default: false,
};

export default function ImportSettingsSheet({ onClose }: { onClose: () => void }) {
  const { customer, addresses, logout, fetchAddresses, addAddress, deleteAddress, setDefaultAddress } = useCustomerAuthStore();
  const [panel, setPanel] = useState<Panel>('menu');

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const handleLogout = async () => {
    await logout();
    onClose();
    window.location.href = '/recommendations';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28 }}
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {panel !== 'menu' && (
              <button onClick={() => setPanel(panel === 'addressForm' ? 'addresses' : 'menu')} className="p-1 hover:bg-gray-100 rounded-lg">
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
            )}
            <h2 className="font-bold text-gray-900 text-lg">
              {panel === 'menu' && 'Settings'}
              {panel === 'security' && 'Account & Security'}
              {panel === 'addresses' && 'Addresses'}
              {panel === 'addressForm' && 'Add address'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-xl">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {panel === 'menu' && (
            <motion.div key="menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              <p className="text-xs text-gray-400 px-1 mb-3">{customer?.email}</p>
              <MenuRow icon={ShieldCheck} label="Account & Security" sub="Email and password" onClick={() => setPanel('security')} />
              <MenuRow icon={MapPin} label="Addresses" sub={`${addresses.length} saved`} onClick={() => setPanel('addresses')} />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-red-100 bg-red-50 hover:bg-red-100 transition-colors mt-4"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span className="font-semibold text-sm text-red-600">Log out</span>
              </button>
            </motion.div>
          )}

          {panel === 'security' && <SecurityPanel key="security" />}

          {panel === 'addresses' && (
            <AddressesPanel
              key="addresses"
              addresses={addresses}
              onAdd={() => setPanel('addressForm')}
              onDelete={async (id) => {
                const res = await deleteAddress(id);
                if (res.success) toast.success('Address removed'); else toast.error(res.error ?? 'Could not remove address');
              }}
              onSetDefault={async (id) => {
                const res = await setDefaultAddress(id);
                if (res.success) toast.success('Default address updated'); else toast.error(res.error ?? 'Could not update');
              }}
            />
          )}

          {panel === 'addressForm' && (
            <AddressForm
              key="addressForm"
              onSaved={() => setPanel('addresses')}
              onSubmit={addAddress}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function MenuRow({ icon: Icon, label, sub, onClick }: { icon: any; label: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors text-left">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-800">{label}</p>
        <p className="text-[11px] text-gray-400">{sub}</p>
      </div>
    </button>
  );
}

// ── Account & Security ───────────────────────────────────────────────────
function SecurityPanel() {
  const { customer, fetchProfile } = useCustomerAuthStore();
  const [email, setEmail] = useState(customer?.email ?? '');
  const [isEmailSaving, setIsEmailSaving] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  const saveEmail = async () => {
    if (!email.trim() || email === customer?.email) return;
    setIsEmailSaving(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setIsEmailSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Check your new email to confirm the change.');
  };

  const passwordRequirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'Contains a number', met: /[0-9]/.test(newPassword) },
  ];
  const allMet = passwordRequirements.every(r => r.met);

  const savePassword = async () => {
    if (!allMet) { toast.error('Password does not meet requirements'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setIsPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsPasswordSaving(false);
    if (error) { toast.error(error.message); return; }
    setNewPassword(''); setConfirmPassword('');
    toast.success('Password updated');
    fetchProfile();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Email</p>
        <div className="flex gap-2">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none" />
          <button onClick={saveEmail} disabled={isEmailSaving || email === customer?.email}
            className="px-4 py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5">
            {isEmailSaving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">Changing your email requires confirming the new address before it takes effect.</p>
      </div>

      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Change password</p>
        <div className="space-y-2">
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} placeholder="New password" value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none" />
            <button type="button" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <input type={showPassword ? 'text' : 'password'} placeholder="Confirm new password" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none" />
          {newPassword && (
            <div className="space-y-1 px-1">
              {passwordRequirements.map(r => (
                <p key={r.label} className={`text-[11px] flex items-center gap-1.5 ${r.met ? 'text-emerald-600' : 'text-gray-400'}`}>
                  <CheckCircle2 className="w-3 h-3" /> {r.label}
                </p>
              ))}
            </div>
          )}
          <button onClick={savePassword} disabled={isPasswordSaving || !newPassword}
            className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
            {isPasswordSaving && <Loader className="w-4 h-4 animate-spin" />}
            Update password
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Addresses ─────────────────────────────────────────────────────────────
function AddressesPanel({ addresses, onAdd, onDelete, onSetDefault }: {
  addresses: CustomerAddress[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
      {addresses.length === 0 ? (
        <div className="text-center py-10">
          <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-1">No saved addresses yet</p>
          <p className="text-xs text-gray-300">Add one to speed up checkout next time.</p>
        </div>
      ) : (
        addresses.map(a => (
          <div key={a.id} className="p-3.5 rounded-xl border border-gray-100">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="font-semibold text-sm text-gray-800">{a.label || 'Address'} {a.is_default && (
                <span className="ml-1.5 text-[10px] font-bold bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded-full align-middle">Default</span>
              )}</p>
              <button onClick={() => onDelete(a.id)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              {a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ''}<br />
              {a.city}, {a.state}
            </p>
            {!a.is_default && (
              <button onClick={() => onSetDefault(a.id)} className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-gray-400 hover:text-orange-500">
                <Star className="w-3 h-3" /> Set as default
              </button>
            )}
          </div>
        ))
      )}
      <button onClick={onAdd}
        className="w-full py-3 border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-xl text-sm font-semibold text-gray-500 flex items-center justify-center gap-2 transition-colors">
        <Plus className="w-4 h-4" /> Add address
      </button>
    </motion.div>
  );
}

function AddressForm({ onSubmit, onSaved }: {
  onSubmit: (a: typeof emptyAddressDraft) => Promise<{ success: boolean; error?: string }>;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState(emptyAddressDraft);
  const [isSaving, setIsSaving] = useState(false);

  const set = (field: keyof typeof emptyAddressDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft(prev => ({ ...prev, [field]: e.target.value }));

  const canSave = draft.address_line1.trim() && draft.city.trim() && draft.state.trim() && draft.name.trim() && draft.phone.trim();

  const save = async () => {
    if (!canSave) return;
    setIsSaving(true);
    const res = await onSubmit(draft);
    setIsSaving(false);
    if (res.success) { toast.success('Address saved'); onSaved(); }
    else toast.error(res.error ?? 'Could not save address');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2.5">
      <input placeholder="Label (e.g. Home, Office)" value={draft.label} onChange={set('label')}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400" />
      <div className="grid grid-cols-2 gap-2.5">
        <input placeholder="Full name" value={draft.name} onChange={set('name')}
          className="px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400" />
        <input placeholder="Phone number" value={draft.phone} onChange={set('phone')}
          className="px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400" />
      </div>
      <input placeholder="Address line 1" value={draft.address_line1} onChange={set('address_line1')}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400" />
      <input placeholder="Address line 2 (optional)" value={draft.address_line2} onChange={set('address_line2')}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400" />
      <div className="grid grid-cols-2 gap-2.5">
        <input placeholder="City" value={draft.city} onChange={set('city')}
          className="px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400" />
        <input placeholder="State" value={draft.state} onChange={set('state')}
          className="px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400" />
      </div>
      <button onClick={save} disabled={isSaving || !canSave}
        className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 mt-1">
        {isSaving && <Loader className="w-4 h-4 animate-spin" />}
        Save address
      </button>
    </motion.div>
  );
}

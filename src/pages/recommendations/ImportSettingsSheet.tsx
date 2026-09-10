// src/pages/recommendations/ImportSettingsSheet.tsx
// Settings menu for the importation dashboard: Account & Security (email +
// password), Delivery Preference (default Home vs Jumia pickup + default
// station), Addresses (full CRUD), and Log Out.
//
// IMPORTANT: Addresses here use the import-specific import_customer_addresses
// table via the china-import edge function (my-addresses/save-address/
// delete-address/set-default-address) — NOT useCustomerAuthStore's
// addresses, which point at the marketplace's customer_addresses table and
// are invisible to the import checkout. This file used to call the store by
// mistake; an address saved from here silently never showed up at checkout.
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader, Eye, EyeOff, LogOut, MapPin, ShieldCheck,
  Plus, Trash2, Star, CheckCircle2, ChevronLeft, Home, Store, Zap, Search, Pencil, Tag,
} from 'lucide-react';
import { supabase } from '@/services';
import CONFIG from '@/lib/config';
import ConfirmEmailSheet from './ConfirmEmailSheet';
import { useCustomerAuthStore } from '@/stores';
import { toast } from 'sonner';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
const STATIONS_REST_URL = `${CONFIG.SUPABASE_URL}/rest/v1/pickup_stations`;

type Panel = 'menu' | 'security' | 'delivery' | 'addresses' | 'addressForm';

interface ImportAddress {
  id: string;
  label: string | null;
  name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  landmark: string | null;
  is_default: boolean;
}

interface PickupStation {
  id: string; name: string; state: string; address: string; landmark: string | null;
}

const emptyAddressDraft = {
  label: 'Home', name: '', phone: '',
  address_line1: '', address_line2: '', city: '', state: '', landmark: '',
  is_default: false,
};

export default function ImportSettingsSheet({ onClose }: { onClose: () => void }) {
  const { customer, logout } = useCustomerAuthStore();
  const [panel, setPanel] = useState<Panel>('menu');

  const [addresses, setAddresses] = useState<ImportAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [editingAddress, setEditingAddress] = useState<ImportAddress | null>(null);

  const fetchAddresses = async () => {
    setAddressesLoading(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=my-addresses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customer?.id }),
      });
      const data = await res.json();
      setAddresses(data.addresses ?? []);
    } finally {
      setAddressesLoading(false);
    }
  };

  useEffect(() => { if (customer?.id) fetchAddresses(); }, [customer?.id]);

  const saveAddress = async (draft: typeof emptyAddressDraft, id?: string) => {
    const res = await fetch(`${EDGE_URL}?action=save-address`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer?.id, id, ...draft }),
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error as string };
    await fetchAddresses();
    return { success: true };
  };

  const deleteAddress = async (id: string) => {
    const res = await fetch(`${EDGE_URL}?action=delete-address`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer?.id, id }),
    });
    if (!res.ok) { toast.error('Could not remove address'); return; }
    toast.success('Address removed');
    fetchAddresses();
  };

  const setDefaultAddress = async (id: string) => {
    const res = await fetch(`${EDGE_URL}?action=set-default-address`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customer?.id, id }),
    });
    if (!res.ok) { toast.error('Could not update'); return; }
    toast.success('Default address updated');
    fetchAddresses();
  };

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
              {panel === 'delivery' && 'Delivery preference'}
              {panel === 'addresses' && 'Addresses'}
              {panel === 'addressForm' && (editingAddress ? 'Edit address' : 'Add address')}
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
              <MenuRow icon={Zap} label="Delivery preference" sub="Default delivery method" onClick={() => setPanel('delivery')} />
              <MenuRow icon={MapPin} label="Addresses" sub={addressesLoading ? 'Loading…' : `${addresses.length} saved`} onClick={() => setPanel('addresses')} />
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

          {panel === 'delivery' && <DeliveryPrefsPanel key="delivery" customerId={customer?.id} />}

          {panel === 'addresses' && (
            <AddressesPanel
              key="addresses"
              addresses={addresses}
              loading={addressesLoading}
              onAdd={() => { setEditingAddress(null); setPanel('addressForm'); }}
              onEdit={(a) => { setEditingAddress(a); setPanel('addressForm'); }}
              onDelete={deleteAddress}
              onSetDefault={setDefaultAddress}
            />
          )}

          {panel === 'addressForm' && (
            <AddressForm
              key="addressForm"
              editing={editingAddress}
              onSaved={() => setPanel('addresses')}
              onSubmit={saveAddress}
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

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);

  // Email changes go through the same Resend-backed code flow as email
  // confirmation, rather than supabase.auth.updateUser({ email }).
  //
  // That call sent Supabase's "Email Change" template — a clickable link from
  // noreply@mail.app.supabase.io, which is where the magic links customers
  // received were coming from. It also left customers.email untouched, so the
  // auth record and the customer record could silently disagree, and it gave
  // the app two different ways to change an address.
  const [showConfirmEmail, setShowConfirmEmail] = useState(false);

  // Same length-first rules as the reset flow. These previously disagreed:
  // 8-plus-a-digit here, 10 characters there, so the strength demanded of a
  // password depended on which screen you happened to change it from.
  const COMMON_PASSWORDS = [
    'password', 'password1', 'password123', '12345678', '123456789', '1234567890',
    'qwerty123', 'qwertyuiop', 'iloveyou', 'admin123', 'letmein1', 'welcome1',
    'football1', 'monkey123', 'abc12345', 'passw0rd', 'sunshine1', 'princess1',
  ];
  const passwordRequirements = [
    { label: 'At least 10 characters', met: newPassword.length >= 10 },
    { label: 'Not a commonly used password',
      met: newPassword.length > 0 && !COMMON_PASSWORDS.includes(newPassword.trim().toLowerCase()) },
  ];
  const allMet = passwordRequirements.every(r => r.met);

  // Changing a password now requires the current one. Without re-authentication
  // anyone who reached an unlocked phone or a borrowed laptop with a live
  // session could take the account over silently — no email, no current
  // password, nothing. This is the standard bar for a signed-in password
  // change.
  const savePassword = async () => {
    if (!currentPassword) { toast.error('Enter your current password'); return; }
    if (!allMet) { toast.error('Password does not meet requirements'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    if (newPassword === currentPassword) { toast.error('Choose a password different from your current one'); return; }
    if (!customer?.email) { toast.error('Could not verify your account. Please sign in again.'); return; }

    setIsPasswordSaving(true);

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: customer.email,
      password: currentPassword,
    });
    if (reauthError) {
      setIsPasswordSaving(false);
      toast.error('That current password is not correct');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsPasswordSaving(false);
    if (error) {
      const raw = error.message?.toLowerCase() ?? '';
      if (raw.includes('pwned') || raw.includes('compromised') || raw.includes('breach')) {
        toast.error('That password has appeared in a known data breach. Please choose another.');
        return;
      }
      toast.error(error.message);
      return;
    }
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    toast.success('Password updated');
    fetchProfile();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
      {showConfirmEmail && <ConfirmEmailSheet onClose={() => setShowConfirmEmail(false)} />}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Email</p>
        <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
          <span className="text-sm text-gray-900 truncate">{customer?.email}</span>
          <span className="flex items-center gap-2 flex-shrink-0">
            {customer?.is_verified ? (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">Confirmed</span>
            ) : (
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5">Unconfirmed</span>
            )}
          </span>
        </div>
        <button
          onClick={() => setShowConfirmEmail(true)}
          className="mt-2 w-full py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {customer?.is_verified ? 'Change email' : 'Confirm or change email'}
        </button>
        <p className="text-[11px] text-gray-400 mt-1.5">We'll send a 6-digit code to the new address to confirm it's yours.</p>
      </div>

      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Change password</p>
        <div className="space-y-2">
          {/* Re-authentication. A signed-in session alone is not enough to
              take over an account. */}
          <input type="password" placeholder="Current password" value={currentPassword}
            autoComplete="current-password"
            onChange={e => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none" />
          <div className="relative">
            <input type={showPassword ? 'text' : 'password'} placeholder="New password" value={newPassword}
              autoComplete="new-password"
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
          <button onClick={savePassword} disabled={isPasswordSaving || !newPassword || !currentPassword}
            className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
            {isPasswordSaving && <Loader className="w-4 h-4 animate-spin" />}
            Update password
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Delivery preference ──────────────────────────────────────────────────
// Which delivery mode opens by default at checkout, and (if Jumia) which
// station is pre-selected. Backed by customers.import_default_delivery_mode
// / import_default_pickup_station_id via my-delivery-prefs / save-delivery-prefs.
function DeliveryPrefsPanel({ customerId }: { customerId?: string }) {
  const [mode, setMode] = useState<'home' | 'pickup_station'>('pickup_station');
  const [station, setStation] = useState<PickupStation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stations, setStations] = useState<PickupStation[]>([]);
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    fetch(`${EDGE_URL}?action=my-delivery-prefs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId }),
    })
      .then(res => res.json())
      .then(data => {
        setMode(data.default_delivery_mode ?? 'pickup_station');
        setStation(data.default_pickup_station ?? null);
      })
      .finally(() => setIsLoading(false));
  }, [customerId]);

  useEffect(() => {
    if (mode !== 'pickup_station' || stations.length > 0) return;
    fetch(`${STATIONS_REST_URL}?select=id,name,state,address,landmark&is_active=eq.true&order=state.asc`, {
      headers: { apikey: CONFIG.SUPABASE_ANON_KEY, Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}` },
    })
      .then(res => res.json())
      .then(data => setStations(Array.isArray(data) ? data : []))
      .catch(() => setStations([]));
  }, [mode, stations.length]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return stations.filter(s => `${s.name} ${s.address} ${s.landmark ?? ''} ${s.state}`.toLowerCase().includes(q)).slice(0, 25);
  }, [search, stations]);

  const save = async () => {
    if (mode === 'pickup_station' && !station) { toast.error('Pick a default station first'); return; }
    setIsSaving(true);
    const res = await fetch(`${EDGE_URL}?action=save-delivery-prefs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: customerId, default_delivery_mode: mode, default_pickup_station_id: station?.id }),
    });
    setIsSaving(false);
    if (res.ok) toast.success('Delivery preference saved');
    else toast.error('Could not save preference');
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader className="w-5 h-5 animate-spin text-gray-300" /></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
      <div className="flex items-start gap-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5">
        <Zap className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-orange-700 leading-relaxed">
          Jumia pickup stations are the fastest and cheapest way to get your orders — this is what your checkout opens with by default.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setMode('home')}
          className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${mode === 'home' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
          <Home className="w-4 h-4 text-gray-700 flex-shrink-0" />
          <p className="font-semibold text-gray-900 text-xs">Home address</p>
        </button>
        <button onClick={() => setMode('pickup_station')}
          className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors ${mode === 'pickup_station' ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
          <Store className="w-4 h-4 text-gray-700 flex-shrink-0" />
          <p className="font-semibold text-gray-900 text-xs">Jumia pickup</p>
        </button>
      </div>

      {mode === 'pickup_station' && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Default station</p>
          {station && !showPicker ? (
            <button onClick={() => setShowPicker(true)}
              className="w-full text-left p-3 rounded-xl border-2 border-gray-900 bg-gray-50 flex items-center gap-2.5">
              <Store className="w-4 h-4 text-gray-700 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{station.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{station.address}</p>
              </div>
              <Pencil className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            </button>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <input type="text" placeholder="Search stations by name or area…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="flex-1 min-w-0 text-sm outline-none" />
              </div>
              <div className="max-h-52 overflow-y-auto">
                {matches.length === 0 ? (
                  <p className="text-[11px] text-gray-400 text-center py-6 px-4">
                    {search.trim() ? 'No stations match yet — try a different search term.' : 'Start typing a city or area to see stations.'}
                  </p>
                ) : (
                  matches.map(s => (
                    <button key={s.id} onClick={() => { setStation(s); setShowPicker(false); setSearch(''); }}
                      className="w-full text-left px-3 py-2.5 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{s.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{s.address} · {s.state}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <button onClick={save} disabled={isSaving}
        className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
        {isSaving && <Loader className="w-4 h-4 animate-spin" />}
        Save preference
      </button>
    </motion.div>
  );
}

// ── Addresses ─────────────────────────────────────────────────────────────
function AddressesPanel({ addresses, loading, onAdd, onEdit, onDelete, onSetDefault }: {
  addresses: ImportAddress[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (a: ImportAddress) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}) {
  if (loading) {
    return <div className="flex justify-center py-10"><Loader className="w-5 h-5 animate-spin text-gray-300" /></div>;
  }
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
              <p className="font-semibold text-sm text-gray-800 flex items-center gap-1.5">
                <Tag className="w-3 h-3 text-gray-300" />
                {a.label || 'Address'} {a.is_default && (
                  <span className="text-[10px] font-bold bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded-full align-middle">Default</span>
                )}
              </p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => onEdit(a)} className="text-gray-300 hover:text-gray-600">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => onDelete(a.id)} className="text-gray-300 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
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

function AddressForm({ onSubmit, onSaved, editing }: {
  onSubmit: (a: typeof emptyAddressDraft, id?: string) => Promise<{ success: boolean; error?: string }>;
  onSaved: () => void;
  editing: ImportAddress | null;
}) {
  const [draft, setDraft] = useState(() => editing ? {
    label: editing.label ?? '', name: editing.name, phone: editing.phone,
    address_line1: editing.address_line1, address_line2: editing.address_line2 ?? '',
    city: editing.city, state: editing.state, landmark: editing.landmark ?? '',
    is_default: editing.is_default,
  } : emptyAddressDraft);
  const [isSaving, setIsSaving] = useState(false);

  const set = (field: keyof typeof emptyAddressDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft(prev => ({ ...prev, [field]: e.target.value }));

  const canSave = draft.address_line1.trim() && draft.city.trim() && draft.state.trim() && draft.name.trim() && draft.phone.trim();

  const save = async () => {
    if (!canSave) return;
    setIsSaving(true);
    const res = await onSubmit(draft, editing?.id);
    setIsSaving(false);
    if (res.success) { toast.success(editing ? 'Address updated' : 'Address saved'); onSaved(); }
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
      <input placeholder="Nearby landmark (optional)" value={draft.landmark} onChange={set('landmark')}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-400" />
      <label className="flex items-center gap-2 px-1 py-1">
        <input type="checkbox" checked={draft.is_default} onChange={e => setDraft(prev => ({ ...prev, is_default: e.target.checked }))}
          className="w-3.5 h-3.5 rounded border-gray-300" />
        <span className="text-[11px] text-gray-500">Make this my default address</span>
      </label>
      <button onClick={save} disabled={isSaving || !canSave}
        className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 disabled:opacity-30 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 mt-1">
        {isSaving && <Loader className="w-4 h-4 animate-spin" />}
        {editing ? 'Save changes' : 'Save address'}
      </button>
    </motion.div>
  );
}

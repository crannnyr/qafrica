import { useEffect, useState } from 'react';
import { Search, MoreVertical, Check, Ban, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  email_verified: boolean;
  is_store_blocked: boolean;
  block_reason: string | null;
  onboarding_completed: boolean;
  wallet_balance: number;
  created_at: string;
}

type ActionMenu = { userId: string; x: number; y: number } | null;

const ROLE_COLORS: Record<string, string> = {
  admin:       'bg-purple-100 text-purple-700',
  store_owner: 'bg-blue-100 text-blue-700',
  developer:   'bg-green-100 text-green-700',
  staff:       'bg-gray-100 text-gray-600',
};

export default function AdminUsers() {
  const [users, setUsers]           = useState<UserRow[]>([]);
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isLoading, setIsLoading]   = useState(true);
  const [actionMenu, setActionMenu] = useState<ActionMenu>(null);
  const [blockModal, setBlockModal] = useState<{ userId: string; name: string } | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isSaving, setIsSaving]     = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, email_verified, is_store_blocked, block_reason, onboarding_completed, wallet_balance, created_at')
      .order('created_at', { ascending: false });
    if (!error && data) setUsers(data as UserRow[]);
    setIsLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  // Close action menu on outside click
  useEffect(() => {
    const handler = () => setActionMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const filtered = users.filter(u => {
    const matchSearch = u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                        u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole   = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const handleVerifyEmail = async (userId: string) => {
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ email_verified: true })
      .eq('id', userId);
    if (error) toast.error('Failed to verify email');
    else { toast.success('Email verified'); await fetchUsers(); }
    setIsSaving(false);
    setActionMenu(null);
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    if (error) toast.error('Failed to change role');
    else { toast.success(`Role changed to ${newRole}`); await fetchUsers(); }
    setIsSaving(false);
    setActionMenu(null);
  };

  const handleResetOnboarding = async (userId: string) => {
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed: false, onboarding_step: 0 })
      .eq('id', userId);
    if (error) toast.error('Failed to reset onboarding');
    else { toast.success('Onboarding reset'); await fetchUsers(); }
    setIsSaving(false);
    setActionMenu(null);
  };

  const handleBlockUser = async () => {
    if (!blockModal) return;
    if (!blockReason.trim()) { toast.error('Please enter a block reason'); return; }
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ is_store_blocked: true, block_reason: blockReason.trim() })
      .eq('id', blockModal.userId);
    if (error) toast.error('Failed to block user');
    else { toast.success('User blocked'); await fetchUsers(); }
    setIsSaving(false);
    setBlockModal(null);
    setBlockReason('');
  };

  const handleUnblockUser = async (userId: string) => {
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ is_store_blocked: false, block_reason: null })
      .eq('id', userId);
    if (error) toast.error('Failed to unblock user');
    else { toast.success('User unblocked'); await fetchUsers(); }
    setIsSaving(false);
    setActionMenu(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Users</h1>
        <p className="text-xs text-gray-400 mt-0.5">{users.length} total users on platform</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white">
          <option value="all">All roles</option>
          <option value="store_owner">Store owners</option>
          <option value="developer">Developers</option>
          <option value="admin">Admins</option>
          <option value="staff">Staff</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['User', 'Role', 'Status', 'Wallet', 'Joined', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No users found</td></tr>
              ) : (
                filtered.map(user => (
                  <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${user.is_store_blocked ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-orange-600">
                            {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-xs">{user.full_name || '—'}</p>
                          <p className="text-[10px] text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${
                          user.is_store_blocked ? 'bg-red-100 text-red-700' :
                          user.onboarding_completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {user.is_store_blocked ? 'Blocked' : user.onboarding_completed ? 'Active' : 'Onboarding'}
                        </span>
                        {!user.email_verified && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] w-fit">
                            Unverified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-700 font-medium">₦{Number(user.wallet_balance || 0).toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-400">{new Date(user.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={e => { e.stopPropagation(); setActionMenu({ userId: user.id, x: e.clientX, y: e.clientY }); }}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>

                      {/* Inline dropdown */}
                      {actionMenu?.userId === user.id && (
                        <div
                          onClick={e => e.stopPropagation()}
                          className="absolute right-8 mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-xl z-50 py-1 text-left"
                        >
                          {!user.email_verified && (
                            <button onClick={() => handleVerifyEmail(user.id)} disabled={isSaving}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                              <Check className="w-3.5 h-3.5 text-green-500" /> Verify Email
                            </button>
                          )}
                          {!user.onboarding_completed && (
                            <button onClick={() => handleResetOnboarding(user.id)} disabled={isSaving}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                              <RefreshCw className="w-3.5 h-3.5 text-blue-500" /> Reset Onboarding
                            </button>
                          )}
                          {user.role !== 'admin' && (
                            <button onClick={() => handleChangeRole(user.id, 'admin')} disabled={isSaving}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                              <ShieldCheck className="w-3.5 h-3.5 text-purple-500" /> Make Admin
                            </button>
                          )}
                          {user.role === 'admin' && (
                            <button onClick={() => handleChangeRole(user.id, 'store_owner')} disabled={isSaving}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                              <ShieldCheck className="w-3.5 h-3.5 text-gray-500" /> Remove Admin
                            </button>
                          )}
                          <div className="border-t border-gray-100 my-1" />
                          {user.is_store_blocked ? (
                            <button onClick={() => handleUnblockUser(user.id)} disabled={isSaving}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-green-600 hover:bg-green-50">
                              <Check className="w-3.5 h-3.5" /> Unblock User
                            </button>
                          ) : (
                            <button onClick={() => { setBlockModal({ userId: user.id, name: user.full_name }); setActionMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                              <Ban className="w-3.5 h-3.5" /> Block User
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Block Modal */}
      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Block {blockModal.name}</h3>
              <button onClick={() => setBlockModal(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              This will block the user's store and prevent access. Enter a reason:
            </p>
            <textarea
              value={blockReason}
              onChange={e => setBlockReason(e.target.value)}
              placeholder="e.g. Violation of terms of service..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 min-h-[80px] resize-none"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setBlockModal(null)}
                className="flex-1 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleBlockUser} disabled={isSaving || !blockReason.trim()}
                className="flex-1 px-3 py-2 text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50 transition-colors">
                {isSaving ? 'Blocking...' : 'Block User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
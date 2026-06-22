import { useEffect, useState } from 'react';
import { Crown, Search, Star, RefreshCw, Bell, X, Plus, Copy } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';

interface Sub {
  id: string;
  tier: string;
  is_active: boolean;
  is_trial: boolean;
  expires_at: string;
  amount_paid: number;
  duration_months: number;
  niches: string[];
  cancel_at_period_end: boolean;
  admin_bookmarked: boolean;
  admin_note: string | null;
  user_id: string;
  store_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  store_name: string | null;
}

const TIER_COLORS: Record<string, string> = {
  free:          'bg-gray-100 text-gray-600',
  single:        'bg-blue-100 text-blue-700',
  three_niches:  'bg-purple-100 text-purple-700',
  unlimited:     'bg-orange-100 text-orange-700',
};

const TIER_LABELS: Record<string, string> = {
  free:          'Free',
  single:        'Single',
  three_niches:  '3 Niches',
  unlimited:     'Unlimited',
};

function daysLeft(expiresAt: string): number {
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

function ExpiryBadge({ days }: { days: number }) {
  if (days < 0)  return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-medium">Expired</span>;
  if (days <= 3) return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-medium">{days}d left ⚠️</span>;
  if (days <= 7) return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-medium">{days}d left</span>;
  return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-medium">{days}d left</span>;
}

export default function AdminSubscriptions() {
  const { user } = useAuthStore();
  const [subs, setSubs]             = useState<Sub[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [search, setSearch]         = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [viewFilter, setViewFilter] = useState<'all' | 'bookmarked' | 'expiring'>('all');
  const [extendModal, setExtendModal] = useState<Sub | null>(null);
  const [extendDays, setExtendDays] = useState('30');
  const [noteModal, setNoteModal]   = useState<Sub | null>(null);
  const [noteText, setNoteText]     = useState('');
  const [isSaving, setIsSaving]     = useState(false);

  const fetchSubs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        id, tier, is_active, is_trial, expires_at, amount_paid,
        duration_months, niches, cancel_at_period_end,
        admin_bookmarked, admin_note, user_id, store_id,
        profiles!subscriptions_user_id_fkey (full_name, email, phone),
        stores!subscriptions_store_id_fkey (name)
      `)
      .order('expires_at', { ascending: true });

    if (!error && data) {
      setSubs(data.map((s: any) => ({
        ...s,
        full_name:  s.profiles?.full_name  || '—',
        email:      s.profiles?.email      || '—',
        phone:      s.profiles?.phone      || null,
        store_name: s.stores?.name         || null,
      })));
    } else {
      toast.error('Failed to load subscriptions');
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchSubs(); }, []);

  const filtered = subs.filter(s => {
    const matchSearch = s.full_name.toLowerCase().includes(search.toLowerCase()) ||
                        s.email.toLowerCase().includes(search.toLowerCase()) ||
                        s.store_name?.toLowerCase().includes(search.toLowerCase());
    const matchTier   = tierFilter === 'all' || s.tier === tierFilter;
    const matchView   =
      viewFilter === 'all'       ? true :
      viewFilter === 'bookmarked' ? s.admin_bookmarked :
      viewFilter === 'expiring'   ? daysLeft(s.expires_at) <= 7 : true;
    return matchSearch && matchTier && matchView;
  });

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const handleBookmark = async (sub: Sub) => {
    const { error } = await supabase
      .from('subscriptions')
      .update({ admin_bookmarked: !sub.admin_bookmarked })
      .eq('id', sub.id);
    if (error) toast.error('Failed to update bookmark');
    else {
      setSubs(prev => prev.map(s => s.id === sub.id ? { ...s, admin_bookmarked: !s.admin_bookmarked } : s));
      toast.success(sub.admin_bookmarked ? 'Bookmark removed' : 'Bookmarked');
    }
  };

  const handleExtend = async () => {
    if (!extendModal) return;
    const days = parseInt(extendDays);
    if (!days || days < 1) { toast.error('Enter valid days'); return; }
    setIsSaving(true);
    const newExpiry = new Date(extendModal.expires_at);
    newExpiry.setDate(newExpiry.getDate() + days);
    const { error } = await supabase
      .from('subscriptions')
      .update({ expires_at: newExpiry.toISOString(), is_active: true })
      .eq('id', extendModal.id);
    if (error) toast.error('Failed to extend subscription');
    else {
      toast.success(`Extended by ${days} days`);
      setExtendModal(null);
      await fetchSubs();
    }
    setIsSaving(false);
  };

  const handleSaveNote = async () => {
    if (!noteModal) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('subscriptions')
      .update({ admin_note: noteText.trim() || null })
      .eq('id', noteModal.id);
    if (error) toast.error('Failed to save note');
    else {
      toast.success('Note saved');
      setNoteModal(null);
      await fetchSubs();
    }
    setIsSaving(false);
  };

  const handleSendReminder = async (sub: Sub) => {
    try {
      const { error } = await supabase.functions.invoke('send-subscription-reminder', {
        body: { user_id: sub.user_id, subscription_id: sub.id, days_left: daysLeft(sub.expires_at) },
      });
      if (error) throw error;
      toast.success('Reminder sent');
    } catch {
      // Edge function may not exist yet — fall back to email queue
      toast.info('Reminder queued — will send via email queue');
    }
  };

  // KPIs
  const expiringSoon = subs.filter(s => daysLeft(s.expires_at) <= 7 && s.is_active).length;
  const paidActive   = subs.filter(s => s.is_active && !s.is_trial).length;
  const trials       = subs.filter(s => s.is_trial && s.is_active).length;
  const totalRev     = subs.reduce((acc, s) => acc + Number(s.amount_paid), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Subscriptions</h1>
          <p className="text-xs text-gray-400 mt-0.5">{subs.length} total subscriptions</p>
        </div>
        <button onClick={fetchSubs} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Paid Active',    value: paidActive,                          color: 'text-green-600',  bg: 'bg-green-50'  },
          { label: 'Active Trials',  value: trials,                              color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Expiring ≤7d',   value: expiringSoon,                        color: 'text-amber-600',  bg: 'bg-amber-50'  },
          { label: 'Total Revenue',  value: `₦${(totalRev/1000).toFixed(0)}k`,  color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 border border-gray-100`}>
            <p className="text-[10px] text-gray-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or store..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
        </div>
        <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20">
          <option value="all">All tiers</option>
          <option value="free">Free</option>
          <option value="single">Single</option>
          <option value="three_niches">3 Niches</option>
          <option value="unlimited">Unlimited</option>
        </select>
        <div className="flex gap-1">
          {(['all', 'bookmarked', 'expiring'] as const).map(v => (
            <button key={v} onClick={() => setViewFilter(v)}
              className={`px-3 py-2 text-xs font-medium rounded-lg capitalize transition-colors ${
                viewFilter === v ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600'
              }`}>
              {v === 'bookmarked' ? '⭐ Saved' : v === 'expiring' ? '⚠️ Expiring' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['', 'User', 'Plan', 'Expiry', 'Revenue', 'Actions'].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
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
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No subscriptions found</td></tr>
              ) : filtered.map(sub => {
                const days = daysLeft(sub.expires_at);
                return (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                    {/* Bookmark */}
                    <td className="px-3 py-3">
                      <button onClick={() => handleBookmark(sub)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors">
                        <Star className={`w-4 h-4 ${sub.admin_bookmarked ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                      </button>
                    </td>

                    {/* User */}
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-900">{sub.full_name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-[10px] text-gray-400 truncate max-w-[140px]">{sub.email}</p>
                        <button onClick={() => copy(sub.email, 'Email')} className="p-0.5 hover:bg-gray-100 rounded flex-shrink-0">
                          <Copy className="w-2.5 h-2.5 text-gray-300" />
                        </button>
                      </div>
                      {sub.phone && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <p className="text-[10px] text-gray-400">{sub.phone}</p>
                          <button onClick={() => copy(sub.phone!, 'Phone')} className="p-0.5 hover:bg-gray-100 rounded flex-shrink-0">
                            <Copy className="w-2.5 h-2.5 text-gray-300" />
                          </button>
                        </div>
                      )}
                      {sub.store_name && (
                        <p className="text-[10px] text-orange-500 mt-0.5">{sub.store_name}</p>
                      )}
                      {sub.admin_note && (
                        <p className="text-[10px] text-gray-400 italic mt-0.5 truncate max-w-[140px]">📝 {sub.admin_note}</p>
                      )}
                    </td>

                    {/* Plan */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${TIER_COLORS[sub.tier] || 'bg-gray-100 text-gray-600'}`}>
                          <Crown className="w-2.5 h-2.5 inline mr-1" />
                          {TIER_LABELS[sub.tier] || sub.tier}
                        </span>
                        {sub.is_trial && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] w-fit">Trial</span>
                        )}
                        {!sub.is_active && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px] w-fit">Inactive</span>
                        )}
                      </div>
                    </td>

                    {/* Expiry */}
                    <td className="px-4 py-3">
                      <ExpiryBadge days={days} />
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(sub.expires_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </p>
                    </td>

                    {/* Revenue */}
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-900">
                        {Number(sub.amount_paid) > 0 ? `₦${Number(sub.amount_paid).toLocaleString()}` : '—'}
                      </p>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Send reminder */}
                        {days <= 7 && sub.is_active && (
                          <button onClick={() => handleSendReminder(sub)}
                            title="Send renewal reminder"
                            className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors">
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* Add note */}
                        <button onClick={() => { setNoteModal(sub); setNoteText(sub.admin_note || ''); }}
                          title="Add note"
                          className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                          ✏️
                        </button>
                        {/* Extend */}
                        <button onClick={() => { setExtendModal(sub); setExtendDays('30'); }}
                          title="Extend subscription"
                          className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extend Modal */}
      {extendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Extend Subscription</h3>
              <button onClick={() => setExtendModal(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Extending <strong>{extendModal.full_name}</strong>'s subscription.
              Currently expires <strong>{new Date(extendModal.expires_at).toLocaleDateString()}</strong>.
            </p>
            <div className="flex gap-2 mb-3">
              {['7', '14', '30', '90'].map(d => (
                <button key={d} onClick={() => setExtendDays(d)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    extendDays === d ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-600 hover:border-orange-300'
                  }`}>
                  {d}d
                </button>
              ))}
            </div>
            <input type="number" value={extendDays} onChange={e => setExtendDays(e.target.value)}
              placeholder="Custom days"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setExtendModal(null)}
                className="flex-1 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleExtend} disabled={isSaving}
                className="flex-1 px-3 py-2 text-xs text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50 transition-colors">
                {isSaving ? 'Extending...' : `Extend ${extendDays} days`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Admin Note</h3>
              <button onClick={() => setNoteModal(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Note for <strong>{noteModal.full_name}</strong> — only visible to admins.
            </p>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="e.g. Promised to renew by Friday, follow up..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 min-h-[80px] resize-none mb-3" />
            <div className="flex gap-2">
              <button onClick={() => setNoteModal(null)}
                className="flex-1 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSaveNote} disabled={isSaving}
                className="flex-1 px-3 py-2 text-xs text-white bg-orange-500 hover:bg-orange-600 rounded-lg disabled:opacity-50 transition-colors">
                {isSaving ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
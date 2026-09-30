import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Power, RefreshCw, Tag, X } from 'lucide-react';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import-promotions`;

type Promotion = {
  id: string;
  code: string;
  name: string | null;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  minimum_order_ngn: number;
  maximum_discount_ngn: number | null;
  usage_limit: number | null;
  usage_count: number;
  per_customer_limit: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
};

type Form = Omit<Promotion, 'id' | 'usage_count'>;

const emptyForm: Form = {
  code: '', name: '', description: '', discount_type: 'percentage', discount_value: 10,
  minimum_order_ngn: 0, maximum_discount_ngn: null, usage_limit: null,
  per_customer_limit: null, starts_at: null, expires_at: null, is_active: true,
};

function money(value: number | null) {
  if (value == null) return '—';
  return `₦${Number(value).toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}

function toDatetimeLocal(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ChinaImportPromotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const managerToken = getManagementToken();
      if (!managerToken) throw new Error('Management session expired');
      const res = await fetch(`${EDGE_URL}?action=admin-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: managerToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load promotions');
      setPromotions(data.promotions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load promotions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return promotions;
    return promotions.filter(p => `${p.code} ${p.name ?? ''}`.toLowerCase().includes(q));
  }, [promotions, search]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError('');
  };

  const openEdit = (p: Promotion) => {
    setEditingId(p.id);
    setForm({
      code: p.code, name: p.name ?? '', description: p.description ?? '',
      discount_type: p.discount_type, discount_value: p.discount_value,
      minimum_order_ngn: p.minimum_order_ngn, maximum_discount_ngn: p.maximum_discount_ngn,
      usage_limit: p.usage_limit, per_customer_limit: p.per_customer_limit,
      starts_at: p.starts_at, expires_at: p.expires_at, is_active: p.is_active,
    });
    setShowForm(true);
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const managerToken = getManagementToken();
      if (!managerToken) throw new Error('Management session expired');
      const payload = {
        ...form,
        id: editingId ?? undefined,
        manager_token: managerToken,
        code: form.code.trim().toUpperCase(),
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };
      const res = await fetch(`${EDGE_URL}?action=admin-upsert`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not save promotion');
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save promotion');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: Promotion) => {
    setError('');
    try {
      const managerToken = getManagementToken();
      if (!managerToken) throw new Error('Management session expired');
      const res = await fetch(`${EDGE_URL}?action=admin-toggle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: managerToken, id: p.id, is_active: !p.is_active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not update promotion');
      setPromotions(prev => prev.map(x => x.id === p.id ? data.promotion : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update promotion');
    }
  };

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">China Import Promotions</h1>
        <p className="text-sm text-gray-500 mt-1">Promo codes for /recommendations only. Storefront coupons are not used here.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-end gap-2">
          <button onClick={() => void load()} disabled={loading} className="p-2 hover:bg-gray-100 rounded-lg" title="Refresh promotions" aria-label="Refresh promotions">
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold">
            <Plus className="w-3.5 h-3.5" /> New promo
          </button>
        </div>

        {error && <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">{error}</div>}

        <div className="px-5 py-3 border-b border-gray-100">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search promo code or name…" className="w-full max-w-md px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-bold">Code</th><th className="px-4 py-3 font-bold">Discount</th><th className="px-4 py-3 font-bold">Minimum</th><th className="px-4 py-3 font-bold">Usage</th><th className="px-4 py-3 font-bold">Validity</th><th className="px-4 py-3 font-bold">Status</th><th className="px-4 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center"><RefreshCw className="w-5 h-5 text-orange-500 animate-spin mx-auto" /></td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3"><div className="font-semibold text-sm text-gray-900">{p.code}</div><div className="text-[10px] text-gray-400">{p.name ?? '—'}</div></td>
                  <td className="px-4 py-3 text-xs font-semibold text-gray-800">{p.discount_type === 'percentage' ? `${p.discount_value}%` : money(p.discount_value)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{money(p.minimum_order_ngn)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.usage_count}{p.usage_limit == null ? '' : ` / ${p.usage_limit}`}</td>
                  <td className="px-4 py-3 text-[10px] text-gray-500">{p.starts_at ? new Date(p.starts_at).toLocaleString() : 'Now'}<br />{p.expires_at ? new Date(p.expires_at).toLocaleString() : 'No expiry'}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-[9px] font-bold ${p.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>{p.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1"><button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title="Edit"><Pencil className="w-3.5 h-3.5" /></button><button onClick={() => void toggle(p)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" title={p.is_active ? 'Deactivate' : 'Activate'}><Power className="w-3.5 h-3.5" /></button></div></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">No China Import promotions found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between"><h2 className="font-bold text-lg">{editingId ? 'Edit promotion' : 'Create promotion'}</h2><button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm">Code<input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="IMPORT10" /></label>
              <label className="text-sm">Name<input value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="10% Import Discount" /></label>
              <label className="text-sm">Discount type<select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as Form['discount_type'] }))} className="mt-1 w-full border rounded-lg px-3 py-2"><option value="percentage">Percentage</option><option value="fixed">Fixed NGN</option></select></label>
              <label className="text-sm">Discount value<input type="number" min="0" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: Number(e.target.value) }))} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
              <label className="text-sm">Minimum order NGN<input type="number" min="0" value={form.minimum_order_ngn} onChange={e => setForm(f => ({ ...f, minimum_order_ngn: Number(e.target.value) }))} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
              <label className="text-sm">Maximum discount NGN<input type="number" min="0" value={form.maximum_discount_ngn ?? ''} onChange={e => setForm(f => ({ ...f, maximum_discount_ngn: e.target.value === '' ? null : Number(e.target.value) }))} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
              <label className="text-sm">Total usage limit<input type="number" min="1" value={form.usage_limit ?? ''} onChange={e => setForm(f => ({ ...f, usage_limit: e.target.value === '' ? null : Number(e.target.value) }))} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
              <label className="text-sm">Per customer limit<input type="number" min="1" value={form.per_customer_limit ?? ''} onChange={e => setForm(f => ({ ...f, per_customer_limit: e.target.value === '' ? null : Number(e.target.value) }))} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
              <label className="text-sm">Starts at<input type="datetime-local" value={toDatetimeLocal(form.starts_at)} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value || null }))} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
              <label className="text-sm">Expires at<input type="datetime-local" value={toDatetimeLocal(form.expires_at)} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value || null }))} className="mt-1 w-full border rounded-lg px-3 py-2" /></label>
            </div>
            <label className="text-sm block">Description<textarea value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2" rows={3} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />Active</label>
            <div className="flex justify-end gap-2"><button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border">Cancel</button><button disabled={saving} onClick={save} className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold">{saving ? 'Saving…' : 'Save promotion'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Loader, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
type PackageSize = 'small' | 'medium' | 'large';
type Rule = { package_size: PackageSize; max_weight_grams: number | null; max_volume_cbm: number | null; is_configured: boolean };
type Rate = { destination_state: string; package_size: PackageSize; fee_ngn: number; is_active: boolean; source_note: string };

const blankRules: Rule[] = [
  { package_size: 'small', max_weight_grams: null, max_volume_cbm: null, is_configured: false },
  { package_size: 'medium', max_weight_grams: null, max_volume_cbm: null, is_configured: false },
  { package_size: 'large', max_weight_grams: null, max_volume_cbm: null, is_configured: false },
];
const sizes: PackageSize[] = ['small', 'medium', 'large'];
const NIGERIAN_STATES = ["Abia","Adamawa","Akwa Ibom","Anambra","Bauchi","Bayelsa","Benue","Borno","Cross River","Delta","Ebonyi","Edo","Ekiti","Enugu","Federal Capital Territory","Gombe","Imo","Jigawa","Kaduna","Kano","Katsina","Kebbi","Kogi","Kwara","Lagos","Nasarawa","Niger","Ogun","Ondo","Osun","Oyo","Plateau","Rivers","Sokoto","Taraba","Yobe","Zamfara"] as const;

export default function JumiaPickupPricingManager({ token }: { token: string }) {
  const [enabled, setEnabled] = useState(false);
  const [method, setMethod] = useState<'weight' | 'volume' | 'weight_or_volume'>('weight_or_volume');
  const [rules, setRules] = useState<Rule[]>(blankRules);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-get-pickup-delivery-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load pickup pricing');
      setEnabled(data.settings?.enabled === true);
      setMethod(data.settings?.classification_method ?? 'weight_or_volume');
      setRules(sizes.map(size => {
        const row = (data.rules ?? []).find((r: Rule) => r.package_size === size);
        return row ? { ...row, max_weight_grams: row.max_weight_grams == null ? null : Number(row.max_weight_grams), max_volume_cbm: row.max_volume_cbm == null ? null : Number(row.max_volume_cbm) } : { ...blankRules.find(r => r.package_size === size)!, };
      }));
      const loadedRates: Rate[] = (data.rates ?? []).map((r: any) => ({
        destination_state: String(r.destination_state ?? ''),
        package_size: r.package_size,
        fee_ngn: Number(r.fee_ngn),
        is_active: r.is_active === true,
        source_note: r.source_note ?? '',
      }));
      const rateKeys = new Set(loadedRates.map(r => `${r.destination_state.trim().toLowerCase()}|${r.package_size}`));
      for (const state of NIGERIAN_STATES) {
        for (const package_size of sizes) {
          const key = `${state.toLowerCase()}|${package_size}`;
          if (!rateKeys.has(key)) loadedRates.push({ destination_state: state, package_size, fee_ngn: 0, is_active: false, source_note: '' });
        }
      }
      setRates(loadedRates);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load pickup pricing');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const updateRule = (size: PackageSize, field: 'max_weight_grams' | 'max_volume_cbm', value: string) => {
    setRules(prev => prev.map(rule => rule.package_size === size ? {
      ...rule, [field]: value.trim() === '' ? null : Number(value), is_configured: true,
    } : rule));
  };

  const updateRate = (index: number, patch: Partial<Rate>) => {
    setRates(prev => prev.map((rate, i) => i === index ? { ...rate, ...patch } : rate));
  };

  const addRate = () => setRates(prev => [...prev, {
    destination_state: '', package_size: 'small', fee_ngn: 0, is_active: true, source_note: '',
  }]);

  const save = async () => {
    setError('');
    if (enabled && rates.length === 0) {
      setError('Add verified destination rates before enabling pickup pricing.');
      return;
    }
    for (const rate of rates) {
      if (!rate.destination_state.trim() || !Number.isInteger(Number(rate.fee_ngn)) || Number(rate.fee_ngn) < 0) {
        setError('Every rate needs a destination state and a whole-naira fee of zero or more.');
        return;
      }
    }
    if (enabled) {
      for (const state of [...new Set(rates.filter(r => r.is_active).map(r => r.destination_state.trim().toLowerCase()))]) {
        const stateSizes = new Set(rates.filter(r => r.is_active && r.destination_state.trim().toLowerCase() === state).map(r => r.package_size));
        if (sizes.some(size => !stateSizes.has(size))) {
          setError(`The enabled rate card for ${state} must contain small, medium, and large prices.`);
          return;
        }
      }
      if (sizes.some(size => !rules.find(r => r.package_size === size)?.is_configured)) {
        setError('Configure and save the small, medium, and large classification rules before enabling pricing.');
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-save-pickup-delivery-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          settings: { enabled, classification_method: method },
          rules: rules.map(rule => ({ ...rule, is_configured: true })),
          rates: rates.map(rate => ({ ...rate, destination_state: rate.destination_state.trim() })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not save pickup pricing');
      toast.success(data.message ?? 'Jumia pickup pricing saved');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save pickup pricing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="bg-white rounded-2xl border border-gray-100 py-8 flex justify-center"><Loader className="w-5 h-5 animate-spin text-gray-300" /></div>;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div>
        <h3 className="font-bold text-gray-900">Jumia pickup-station delivery pricing</h3>
        <p className="text-xs text-gray-500 mt-1">Configure parcel classification and delivery fees by destination state. This feature starts disabled because Jumia's exact package thresholds and complete applicable rate card still need verification.</p>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        Do not enable live pricing with estimated rates. Record the official source in each rate's source note.
      </div>
      <label className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 p-3">
        <span><span className="block text-sm font-semibold text-gray-900">Enable pickup delivery charges</span><span className="block text-[11px] text-gray-500 mt-0.5">Checkout will reject pickup orders when enabled but no valid quote can be calculated.</span></span>
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="w-4 h-4 accent-orange-500" />
      </label>
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Package classification method</label>
        <select value={method} onChange={e => setMethod(e.target.value as typeof method)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
          <option value="weight_or_volume">Weight and volume (both thresholds must fit)</option>
          <option value="weight">Weight only</option>
          <option value="volume">Volume only</option>
        </select>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-gray-800 mb-1">Package-size thresholds</h4>
        <p className="text-[11px] text-gray-500 mb-3">Set maximum values for small and medium packages. Large is the fallback category. Values must come from Jumia; empty values are not inferred.</p>
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.package_size} className="rounded-xl border border-gray-100 p-3">
              <p className="text-sm font-semibold capitalize mb-2">{rule.package_size} package</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Maximum weight (grams)</label>
                  <input type="number" min="0" value={rule.max_weight_grams ?? ''} placeholder={rule.package_size === 'large' ? 'No upper limit' : 'Jumia-confirmed threshold'} onChange={e => updateRule(rule.package_size, 'max_weight_grams', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-500 mb-1">Maximum volume (CBM)</label>
                  <input type="number" min="0" step="0.0001" value={rule.max_volume_cbm ?? ''} placeholder={rule.package_size === 'large' ? 'No upper limit' : 'Jumia-confirmed threshold'} onChange={e => updateRule(rule.package_size, 'max_volume_cbm', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div><h4 className="text-sm font-semibold text-gray-800">Destination rate card</h4><p className="text-[11px] text-gray-500">One row per destination state and package size.</p></div>
          <button onClick={addRate} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold"><Plus className="w-3.5 h-3.5" /> Add rate</button>
        </div>
        {rates.length === 0 && <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500">No rates configured. Add only verified Jumia rates.</p>}
        <div className="space-y-2">
          {rates.map((rate, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-xl border border-gray-100 p-3 items-end">
              <div className="sm:col-span-3"><label className="block text-[10px] text-gray-500 mb-1">Destination state</label><select value={rate.destination_state} onChange={e => updateRate(index, { destination_state: e.target.value })} className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs"><option value="">Select state</option>{NIGERIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="block text-[10px] text-gray-500 mb-1">Package</label><select value={rate.package_size} onChange={e => updateRate(index, { package_size: e.target.value as PackageSize })} className="w-full rounded-lg border border-gray-200 px-2 py-2 text-xs">{sizes.map(size => <option key={size} value={size}>{size}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="block text-[10px] text-gray-500 mb-1">Fee (₦)</label><input type="number" min="0" step="1" value={rate.fee_ngn} onChange={e => updateRate(index, { fee_ngn: Number(e.target.value) })} className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" /></div>
              <div className="sm:col-span-3"><label className="block text-[10px] text-gray-500 mb-1">Rate source / note</label><input value={rate.source_note} onChange={e => updateRate(index, { source_note: e.target.value })} placeholder="Official rate card / date" className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" /></div>
              <div className="sm:col-span-1 flex items-center gap-2"><input aria-label="Rate active" type="checkbox" checked={rate.is_active} onChange={e => updateRate(index, { is_active: e.target.checked })} className="accent-orange-500" /><span className="text-[10px] text-gray-500">Active</span></div>
              <div className="sm:col-span-1 flex justify-end"><button aria-label="Remove rate" onClick={() => setRates(prev => prev.filter((_, i) => i !== index))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button></div>
            </div>
          ))}
        </div>
      </div>
      {error && <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      <button onClick={save} disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white font-bold text-sm py-3">
        {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {saving ? 'Saving…' : 'Save Jumia pickup pricing'}
      </button>
    </section>
  );
}

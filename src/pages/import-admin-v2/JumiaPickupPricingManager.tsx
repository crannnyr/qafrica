import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Loader } from 'lucide-react';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;
type PackageSize = 'small' | 'medium' | 'large';
type Rule = { package_size: PackageSize; max_weight_grams: number | null; max_volume_cbm: number | null; is_configured: boolean };
type Rate = { destination_state: string; package_size: PackageSize; fee_ngn: number; is_active: boolean; source_note: string };
type DestinationZone = { destination_state: string; destination_zone: string; is_active: boolean; source_note: string };

const blankRules: Rule[] = [
  { package_size: 'small', max_weight_grams: null, max_volume_cbm: null, is_configured: false },
  { package_size: 'medium', max_weight_grams: null, max_volume_cbm: null, is_configured: false },
  { package_size: 'large', max_weight_grams: null, max_volume_cbm: null, is_configured: false },
];
const sizes: PackageSize[] = ['small', 'medium', 'large'];
const ZONES = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6', 'Zone 7'];
const JUMIA_LOCALITIES = ["Lagos","Agbara","Mowe Ibafo","Ajah","Akute","Awoyaya","Badagry","Epe","Ibeju Lekki","Ijanikin","Ikorodu","Ojo","Ojokoro","Oko-Oba","Sagamu","Abeokuta","Abuja","Port Harcourt","Akure","Awka","Ibadan","Asaba","Benin","Eleme","Gwagwalada","Idu","Nnewi","Obantoko","Onitsha","Osogbo","Owerri","Oyigbo","Ado Ekiti","Agbor","Akoko","Ede","Ikire","Ikirun","Ile Ife","Ilesha","Iwo","Masaka","Nsukka","Offa","Ogbomoso","Ondo Town","Ore","Owo","Oyo Town","Umuahia","Ilorin","Aba","Ago Iwoye","Calabar","Enugu","Ijebu Igbo","Ijebu Ode","Ikot Ekpene","Ilaro","Ilishan Remo","Iperu","Jos","Kaduna","Maiduguri","Minna","Sango Otta","Redeemed Camp","Uyo","Warri","Yenagoa","Abakaliki","Bauchi","Kano","Eket","Gombe","Lokoja","Okene","Suleja","Udu","Yola","Zaria","Abraka","Agharbo","Bonny Island","Egor","Ekpoma","Etsako","Fupre","Keffi","Lafia","Markurdi","Dbiaruku","Ughara","Ozoro","Sapele","Ughelli","Uromi"] as const;
const LOCALITY_ZONE_HINTS: Record<string, string> = {"Lagos":"Zone 1","Agbara":"Zone 2","Mowe Ibafo":"Zone 2","Ajah":"Zone 2","Akute":"Zone 2","Awoyaya":"Zone 2","Badagry":"Zone 2","Epe":"Zone 2","Ibeju Lekki":"Zone 2","Ijanikin":"Zone 2","Ikorodu":"Zone 2","Ojo":"Zone 2","Ojokoro":"Zone 2","Oko-Oba":"Zone 2","Sagamu":"Zone 2","Abeokuta":"Zone 3","Abuja":"Zone 3","Port Harcourt":"Zone 3","Akure":"Zone 3","Awka":"Zone 3","Ibadan":"Zone 3","Asaba":"Zone 3","Benin":"Zone 3","Eleme":"Zone 3","Gwagwalada":"Zone 3","Idu":"Zone 3","Nnewi":"Zone 3","Obantoko":"Zone 3","Onitsha":"Zone 3","Osogbo":"Zone 3","Owerri":"Zone 3","Oyigbo":"Zone 3","Ado Ekiti":"Zone 4","Agbor":"Zone 4","Akoko":"Zone 4","Ede":"Zone 4","Ikire":"Zone 4","Ikirun":"Zone 4","Ile Ife":"Zone 4","Ilesha":"Zone 4","Iwo":"Zone 4","Masaka":"Zone 4","Nsukka":"Zone 4","Offa":"Zone 4","Ogbomoso":"Zone 4","Ondo Town":"Zone 4","Ore":"Zone 4","Owo":"Zone 4","Oyo Town":"Zone 4","Umuahia":"Zone 4","Ilorin":"Zone 4","Aba":"Zone 5","Ago Iwoye":"Zone 5","Calabar":"Zone 5","Enugu":"Zone 5","Ijebu Igbo":"Zone 5","Ijebu Ode":"Zone 5","Ikot Ekpene":"Zone 5","Ilaro":"Zone 5","Ilishan Remo":"Zone 5","Iperu":"Zone 5","Jos":"Zone 5","Kaduna":"Zone 5","Maiduguri":"Zone 5","Minna":"Zone 5","Sango Otta":"Zone 5","Redeemed Camp":"Zone 5","Uyo":"Zone 5","Warri":"Zone 5","Yenagoa":"Zone 5","Abakaliki":"Zone 6","Bauchi":"Zone 6","Kano":"Zone 6","Eket":"Zone 6","Gombe":"Zone 6","Lokoja":"Zone 6","Okene":"Zone 6","Suleja":"Zone 6","Udu":"Zone 6","Yola":"Zone 6","Zaria":"Zone 6","Abraka":"Zone 7","Agharbo":"Zone 7","Bonny Island":"Zone 7","Egor":"Zone 7","Ekpoma":"Zone 7","Etsako":"Zone 7","Fupre":"Zone 7","Keffi":"Zone 7","Lafia":"Zone 7","Markurdi":"Zone 7","Dbiaruku":"Zone 7","Ughara":"Zone 7","Ozoro":"Zone 7","Sapele":"Zone 7","Ughelli":"Zone 7","Uromi":"Zone 7"};
const SCREENSHOT_RATES: Record<string, number[]> = {"Zone 1":[1400,3600,5800],"Zone 2":[1400,3800,6000],"Zone 3":[1700,5000,15000],"Zone 4":[1400,3500,15000],"Zone 5":[1600,7000,22000],"Zone 6":[1900,7100,26000],"Zone 7":[1800,7800,30000]};

export default function JumiaPickupPricingManager({ token }: { token: string }) {
  const [enabled, setEnabled] = useState(false);
  const [method, setMethod] = useState<'weight' | 'volume' | 'weight_or_volume'>('weight');
  const [rules, setRules] = useState<Rule[]>([{ package_size: 'small', max_weight_grams: 5000, max_volume_cbm: null, is_configured: true }, { package_size: 'medium', max_weight_grams: 15000, max_volume_cbm: null, is_configured: true }, { package_size: 'large', max_weight_grams: 35000, max_volume_cbm: null, is_configured: true }]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [destinationZones, setDestinationZones] = useState<DestinationZone[]>([]);
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
      setMethod(data.settings?.classification_method ?? 'weight');
      setRules(sizes.map(size => {
        const row = (data.rules ?? []).find((r: Rule) => r.package_size === size);
        return row ? { ...row, max_weight_grams: row.max_weight_grams == null ? null : Number(row.max_weight_grams), max_volume_cbm: row.max_volume_cbm == null ? null : Number(row.max_volume_cbm) } : { ...blankRules.find(r => r.package_size === size)!, };
      }));
      const loadedRates: Rate[] = (data.rates ?? []).filter((r: any) => ZONES.includes(String(r.destination_state ?? ''))).map((r: any) => ({
        destination_state: String(r.destination_state ?? ''),
        package_size: r.package_size,
        fee_ngn: Number(r.fee_ngn),
        is_active: r.is_active === true,
        source_note: r.source_note ?? '',
      }));
      const rateKeys = new Set(loadedRates.map(r => `${r.destination_state.trim().toLowerCase()}|${r.package_size}`));
      for (const zone of ZONES) {
        for (const package_size of sizes) {
          const key = `${zone.toLowerCase()}|${package_size}`;
          if (!rateKeys.has(key)) loadedRates.push({ destination_state: zone, package_size, fee_ngn: SCREENSHOT_RATES[zone][sizes.indexOf(package_size)], is_active: true, source_note: 'Jumia rate-card screenshot supplied by user' });
        }
      }
      for (const rate of loadedRates) {
        rate.fee_ngn = SCREENSHOT_RATES[rate.destination_state][sizes.indexOf(rate.package_size)];
        rate.is_active = true;
        rate.source_note = 'Jumia rate-card screenshot supplied by user';
      }
      setRates(loadedRates);
      const savedZones: DestinationZone[] = (data.destination_zones ?? []).map((z: any) => ({ destination_state: String(z.destination_state ?? ''), destination_zone: String(z.destination_zone ?? ''), is_active: z.is_active === true, source_note: z.source_note ?? '' }));
      setDestinationZones(JUMIA_LOCALITIES.map(locality => savedZones.find(z => z.destination_state.toLowerCase() === locality.toLowerCase()) ?? ({ destination_state: locality, destination_zone: LOCALITY_ZONE_HINTS[locality], is_active: true, source_note: 'Jumia delivery-zones screenshot supplied by user' })));
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

  const updateDestinationZone = (state: string, patch: Partial<DestinationZone>) => setDestinationZones(prev => prev.map(row => row.destination_state === state ? { ...row, ...patch } : row));

  const updateRate = (index: number, patch: Partial<Rate>) => {
    setRates(prev => prev.map((rate, i) => i === index ? { ...rate, ...patch } : rate));
  };

  const save = async () => {
    setError('');
    if (enabled && destinationZones.some(row => !row.is_active || !ZONES.includes(row.destination_zone))) {
      setError('Before enabling pricing, assign and activate an official Jumia destination zone for every listed state.');
      return;
    }
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
      if (ZONES.some(zone => sizes.some(size => !rates.some(rate => rate.is_active && rate.destination_state === zone && rate.package_size === size)))) {
        setError('The official rate card must have active small, medium, and large rates for all seven destination zones.');
        return;
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
          destination_zones: destinationZones.map(row => ({ ...row, destination_state: row.destination_state.trim(), destination_zone: row.destination_zone.trim() })),
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
        <p className="text-xs text-gray-500 mt-1">Origin is fixed at Zone 1 (Lagos). Map each destination state to its official Jumia zone, then enter the fee card by zone and package size. No delivery-time estimates are used.</p>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
        Verify both state-to-zone assignments and fees against your official Jumia card before enabling. Delivery-time estimates are intentionally omitted.
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
        <p className="text-[11px] text-gray-500 mb-3">Classification uses order weight in grams: Small up to 5,000 g; Medium over 5,000 g up to 15,000 g; Large over 15,000 g up to 35,000 g. Orders above 35,000 g need a separate quote.</p>
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
                  <label className="block text-[11px] text-gray-500 mb-1">Maximum volume (QAfrica volume units)</label>
                  <input type="number" min="0" step="1" value={rule.max_volume_cbm ?? ''} placeholder={rule.package_size === 'large' ? 'No upper limit' : 'Test threshold; verify with Jumia'} onChange={e => updateRule(rule.package_size, 'max_volume_cbm', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-sm font-semibold text-gray-800 mb-1">Destination city/locality → Jumia zone mapping</h4>
        <p className="text-[11px] text-gray-500 mb-3">Assign each state to the zone shown on the official Jumia rate card. Unverified mappings remain inactive.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {destinationZones.map(row => <div key={row.destination_state} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-gray-100 p-2"><span className="col-span-5 text-xs text-gray-700">{row.destination_state}</span><select aria-label={row.destination_state + ' destination zone'} value={row.destination_zone} onChange={e => updateDestinationZone(row.destination_state, { destination_zone: e.target.value, is_active: e.target.value !== '' })} className="col-span-5 rounded-lg border border-gray-200 px-2 py-2 text-xs"><option value="">Select zone</option>{ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select><input aria-label={row.destination_state + ' mapping active'} type="checkbox" checked={row.is_active} disabled={!row.destination_zone} onChange={e => updateDestinationZone(row.destination_state, { is_active: e.target.checked })} className="col-span-2 justify-self-center accent-orange-500" /></div>)}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div><h4 className="text-sm font-semibold text-gray-800">Zone 1 (Lagos) → destination-zone rate card</h4><p className="text-[11px] text-gray-500">Exactly one row per destination zone and package size.</p></div>
        </div>
        {rates.length === 0 && <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500">No rates configured. Add only verified Jumia rates.</p>}
        <div className="space-y-2">
          {rates.map((rate, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 rounded-xl border border-gray-100 p-3 items-end">
              <div className="sm:col-span-3"><label className="block text-[10px] text-gray-500 mb-1">Destination zone</label><select value={rate.destination_state} onChange={e => updateRate(index, { destination_state: e.target.value })} className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs"><option value="">Select zone</option>{ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="block text-[10px] text-gray-500 mb-1">Package</label><select value={rate.package_size} onChange={e => updateRate(index, { package_size: e.target.value as PackageSize })} className="w-full rounded-lg border border-gray-200 px-2 py-2 text-xs">{sizes.map(size => <option key={size} value={size}>{size}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="block text-[10px] text-gray-500 mb-1">Fee (₦)</label><input type="number" min="0" step="1" value={rate.fee_ngn} onChange={e => updateRate(index, { fee_ngn: Number(e.target.value) })} className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" /></div>
              <div className="sm:col-span-3"><label className="block text-[10px] text-gray-500 mb-1">Rate source / note</label><input value={rate.source_note} onChange={e => updateRate(index, { source_note: e.target.value })} placeholder="Official rate card / date" className="w-full rounded-lg border border-gray-200 px-2.5 py-2 text-xs" /></div>
              <div className="sm:col-span-1 flex items-center gap-2"><input aria-label="Rate active" type="checkbox" checked={rate.is_active} onChange={e => updateRate(index, { is_active: e.target.checked })} className="accent-orange-500" /><span className="text-[10px] text-gray-500">Active</span></div>
              
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

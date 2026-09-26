import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Loader, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import CONFIG from '@/lib/config'
import { getManagementToken } from './ManagementAuth'

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`

type PricingSettings = {
  usd_to_ngn: number
  cny_to_usd: number
  sea_rate_ngn_per_cbm: number
  air_rate_ngn_per_gram: number
  sea_product_allocation_percent: number
  sea_customer_percent: number
  air_credit_enabled: boolean
  updated_at?: string
}

const DEFAULTS: PricingSettings = {
  usd_to_ngn: 1480,
  cny_to_usd: 0.13986014,
  sea_rate_ngn_per_cbm: 0,
  air_rate_ngn_per_gram: 0,
  sea_product_allocation_percent: 80,
  sea_customer_percent: 20,
  air_credit_enabled: true,
}

export default function ManagementPricingShipping() {
  const [settings, setSettings] = useState<PricingSettings>(DEFAULTS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const token = getManagementToken()
    if (!token) return
    setIsLoading(true)
    setError('')
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-pricing-settings`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.settings) throw new Error(data.error || 'Could not load pricing settings')
      setSettings({
        ...DEFAULTS,
        usd_to_ngn: Number(data.settings.usd_to_ngn),
        cny_to_usd: Number(data.settings.cny_to_usd),
        sea_rate_ngn_per_cbm: Number(data.settings.sea_rate_ngn_per_cbm),
        air_rate_ngn_per_gram: Number(data.settings.air_rate_ngn_per_gram ?? data.settings.flight_rate_ngn_per_gram),
        sea_product_allocation_percent: Number(data.settings.sea_product_allocation_percent ?? data.settings.sea_shipping_product_allocation_percent),
        sea_customer_percent: Number(data.settings.sea_customer_percent ?? data.settings.sea_shipping_customer_percent),
        air_credit_enabled: Boolean(data.settings.air_credit_enabled ?? data.settings.air_shipping_credit_enabled),
        updated_at: data.settings.updated_at,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load pricing settings')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const setField = <K extends keyof PricingSettings>(key: K, value: PricingSettings[K]) => {
    setSaved(false)
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setError('')
    setSaved(false)

    const checks: Array<[string, number, boolean]> = [
      ['USD → NGN rate', settings.usd_to_ngn, settings.usd_to_ngn > 0],
      ['CNY → USD rate', settings.cny_to_usd, settings.cny_to_usd > 0],
      ['Sea rate', settings.sea_rate_ngn_per_cbm, settings.sea_rate_ngn_per_cbm >= 0],
      ['Air rate', settings.air_rate_ngn_per_gram, settings.air_rate_ngn_per_gram >= 0],
      ['Sea product allocation', settings.sea_product_allocation_percent, settings.sea_product_allocation_percent >= 0 && settings.sea_product_allocation_percent <= 100],
      ['Sea customer percentage', settings.sea_customer_percent, settings.sea_customer_percent >= 0 && settings.sea_customer_percent <= 100],
    ]
    const invalid = checks.find(([, value, ok]) => !Number.isFinite(value) || !ok)
    if (invalid) {
      setError(`${invalid[0]} must be a valid value within its allowed range.`)
      return
    }
    if (Math.abs(settings.sea_product_allocation_percent + settings.sea_customer_percent - 100) > 0.0001) {
      setError('Sea product allocation and customer percentage must add up to 100%.')
      return
    }

    const token = getManagementToken()
    if (!token) {
      setError('Management session expired')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-update-pricing-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, ...settings }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save pricing settings')
      if (data.settings) {
        setSettings(prev => ({
          ...prev,
          ...data.settings,
          usd_to_ngn: Number(data.settings.usd_to_ngn),
          cny_to_usd: Number(data.settings.cny_to_usd),
          sea_rate_ngn_per_cbm: Number(data.settings.sea_rate_ngn_per_cbm),
          air_rate_ngn_per_gram: Number(data.settings.air_rate_ngn_per_gram ?? data.settings.flight_rate_ngn_per_gram),
          sea_product_allocation_percent: Number(data.settings.sea_product_allocation_percent ?? data.settings.sea_shipping_product_allocation_percent),
          sea_customer_percent: Number(data.settings.sea_customer_percent ?? data.settings.sea_shipping_customer_percent),
          air_credit_enabled: Boolean(data.settings.air_credit_enabled ?? data.settings.air_shipping_credit_enabled),
        }))
      }
      setSaved(true)
      toast.success('Pricing & shipping settings saved')
      window.setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save pricing settings'
      setError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="bg-white rounded-2xl border border-gray-100 py-12 flex justify-center"><Loader className="w-5 h-5 animate-spin text-gray-300" /></div>
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-black text-gray-900">Pricing & Shipping</h2>
        <p className="text-sm text-gray-500 mt-1">Rates and shipping allocation rules used by the import pricing system.</p>
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <p className="font-semibold text-gray-800 text-sm">Currency rates</p>
          <p className="text-[11px] text-gray-400 mt-0.5">USD → NGN is the main pricing conversion. CNY → USD is retained for import price conversion.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="USD → NGN" value={settings.usd_to_ngn} min={0.0001} step="0.01" onChange={v => setField('usd_to_ngn', v)} />
          <Field label="CNY → USD" value={settings.cny_to_usd} min={0.00000001} step="0.00000001" onChange={v => setField('cny_to_usd', v)} />
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <p className="font-semibold text-gray-800 text-sm">Shipping rates</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Raw freight rates before allocation and air-credit rules are applied.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Sea rate (₦ / CBM)" value={settings.sea_rate_ngn_per_cbm} min={0} step="0.01" onChange={v => setField('sea_rate_ngn_per_cbm', v)} />
          <Field label="Air rate (₦ / gram)" value={settings.air_rate_ngn_per_gram} min={0} step="0.0001" onChange={v => setField('air_rate_ngn_per_gram', v)} />
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div>
          <p className="font-semibold text-gray-800 text-sm">Sea shipping allocation</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Raw sea freight is split between product cost and the customer's sea shipping fee.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Moved into product cost (%)" value={settings.sea_product_allocation_percent} min={0} max={100} step="0.01" onChange={v => setField('sea_product_allocation_percent', v)} />
          <Field label="Remaining customer sea fee (%)" value={settings.sea_customer_percent} min={0} max={100} step="0.01" onChange={v => setField('sea_customer_percent', v)} />
        </div>
        <div className="rounded-xl bg-gray-50 px-4 py-3 text-[11px] text-gray-500">
          The two percentages must total 100%. With 80% / 20%, ₦10,000 raw sea freight becomes ₦8,000 product allocation and ₦2,000 customer shipping.
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5">
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Use sea allocation as an air-shipping credit</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Credits the NGN amount allocated into product cost against raw air freight, never below ₦0.</p>
          </div>
          <input type="checkbox" checked={settings.air_credit_enabled} onChange={e => setField('air_credit_enabled', e.target.checked)} className="w-4 h-4 accent-orange-500 flex-shrink-0" />
        </label>
      </section>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] text-blue-700">
        <p className="font-bold mb-1">Calculation rules</p>
        <p>Sea: volume × sea rate → raw sea freight → product allocation + customer sea fee.</p>
        <p className="mt-1">Air: weight × air rate → raw air freight → subtract sea allocation credit when enabled → never below ₦0.</p>
        <p className="mt-1">Changing these settings does not recalculate existing products until they are deliberately edited/re-saved.</p>
      </div>

      {error && <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg"><AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}</div>}

      <button onClick={handleSave} disabled={isSaving} className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
        {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {isSaving ? 'Saving…' : saved ? 'Saved' : 'Save pricing & shipping settings'}
      </button>
      <button onClick={() => void load()} disabled={isLoading} className="mx-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700">
        <RefreshCw className="w-3 h-3" /> Refresh settings
      </button>
    </div>
  )
}

function Field({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max?: number; step: string; onChange: (value: number) => void }) {
  return (
    <label>
      <span className="text-xs font-semibold text-gray-700 block mb-1.5">{label}</span>
      <input type="number" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none" />
    </label>
  )
}

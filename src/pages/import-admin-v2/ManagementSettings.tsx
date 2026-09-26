import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Loader, RefreshCw, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import CONFIG from '@/lib/config'
import { getManagementToken } from './ManagementAuth'

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`

type AdminSettings = {
  paystack_enabled: boolean
  manual_transfer_enabled: boolean
  bank_account_number: string
  bank_account_name: string
  bank_name: string
  sea_rate_ngn_per_cbm: number
  flight_rate_ngn_per_gram: number
  shipping_discount_percent: number
  shipping_discount_min_ngn: number
  bulk_discount_tier1_qty: number
  bulk_discount_tier1_percent: number
  bulk_discount_tier2_qty: number
  bulk_discount_tier2_percent: number
  charge_shipping_at_checkout: boolean
  paystack_manual_threshold_ngn: number
}

const DEFAULTS: AdminSettings = {
  paystack_enabled: true,
  manual_transfer_enabled: true,
  bank_account_number: '',
  bank_account_name: '',
  bank_name: '',
  sea_rate_ngn_per_cbm: 0,
  flight_rate_ngn_per_gram: 0,
  shipping_discount_percent: 0,
  shipping_discount_min_ngn: 1600,
  bulk_discount_tier1_qty: 10,
  bulk_discount_tier1_percent: 5,
  bulk_discount_tier2_qty: 20,
  bulk_discount_tier2_percent: 5,
  charge_shipping_at_checkout: true,
  paystack_manual_threshold_ngn: 100000,
}

export default function ManagementSettings() {
  const [settings, setSettings] = useState<AdminSettings>(DEFAULTS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const token = getManagementToken()
    if (!token) return
    setIsLoading(true)
    setSaveError('')
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-settings`)
      const data = await res.json()
      if (!res.ok || !data.settings) throw new Error(data.error || 'Could not load settings')
      setSettings({ ...DEFAULTS, ...data.settings })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not load settings')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const setField = <K extends keyof AdminSettings>(field: K, value: AdminSettings[K]) => {
    setSettings(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    const token = getManagementToken()
    if (!token) {
      setSaveError('Management session expired')
      return
    }
    setIsSaving(true)
    setSaveError('')
    setSaved(false)
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-update-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, ...settings }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save settings')
      if (data.settings) setSettings(prev => ({ ...prev, ...data.settings }))
      setSaved(true)
      toast.success('Settings saved')
      window.setTimeout(() => setSaved(false), 2500)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error'
      setSaveError(message)
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-black text-gray-900">Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Manage payment methods, checkout behavior, and import shipping discounts.</p>
      </div>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">Payment methods</p>
            <p className="text-[11px] text-gray-400">Control which payment methods are available across import checkout.</p>
          </div>
        </div>

        <label className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-900">Paystack enabled</p>
            <p className="text-[11px] text-gray-400">Turn off to force manual transfer only, site-wide.</p>
          </div>
          <input type="checkbox" checked={settings.paystack_enabled} onChange={e => setField('paystack_enabled', e.target.checked)} className="w-4 h-4 accent-orange-500" />
        </label>

        <label className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-900">Manual bank transfer enabled</p>
            <p className="text-[11px] text-gray-400">Turn off to force Paystack only, site-wide.</p>
          </div>
          <input type="checkbox" checked={settings.manual_transfer_enabled} onChange={e => setField('manual_transfer_enabled', e.target.checked)} className="w-4 h-4 accent-orange-500" />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-700 block mb-1.5">Paystack / Manual threshold (₦)</span>
          <input type="number" min={0} value={settings.paystack_manual_threshold_ngn} onChange={e => setField('paystack_manual_threshold_ngn', Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-orange-500 outline-none" />
          <p className="text-[11px] text-gray-400 mt-1">Orders below this amount use Paystack. Orders at or above it must use manual bank transfer.</p>
        </label>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-800 text-sm">Shipping checkout behavior</p>
        <label className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
          <div>
            <p className="text-sm font-semibold text-gray-900">Charge shipping at checkout</p>
            <p className="text-[11px] text-gray-400">When off, checkout doesn't add shipping to the total — bill it manually later instead.</p>
          </div>
          <input type="checkbox" checked={settings.charge_shipping_at_checkout} onChange={e => setField('charge_shipping_at_checkout', e.target.checked)} className="w-4 h-4 accent-orange-500" />
        </label>
        <p className="text-[11px] text-gray-400">Sea and air freight rates are managed separately in the pricing and shipping controls.</p>
      </section>

      <section className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <p className="font-semibold text-gray-800 text-sm">Shipping discount</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label>
            <span className="text-xs font-semibold text-gray-700 block mb-1.5">Base discount (%)</span>
            <input type="number" min={0} max={100} step="0.01" value={settings.shipping_discount_percent} onChange={e => setField('shipping_discount_percent', Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-orange-500 outline-none" />
          </label>
          <label>
            <span className="text-xs font-semibold text-gray-700 block mb-1.5">Minimum shipping fee to qualify (₦)</span>
            <input type="number" min={0} value={settings.shipping_discount_min_ngn} onChange={e => setField('shipping_discount_min_ngn', Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-orange-500 outline-none" />
          </label>
        </div>
        <p className="text-[11px] text-gray-400">No discount applies until the cart's raw shipping cost reaches this amount.</p>

        <div className="grid sm:grid-cols-2 gap-3">
          <label>
            <span className="text-xs font-semibold text-gray-700 block mb-1.5">Bulk tier 1: qty threshold</span>
            <input type="number" min={0} value={settings.bulk_discount_tier1_qty} onChange={e => setField('bulk_discount_tier1_qty', Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-orange-500 outline-none" />
          </label>
          <label>
            <span className="text-xs font-semibold text-gray-700 block mb-1.5">Bulk tier 1: extra discount (%)</span>
            <input type="number" min={0} max={100} step="0.01" value={settings.bulk_discount_tier1_percent} onChange={e => setField('bulk_discount_tier1_percent', Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-orange-500 outline-none" />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label>
            <span className="text-xs font-semibold text-gray-700 block mb-1.5">Bulk tier 2: qty threshold</span>
            <input type="number" min={0} value={settings.bulk_discount_tier2_qty} onChange={e => setField('bulk_discount_tier2_qty', Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-orange-500 outline-none" />
          </label>
          <label>
            <span className="text-xs font-semibold text-gray-700 block mb-1.5">Bulk tier 2: extra discount (%)</span>
            <input type="number" min={0} max={100} step="0.01" value={settings.bulk_discount_tier2_percent} onChange={e => setField('bulk_discount_tier2_percent', Number(e.target.value))} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-orange-500 outline-none" />
          </label>
        </div>

        <p className="text-[11px] text-gray-400">Discounts are cumulative: at tier 2, base + tier 1 + tier 2 are added together.</p>
      </section>

      {saveError && (
        <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {saveError}
        </div>
      )}

      <button onClick={handleSave} disabled={isSaving} className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
        {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {isSaving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}
      </button>

      <button onClick={() => void load()} disabled={isLoading} className="mx-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700">
        <RefreshCw className="w-3 h-3" /> Refresh settings
      </button>
    </div>
  )
}

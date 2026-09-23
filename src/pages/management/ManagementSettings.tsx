import { useCallback, useEffect, useState } from 'react'
import { Check, Loader, RefreshCw, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import CONFIG from '@/lib/config'
import { getManagementToken } from './ManagementAuth'

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`

type ImportSettings = {
  charge_shipping_at_checkout: boolean
  shipping_discount_percent: number
  shipping_discount_min_ngn: number
  bulk_discount_tier1_qty: number
  bulk_discount_tier1_percent: number
  bulk_discount_tier2_qty: number
  bulk_discount_tier2_percent: number
}

const DEFAULTS: ImportSettings = {
  charge_shipping_at_checkout: true,
  shipping_discount_percent: 0,
  shipping_discount_min_ngn: 1600,
  bulk_discount_tier1_qty: 10,
  bulk_discount_tier1_percent: 5,
  bulk_discount_tier2_qty: 20,
  bulk_discount_tier2_percent: 5,
}

export default function ManagementSettings() {
  const [settings, setSettings] = useState<ImportSettings>(DEFAULTS)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    if (!getManagementToken()) return
    setIsLoading(true)
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-settings`)
      const data = await res.json()
      if (!res.ok || !data.settings) throw new Error(data.error || 'Could not load settings')
      const s = data.settings
      setSettings({
        charge_shipping_at_checkout: Boolean(s.charge_shipping_at_checkout),
        shipping_discount_percent: Number(s.shipping_discount_percent ?? DEFAULTS.shipping_discount_percent),
        shipping_discount_min_ngn: Number(s.shipping_discount_min_ngn ?? DEFAULTS.shipping_discount_min_ngn),
        bulk_discount_tier1_qty: Number(s.bulk_discount_tier1_qty ?? DEFAULTS.bulk_discount_tier1_qty),
        bulk_discount_tier1_percent: Number(s.bulk_discount_tier1_percent ?? DEFAULTS.bulk_discount_tier1_percent),
        bulk_discount_tier2_qty: Number(s.bulk_discount_tier2_qty ?? DEFAULTS.bulk_discount_tier2_qty),
        bulk_discount_tier2_percent: Number(s.bulk_discount_tier2_percent ?? DEFAULTS.bulk_discount_tier2_percent),
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load settings')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const setField = <K extends keyof ImportSettings>(key: K, value: ImportSettings[K]) => {
    setSettings(current => ({ ...current, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    const token = getManagementToken()
    if (!token) return
    setIsSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-update-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, ...settings }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save settings')
      setSaved(true)
      toast.success('Import settings saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save settings')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader className="w-5 h-5 animate-spin text-gray-400" /></div>

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h2 className="text-xl font-black text-gray-900">Import settings</h2>
        <p className="text-sm text-gray-500 mt-1">Manage import checkout and discount rules.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Checkout</h3>
            <p className="text-xs text-gray-400">Control how import shipping is charged.</p>
          </div>
        </div>
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Charge shipping at checkout</p>
            <p className="text-[11px] text-gray-400 mt-0.5">When enabled, eligible shipping charges are collected during import checkout.</p>
          </div>
          <input type="checkbox" checked={settings.charge_shipping_at_checkout}
            onChange={e => setField('charge_shipping_at_checkout', e.target.checked)}
            className="w-4 h-4 accent-orange-500 flex-shrink-0" />
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">Shipping discount</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <label>
            <span className="text-xs font-semibold text-gray-700 block mb-1.5">Discount (%)</span>
            <input type="number" min={0} max={100} step="0.01" value={settings.shipping_discount_percent}
              onChange={e => setField('shipping_discount_percent', Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500" />
          </label>
          <label>
            <span className="text-xs font-semibold text-gray-700 block mb-1.5">Minimum shipping (₦)</span>
            <input type="number" min={0} value={settings.shipping_discount_min_ngn}
              onChange={e => setField('shipping_discount_min_ngn', Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500" />
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-1">Bulk discounts</h3>
        <p className="text-xs text-gray-400 mb-4">Set quantity thresholds and percentage discounts for bulk purchases.</p>
        <div className="grid sm:grid-cols-2 gap-5">
          {[
            ['Tier 1', 'bulk_discount_tier1_qty', 'bulk_discount_tier1_percent'],
            ['Tier 2', 'bulk_discount_tier2_qty', 'bulk_discount_tier2_percent'],
          ].map(([label, qtyKey, percentKey]) => (
            <div key={label} className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs font-bold text-gray-700 mb-3">{label}</p>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="text-[11px] text-gray-500 block mb-1">Quantity</span>
                  <input type="number" min={1} value={settings[qtyKey as keyof ImportSettings] as number}
                    onChange={e => setField(qtyKey as keyof ImportSettings, Number(e.target.value) as never)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                </label>
                <label>
                  <span className="text-[11px] text-gray-500 block mb-1">Discount (%)</span>
                  <input type="number" min={0} max={100} step="0.01" value={settings[percentKey as keyof ImportSettings] as number}
                    onChange={e => setField(percentKey as keyof ImportSettings, Number(e.target.value) as never)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={isSaving}
        className="w-full py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
        {isSaving ? <Loader className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
        {isSaving ? 'Saving…' : saved ? 'Saved' : 'Save import settings'}
      </button>

      <button onClick={() => void load()} disabled={isLoading}
        className="mx-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700">
        <RefreshCw className="w-3 h-3" /> Refresh settings
      </button>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Calendar, DollarSign, Package, ShoppingCart, RefreshCw } from 'lucide-react'
import CONFIG from '@/lib/config'
import { getManagementToken } from './ManagementAuth'

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`

type Analytics = {
  orders_count: number
  units_sold: number
  revenue_ngn: number
  cost_ngn: number
  daily_trend: { date: string; orders: number; revenue_ngn: number }[]
}

type RangeKey = 'today' | 'yesterday' | '7d'

const RANGE_PRESETS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: 'Last 7 days' },
]

function getRange(key: RangeKey) {
  const now = new Date()

  if (key === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { date_from: start.toISOString(), date_to: now.toISOString() }
  }

  if (key === 'yesterday') {
    const end = new Date(now)
    end.setHours(0, 0, 0, 0)
    const start = new Date(end)
    start.setDate(start.getDate() - 1)
    return { date_from: start.toISOString(), date_to: end.toISOString() }
  }

  return {
    date_from: new Date(now.getTime() - 7 * 86_400_000).toISOString(),
    date_to: now.toISOString(),
  }
}

function fmt(n: number) {
  return `₦${Math.round(n).toLocaleString()}`
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${Math.round(n).toLocaleString()}`
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-gray-400" />
        </div>
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-black text-gray-900 text-xl leading-none">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <p className="font-semibold text-gray-800 text-sm mb-3">{title}</p>
      {children}
    </div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 shadow-xl">
      {label && <p className="text-xs text-gray-400 mb-1.5">{label}</p>}
      {payload.map((entry: any) => (
        <div key={entry.dataKey ?? entry.name} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.fill ?? entry.color }} />
          <span className="text-gray-300 capitalize">{entry.name}:</span>
          <span className="text-white font-semibold">
            {entry.dataKey === 'revenue_ngn' ? fmt(Number(entry.value)) : Number(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ManagementAnalytics() {
  const [range, setRange] = useState<RangeKey>('7d')
  const [data, setData] = useState<Analytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    const token = getManagementToken()
    if (!token) {
      setData(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const { date_from, date_to } = getRange(range)
      const res = await fetch(`${EDGE_URL}?action=admin-analytics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, date_from, date_to }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.analytics) throw new Error(json.error || 'Could not load analytics.')

      setData(json.analytics)
    } catch {
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [range])

  useEffect(() => { void load() }, [load])

  const trend = (data?.daily_trend ?? []).map(day => ({
    ...day,
    label: new Date(day.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-3.5 h-3.5 text-gray-300" />
        <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1 flex-1">
          {RANGE_PRESETS.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRange(item.key)}
              className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${range === item.key ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => void load()} disabled={isLoading} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="Refresh analytics">
          <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
          <p className="text-sm font-semibold text-gray-500">Couldn’t load import analytics.</p>
          <p className="text-xs text-gray-400 mt-1">Your management account may not have the import analytics permission.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={DollarSign} label="Revenue" value={fmtCompact(data.revenue_ngn)} sub={`${data.orders_count.toLocaleString()} paid orders`} />
            <KpiCard icon={ShoppingCart} label="Orders" value={data.orders_count.toLocaleString()} sub="Paid orders" />
            <KpiCard icon={Package} label="Units sold" value={data.units_sold.toLocaleString()} />
            <KpiCard icon={DollarSign} label="Cost" value={fmtCompact(data.cost_ngn)} sub="Product cost" />
          </div>

          <ChartCard title="Revenue trend">
            {trend.length === 0 ? (
              <p className="text-xs text-gray-300 py-8 text-center">No paid orders in this range yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trend} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={48} tickFormatter={fmtCompact} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 4 }} />
                  <Bar dataKey="revenue_ngn" name="Revenue" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </>
      )}
    </div>
  )
}

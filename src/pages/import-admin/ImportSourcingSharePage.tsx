import { useEffect, useState } from 'react'
import { Loader, Package, Copy, Check, ImageOff } from 'lucide-react'
import CONFIG from '@/lib/config'

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-sourcing-share`

type VariantLine = {
  variant_options: Record<string, string> | null
  quantity: number
}

type Product = {
  product_id: string
  product_name: string
  product_image: string | null
  total_qty: number
  variants: VariantLine[]
}

export default function ImportSourcingSharePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [batchDate, setBatchDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const token = window.location.pathname.split('/').filter(Boolean).pop()
    if (!token) {
      setError('This sourcing link is incomplete.')
      setLoading(false)
      return
    }

    fetch(`${EDGE_URL}?token=${encodeURIComponent(token)}`)
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Could not load sourcing list.')
        setProducts(Array.isArray(data.products) ? data.products : [])
        setBatchDate(data.batch_date || '')
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Could not load sourcing list.'))
      .finally(() => setLoading(false))
  }, [])

  const copyList = async () => {
    const text = products.map((p, i) => {
      const variants = p.variants
        .map(v => {
          const label = v.variant_options ? Object.entries(v.variant_options).map(([k, val]) => `${k}: ${val}`).join(', ') : 'No variant'
          return `  - ${label}: ${v.quantity}`
        })
        .join('\n')
      return `${i + 1}. ${p.product_name}\nTotal quantity: ${p.total_qty}\n${variants}`
    }).join('\n\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard is optional; the page remains usable.
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black">QAfrica Sourcing List</h1>
              <p className="text-xs text-gray-300">Products and quantities to source in China</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-12">
        {loading ? (
          <div className="py-20 flex justify-center"><Loader className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : error ? (
          <div className="bg-white border border-red-100 rounded-2xl p-8 text-center">
            <p className="font-bold text-gray-800">Sourcing list unavailable</p>
            <p className="text-sm text-gray-500 mt-2">{error}</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-gray-800">Batch</p>
                <p className="text-sm text-gray-500">{batchDate ? new Date(batchDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Closed batch'}</p>
              </div>
              <button onClick={() => void copyList()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold">
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy sourcing list'}
              </button>
            </div>

            {products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <p className="font-bold text-gray-800">No products to source</p>
                <p className="text-sm text-gray-500 mt-1">There are no outstanding products in this batch.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map(product => (
                  <div key={product.product_id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex gap-4">
                      <div className="w-24 h-24 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {product.product_image ? (
                          <img src={product.product_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <ImageOff className="w-6 h-6 text-gray-300" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-bold text-sm text-gray-900">{product.product_name}</h2>
                        <p className="mt-1 text-sm font-black text-orange-600">Total quantity needed: {product.total_qty.toLocaleString()}</p>
                        <div className="mt-3 space-y-1.5">
                          {product.variants.map((variant, index) => (
                            <div key={index} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg px-3 py-2">
                              <span className="text-xs text-gray-600">
                                {variant.variant_options
                                  ? Object.entries(variant.variant_options).map(([k, v]) => `${k}: ${v}`).join(' · ')
                                  : 'No variant specified'}
                              </span>
                              <span className="text-xs font-black text-gray-900 whitespace-nowrap">Qty {variant.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-center text-[10px] text-gray-400 mt-6">Prepared by QAfrica for China sourcing.</p>
          </>
        )}
      </main>
    </div>
  )
}

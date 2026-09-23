import { useEffect, useState } from 'react'
import { Loader, Package, Copy, Check, ImageOff, Grid2X2, List, X, ChevronDown } from 'lucide-react'
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)

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

  useEffect(() => {
    if (!selectedImage) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedImage(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [selectedImage])

  const copyList = async () => {
    const text = products.map((p, i) => {
      const variants = p.variants
        .map(v => {
          const label = v.variant_options ? Object.entries(v.variant_options).map(([k, val]) => `${k}: ${val}`).join(', ') : 'No variant'
          return `  - ${label}: ${v.quantity}`
        })
        .join('\\n')
      return `${i + 1}. ${p.product_name}\\nTotal quantity: ${p.total_qty}\\n${variants}`
    }).join('\\n\\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard is optional; the page remains usable.
    }
  }

  const toggleExpanded = (productId: string) => {
    setExpandedProduct(current => current === productId ? null : productId)
  }

  const variantContent = (product: Product) => (
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
  )

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-50 bg-gray-900 text-white shadow-md">
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

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1">
                  <button type="button" onClick={() => setViewMode('list')} aria-label="List view" title="List view" className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
                    <List className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setViewMode('grid')} aria-label="Grid view" title="Grid view" className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
                    <Grid2X2 className="w-4 h-4" />
                  </button>
                </div>

                <button onClick={() => void copyList()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy sourcing list'}
                </button>
              </div>
            </div>

            {products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <p className="font-bold text-gray-800">No products to source</p>
                <p className="text-sm text-gray-500 mt-1">There are no outstanding products in this batch.</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-3">
                {products.map(product => (
                  <div key={product.product_id} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <div className="flex gap-4">
                      <button type="button" onClick={() => product.product_image && setSelectedImage(product.product_image)} className="w-24 h-24 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-orange-500" aria-label={product.product_image ? `Open image for ${product.product_name}` : 'No product image'}>
                        {product.product_image ? <img src={product.product_image} alt="" className="w-full h-full object-cover transition-transform duration-200 hover:scale-105" /> : <ImageOff className="w-6 h-6 text-gray-300" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-bold text-sm text-gray-900">{product.product_name}</h2>
                        <p className="mt-1 text-sm font-black text-orange-600">Total quantity needed: {product.total_qty.toLocaleString()}</p>
                        {variantContent(product)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {products.map(product => {
                  const expanded = expandedProduct === product.product_id

                  return (
                    <div key={product.product_id} className={`bg-white rounded-2xl border overflow-hidden transition-all duration-200 ${expanded ? 'border-orange-200 shadow-md' : 'border-gray-100'}`}>
                      <button type="button" onClick={() => product.product_image && setSelectedImage(product.product_image)} className="w-full aspect-square bg-gray-100 overflow-hidden flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500" aria-label={product.product_image ? `Open image for ${product.product_name}` : 'No product image'}>
                        {product.product_image ? <img src={product.product_image} alt="" className="w-full h-full object-cover transition-transform duration-200 hover:scale-105" /> : <ImageOff className="w-8 h-8 text-gray-300" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleExpanded(product.product_id)}
                        className="w-full text-left p-3 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500"
                        aria-expanded={expanded}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h2 className="font-bold text-sm text-gray-900 line-clamp-2">{product.product_name}</h2>
                            <p className="mt-1 text-xs font-black text-orange-600">Total quantity: {product.total_qty.toLocaleString()}</p>
                          </div>
                          <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                        </div>
                        <p className="mt-1 text-[10px] text-gray-400">{expanded ? 'Tap to collapse' : 'Tap to view variants'}</p>
                      </button>

                      <div className={`grid transition-[grid-template-rows] duration-200 ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                        <div className="overflow-hidden">
                          <div className="px-3 pb-3 border-t border-gray-100 pt-2 space-y-1.5">
                            {product.variants.length > 0 ? product.variants.map((variant, index) => (
                              <div key={index} className="flex items-start justify-between gap-2 bg-gray-50 rounded-lg px-2.5 py-2">
                                <span className="text-[10px] leading-4 text-gray-600 min-w-0">
                                  {variant.variant_options
                                    ? Object.entries(variant.variant_options).map(([k, v]) => `${k}: ${v}`).join(' · ')
                                    : 'No variant specified'}
                                </span>
                                <span className="text-[10px] font-black text-gray-900 whitespace-nowrap">Qty {variant.quantity}</span>
                              </div>
                            )) : (
                              <p className="text-[10px] text-gray-400">No variants specified.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-center text-[10px] text-gray-400 mt-6">Prepared by QAfrica for China sourcing.</p>
          </>
        )}
      </main>

      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/80 p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Product image preview" onClick={() => setSelectedImage(null)}>
          <button type="button" onClick={() => setSelectedImage(null)} aria-label="Close image preview" className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20">
            <X className="w-5 h-5" />
          </button>
          <img src={selectedImage} alt="Product preview" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={event => event.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

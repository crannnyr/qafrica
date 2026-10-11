import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Minus, Plus, Printer, Search, ShoppingBag, ShoppingCart, Trash2, X, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';

type Product = { id: string; name: string; selling_price: number; stock_quantity: number; is_active: boolean; is_out_of_stock: boolean; images: string[] | null };
type Line = { product: Product; quantity: number; price: number };
type Receipt = { number: string | number; customer: string; cart: Line[]; subtotal: number; cut: number; total: number; date: string };
const money = (value: number) => `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

export default function POSPage() {
  const { currentStore } = useStoreStore();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Line[]>([]);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'low'>('all');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [discount, setDiscount] = useState('0');
  const [method, setMethod] = useState<'cash' | 'transfer' | 'pos' | 'check'>('cash');
  const [busy, setBusy] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const loadProducts = async () => {
    if (!currentStore?.id) { setProducts([]); setLoading(false); return; }
    setLoading(true);
    const [{ data, error }, { data: imports }] = await Promise.all([
      supabase.from('products').select('id,name,selling_price,stock_quantity,is_active,is_out_of_stock,images').eq('store_id', currentStore.id).eq('is_active', true).order('name'),
      supabase.from('import_catalog').select('original_product_id').eq('importer_store_id', currentStore.id),
    ]);
    if (error) toast.error('Could not load products');
    else {
      const importedIds = new Set((imports || []).map((item: { original_product_id: string }) => item.original_product_id));
      setProducts(((data || []) as Product[]).filter((product) => !importedIds.has(product.id)));
    }
    setLoading(false);
  };

  useEffect(() => { void loadProducts(); }, [currentStore?.id]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(query);
      const available = !product.is_out_of_stock && product.stock_quantity > 0;
      const matchesStock = stockFilter === 'all' || (stockFilter === 'available' && available) || (stockFilter === 'low' && available && product.stock_quantity <= 5);
      return matchesSearch && matchesStock;
    });
  }, [products, search, stockFilter]);

  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.price, 0);
  const cut = Math.min(subtotal, Math.max(0, Number(discount) || 0));
  const total = subtotal - cut;
  const cartQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);

  const add = (product: Product) => {
    if (product.is_out_of_stock || product.stock_quantity < 1) { toast.error('Out of stock'); return; }
    setCart((old) => {
      const line = old.find((item) => item.product.id === product.id);
      if (line) {
        if (line.quantity >= product.stock_quantity) { toast.error('Not enough stock'); return old; }
        return old.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...old, { product, quantity: 1, price: Number(product.selling_price) || 0 }];
    });
  };

  const changeQuantity = (productId: string, quantity: number) => {
    setCart((old) => old.map((line) => line.product.id === productId
      ? { ...line, quantity: Math.min(line.product.stock_quantity, Math.max(1, quantity || 1)) }
      : line));
  };

  const sell = async () => {
    if (!currentStore?.id || !cart.length || !customer.trim()) { toast.error('Add products and customer name'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('record_pos_sale', {
        p_store_id: currentStore.id,
        p_customer_name: customer.trim(),
        p_customer_phone: phone.trim(),
        p_payment_method: method,
        p_discount: cut,
        p_items: cart.map((line) => ({
          product_id: line.product.id,
          quantity: line.quantity,
          unit_price: line.price,
        })),
      });
      if (error) throw error;
      const saved = data as { id: string; order_number: string; subtotal: number; discount: number; total: number } | null;
      if (!saved?.id) throw new Error('The database did not confirm the sale. Refresh orders before retrying.');

      setReceipt({
        number: saved.order_number || saved.id,
        customer: customer.trim(),
        cart: [...cart],
        subtotal: Number(saved.subtotal ?? subtotal),
        cut: Number(saved.discount ?? cut),
        total: Number(saved.total ?? total),
        date: new Date().toLocaleString(),
      });
      setCart([]);
      setCustomer('');
      setPhone('');
      setDiscount('0');
      toast.success('Sale recorded');
      await loadProducts();
    } catch (error: unknown) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : error instanceof Error ? error.message : 'Could not record sale';
      toast.error(message);
    } finally { setBusy(false); }
  };

  if (receipt) return (
    <div className="mx-auto max-w-2xl rounded-2xl border bg-white p-6 text-gray-900 shadow-sm sm:p-8">
      <div id="pos-receipt">
        <h1 className="text-center text-2xl font-bold">{currentStore?.name || 'QAfrica Store'}</h1>
        <p className="mt-1 text-center text-sm text-gray-500">Receipt #{receipt.number} · {receipt.date}</p>
        <p className="my-5">Customer: <strong>{receipt.customer}</strong></p>
        <table className="w-full"><tbody>{receipt.cart.map((line) => (
          <tr key={line.product.id} className="border-b"><td className="py-3">{line.product.name} × {line.quantity}</td><td className="text-right">{money(line.price * line.quantity)}</td></tr>
        ))}</tbody></table>
        <p className="mt-4 text-right text-sm text-gray-500">Subtotal: {money(receipt.subtotal)}</p>
        <p className="text-right text-sm text-gray-500">Discount: −{money(receipt.cut)}</p>
        <p className="mt-1 text-right text-2xl font-bold">Total: {money(receipt.total)}</p>
        <p className="mt-8 text-center text-sm">Thank you for your purchase.</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3 print:hidden">
        <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print receipt</Button>
        <Button variant="outline" onClick={() => setReceipt(null)}>Start new sale</Button>
      </div>
      <style>{'@media print{body *{visibility:hidden}#pos-receipt,#pos-receipt *{visibility:visible}#pos-receipt{position:absolute;top:0;left:0;width:100%}}'}</style>
    </div>
  );

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">Store tools / Checkout</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Point of Sale</h1>
          <p className="mt-1 text-sm text-muted-foreground">Find products quickly, build a basket, and check out in store.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <span><strong>{cartQuantity}</strong> item{cartQuantity === 1 ? '' : 's'} in basket</span>
        </div>
      </header>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => navigate('/dashboard/pos/history')}><History className="mr-2 h-4 w-4" />View sales history</Button>
      </div>

      <div className="grid items-start gap-5">
        <section className="min-w-0 rounded-2xl border bg-card shadow-sm">
          <div className="border-b p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-semibold">Products</h2><p className="mt-1 text-sm text-muted-foreground">{visible.length} of {products.length} products</p></div>
              <Button variant="outline" size="sm" onClick={() => void loadProducts()} disabled={loading}>{loading ? 'Loading…' : 'Refresh stock'}</Button>
            </div>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by product name…" className="h-11 w-full rounded-xl border bg-background pl-10 pr-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" />
              {search && <button aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {([{ id: 'all', label: 'All products' }, { id: 'available', label: 'In stock' }, { id: 'low', label: 'Low stock' }] as const).map((filter) => (
                <button key={filter.id} onClick={() => setStockFilter(filter.id)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${stockFilter === filter.id ? 'border-primary bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>{filter.label}</button>
              ))}
            </div>
          </div>
          <div className="p-4 sm:p-5">
            {loading ? <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-52 animate-pulse rounded-xl bg-muted" />)}</div>
              : visible.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center text-center"><ShoppingBag className="h-10 w-10 text-muted-foreground/50" /><p className="mt-3 font-medium">{search ? 'No matching products' : 'No products to show'}</p><p className="mt-1 text-sm text-muted-foreground">{search ? 'Try another name or clear your search.' : 'Active original products will appear here.'}</p>{(search || stockFilter !== 'all') && <Button className="mt-3" variant="outline" size="sm" onClick={() => { setSearch(''); setStockFilter('all'); }}>Clear filters</Button>}</div>
              : <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((product) => {
                  const unavailable = product.is_out_of_stock || product.stock_quantity < 1;
                  const inCart = cart.find((line) => line.product.id === product.id)?.quantity || 0;
                  return <article key={product.id} className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-100 bg-white transition-shadow hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-white p-2 dark:bg-gray-700 sm:p-3">
                      {product.images?.[0] ? <img src={product.images[0]} alt={product.name} loading="lazy" className="h-full w-full object-contain transition duration-200" /> : <ShoppingBag className="h-10 w-10 text-muted-foreground/40" />}
                      <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[11px] font-medium ${unavailable ? 'bg-destructive/10 text-destructive' : product.stock_quantity <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{unavailable ? 'Out of stock' : product.stock_quantity <= 5 ? `Only ${product.stock_quantity} left` : `${product.stock_quantity} in stock`}</span>
                      {inCart > 0 && <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center gap-1 rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground"><Check className="h-3 w-3" />{inCart}</span>}
                    </div>
                    <div className="flex flex-1 flex-col p-2 sm:p-3">
                      <h3 className="line-clamp-2 min-h-9 text-xs font-semibold leading-4 text-gray-900 dark:text-white sm:text-sm" title={product.name}>{product.name}</h3>
                      <p className="mt-2 text-sm font-bold text-orange-600 sm:text-base">{money(Number(product.selling_price) || 0)}</p>
                      <Button className="mt-3 w-full" size="sm" variant={inCart ? 'secondary' : 'default'} disabled={unavailable || inCart >= product.stock_quantity} onClick={() => add(product)}>
                        <Plus className="mr-1.5 h-4 w-4" />{unavailable ? 'Unavailable' : inCart ? 'Add another' : 'Add to basket'}
                      </Button>
                    </div>
                  </article>;
                })}
              </div>}
          </div>
        </section>

        {cartOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setCartOpen(false); }}><aside className="flex max-h-[96dvh] w-full flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:max-h-[92dvh] sm:max-w-xl sm:rounded-2xl">
          <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b bg-card p-4 sm:p-5">
            <div><h2 className="text-lg font-semibold">Current sale</h2><p className="mt-1 text-sm text-muted-foreground">{cart.length} product type{cart.length === 1 ? '' : 's'} · {cartQuantity} item{cartQuantity === 1 ? '' : 's'}</p></div>
            <button type="button" aria-label="Close current sale" onClick={() => setCartOpen(false)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
          <div className="min-h-[18dvh] flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:min-h-0 sm:p-5">
            {cart.length === 0 ? <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed text-center"><ShoppingCart className="h-8 w-8 text-muted-foreground/40" /><p className="mt-2 text-sm font-medium">Your basket is empty</p><p className="mt-1 text-xs text-muted-foreground">Add products from the list to get started.</p></div>
              : cart.map((line) => <div key={line.product.id} className="flex gap-3 rounded-xl border p-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">{line.product.images?.[0] ? <img src={line.product.images[0]} alt="" className="h-full w-full object-contain" /> : <ShoppingBag className="h-5 w-5 text-muted-foreground/50" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="line-clamp-2 text-sm font-medium">{line.product.name}</p><button aria-label={`Remove ${line.product.name}`} onClick={() => setCart((old) => old.filter((item) => item.product.id !== line.product.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></div>
                  <label className="mt-2 block text-xs text-muted-foreground">Unit price (₦)<input aria-label={`Unit price for ${line.product.name}`} className="mt-1 h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground" type="number" min="0" value={line.price} onChange={(event) => setCart((old) => old.map((item) => item.product.id === line.product.id ? { ...item, price: Math.max(0, Number(event.target.value) || 0) } : item))} /></label>
                  <div className="mt-2 flex items-center justify-between gap-2"><div className="flex items-center rounded-lg border"><button aria-label="Decrease quantity" disabled={line.quantity <= 1} onClick={() => changeQuantity(line.product.id, line.quantity - 1)} className="p-1.5 disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button><span className="min-w-7 text-center text-sm font-semibold">{line.quantity}</span><button aria-label="Increase quantity" disabled={line.quantity >= line.product.stock_quantity} onClick={() => changeQuantity(line.product.id, line.quantity + 1)} className="p-1.5 disabled:opacity-30"><Plus className="h-3.5 w-3.5" /></button></div><span className="text-sm font-semibold">{money(line.price * line.quantity)}</span></div>
                </div>
              </div>)}
          </div>
          <div className="shrink-0 space-y-2 overflow-y-auto border-t bg-card p-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:space-y-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2 sm:gap-3 2xl:grid-cols-1">
              <label className="block text-sm font-medium">Customer name <span className="text-destructive">*</span><input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Enter customer name" className="mt-1 h-9 w-full min-w-0 rounded-lg border bg-background px-2 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
              <label className="block text-sm font-medium">Phone <span className="font-normal text-muted-foreground">(optional)</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Customer phone number" className="mt-1 h-9 w-full min-w-0 rounded-lg border bg-background px-2 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></label>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 2xl:grid-cols-1">
              <label className="block text-sm font-medium">Payment method<select value={method} onChange={(event) => setMethod(event.target.value as typeof method)} className="mt-1 h-9 w-full min-w-0 rounded-lg border bg-background px-2 text-sm font-normal"><option value="cash">Cash</option><option value="transfer">Bank transfer</option><option value="pos">POS / Card</option><option value="check">Cheque</option></select></label>
              <label className="block text-sm font-medium">Discount (₦)<input type="number" min="0" max={subtotal} value={discount} onChange={(event) => setDiscount(event.target.value)} className="mt-1 h-9 w-full min-w-0 rounded-lg border bg-background px-2 text-sm font-normal" /></label>
            </div>
            <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-sm sm:space-y-2 sm:p-4">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{money(subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>−{money(cut)}</span></div>
              <div className="flex justify-between border-t pt-3 text-base font-bold"><span>Total due</span><span>{money(total)}</span></div>
            </div>
            <Button className="h-10 w-full" disabled={busy || !cart.length || !customer.trim()} onClick={sell}>{busy ? 'Recording sale…' : `Complete sale · ${money(total)}`}</Button>
            {cart.length > 0 && <Button variant="ghost" className="w-full text-muted-foreground" disabled={busy} onClick={() => setCart([])}>Clear basket</Button>}
          </div>
        </aside></div>}
      </div>
      <button type="button" onClick={() => setCartOpen(true)} className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex items-center gap-2 rounded-full bg-orange-500 px-3 py-3 text-white shadow-xl hover:bg-orange-600 sm:bottom-5 sm:right-5 sm:gap-3 sm:px-4 sm:py-4"><span className="relative"><ShoppingCart className="h-6 w-6" />{cartQuantity > 0 && <span className="absolute -right-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-orange-500 bg-white px-1 text-[10px] font-bold text-orange-600">{cartQuantity}</span>}</span><span className="text-sm font-semibold">Current sale</span><span className="rounded-full bg-white/20 px-2 py-1 text-xs font-bold">{money(total)}</span></button>
    </div>
  );
}

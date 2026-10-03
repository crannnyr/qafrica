import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock, ShoppingCart } from 'lucide-react';
import { useCartStore, useCustomerAuthStore } from '@/stores';
import { useImportCartStore } from '@/stores/importCartStore';
import ImportCheckoutSheet from '@/pages/recommendations/ImportCheckoutSheet';
import ShopCheckoutPage from './CheckoutPage';
import { CHECKOUT_SELECTION_KEY } from './CartPage';

export default function UnifiedCheckoutPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const normalItems = useCartStore(s => s.items);
  const importItems = useImportCartStore(s => s.cart);
  const addOne = useImportCartStore(s => s.addOne);
  const removeOne = useImportCartStore(s => s.removeOne);
  const setQuantity = useImportCartStore(s => s.setQuantity);
  const { customer, isAuthenticated } = useCustomerAuthStore();

  const selectedNormalIds = useMemo(() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(CHECKOUT_SELECTION_KEY) ?? 'null');
      return Array.isArray(parsed) ? parsed : normalItems.map(i => i.id);
    } catch { return normalItems.map(i => i.id); }
  }, [normalItems]);

  const selectedImportKeys = useMemo(() => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem('qafrica_import_checkout_selection') ?? 'null');
      return Array.isArray(parsed) ? parsed : importItems.map(i => i.cart_key);
    } catch { return importItems.map(i => i.cart_key); }
  }, [importItems]);

  const selectedNormals = normalItems.filter(i => selectedNormalIds.includes(i.id));
  const selectedImports = importItems.filter(i => selectedImportKeys.includes(i.cart_key));
  const hasNormal = selectedNormals.length > 0;
  const hasImport = selectedImports.length > 0;

  if (params.get('source') === 'china_import' && hasImport) {
    if (!isAuthenticated || !customer) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <p className="text-lg font-semibold">Sign in to continue</p>
            <p className="mt-2 text-sm text-gray-500">China Import checkout requires a customer account.</p>
            <Link to={'/customer/login?return=' + encodeURIComponent('/checkout?source=china_import')} className="mt-5 inline-flex h-11 px-5 items-center rounded-xl bg-gray-900 text-white text-sm font-semibold">Sign in</Link>
          </div>
        </div>
      );
    }
    return <ImportCheckoutSheet cart={selectedImports} customer={customer} onClose={() => navigate('/cart')} onAdd={addOne} onRemove={removeOne} onSetQuantity={setQuantity} />;
  }

  if (params.get('source') === 'normal' || (hasNormal && !hasImport)) {
    sessionStorage.setItem(CHECKOUT_SELECTION_KEY, JSON.stringify(selectedNormals.map(i => i.id)));
    return <ShopCheckoutPage />;
  }

  if (!hasNormal && !hasImport) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center"><ShoppingCart className="w-10 h-10 mx-auto text-gray-300" /><p className="mt-4 font-semibold">Nothing to check out</p><Link to="/cart" className="mt-4 inline-block text-sm underline">Back to cart</Link></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F6]">
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4">
        <button onClick={() => navigate('/cart')} className="p-2 -ml-2" aria-label="Back to cart"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="ml-2 text-[15px] font-semibold">Checkout</h1>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500"><Lock className="w-3.5 h-3.5" /> Secure</span>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold">Choose a fulfillment checkout</h2>
          <p className="mt-2 text-sm text-gray-500">Store products and China Import products use separate server-side order and payment pipelines. Complete either group first; the other remains in your cart.</p>
          <div className="mt-5 space-y-3">
            {hasNormal && <button onClick={() => { sessionStorage.setItem(CHECKOUT_SELECTION_KEY, JSON.stringify(selectedNormals.map(i => i.id))); navigate('/checkout?source=normal'); }} className="w-full rounded-xl border p-4 text-left"><p className="font-semibold text-sm">Store products</p><p className="mt-1 text-xs text-gray-500">{selectedNormals.length} item{selectedNormals.length === 1 ? '' : 's'}</p></button>}
            {hasImport && <button onClick={() => { sessionStorage.setItem('qafrica_import_checkout_selection', JSON.stringify(selectedImports.map(i => i.cart_key))); navigate('/checkout?source=china_import'); }} className="w-full rounded-xl border p-4 text-left"><p className="font-semibold text-sm">QAFRICA · China Import</p><p className="mt-1 text-xs text-gray-500">{selectedImports.length} item{selectedImports.length === 1 ? '' : 's'}</p></button>}
          </div>
        </section>
      </main>
    </div>
  );
}
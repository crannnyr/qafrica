import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, Search, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Loader, Plus, Minus, Save, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';
import { getManagementToken } from './ManagementAuth';
import { useImportAdminPermissions } from '@/hooks/useImportAdminPermissions';

const EDGE_URL = CONFIG.SUPABASE_URL + '/functions/v1/import-management';
const PAGE_SIZE = 50;

type InventoryRow = {
  id: string;
  name: string;
  image_url?: string | null;
  category?: string | null;
  parent_category?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  is_active?: boolean;
  has_variants?: boolean;
  variant_options?: Record<string, string> | null;
  variant_label?: string;
  stock_quantity: number;
  stock_updated_at?: string | null;
};

type ProductGroup = {
  id: string;
  name: string;
  image_url?: string | null;
  category?: string | null;
  parent_category?: string | null;
  is_active?: boolean;
  variants: InventoryRow[];
};

type Pagination = { page: number; per_page: number; total: number; page_count: number };
type Category = { id: string; name: string; subcategories: { id: string; name: string }[] };

type ProductReceiveResult = {
  mode: 'product';
  product: {
    id: string;
    name: string;
    image_url?: string | null;
    china_import_barcode?: string | null;
  };
  variants: Array<{
    variant_options: Record<string, string>;
    variant_label: string;
    stock_quantity: number;
    stock_updated_at?: string | null;
  }>;
};

type ReceiptReceiveResult = {
  mode: 'receipt';
  receiving: {
    id: string;
    receiving_code: string;
    invoice_id: string;
    invoice_code?: string | null;
    supplier_id?: string | null;
    product_id: string;
    product_name: string;
    product_image?: string | null;
    variant_options: Record<string, string>;
    china_import_barcode?: string | null;
    expected_quantity: number;
    previously_received: number;
    remaining_quantity: number;
  };
};

type ReceivingResult = ProductReceiveResult | ReceiptReceiveResult;

function canonicalVariantKey(value: Record<string, unknown> | null | undefined) {
  return JSON.stringify(
    Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b)),
  );
}

const variantKey = (row: InventoryRow) => row.id + '|' + canonicalVariantKey(row.variant_options);

export default function ImportAdminV2Inventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [subtractDrafts, setSubtractDrafts] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: PAGE_SIZE, total: 0, page_count: 1 });
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [chinaImportBarcode, setChinaImportBarcode] = useState('');
  const [barcodeSearching, setBarcodeSearching] = useState(false);
  const [receivingResult, setReceivingResult] = useState<ReceivingResult | null>(null);
  const [productReceiveDrafts, setProductReceiveDrafts] = useState<Record<string, string>>({});
  const [receiptQuantity, setReceiptQuantity] = useState('');
  const [receivingSaving, setReceivingSaving] = useState(false);
  const { hasPermission } = useImportAdminPermissions(getManagementToken());
  const canAddStock = hasPermission('import.inventory.add');
  const canSubtractStock = hasPermission('import.inventory.subtract');
  const selectedCategory = categories.find(category => category.id === categoryId);
  const findByChinaImportBarcode = async () => {
    const barcode = chinaImportBarcode.trim();
    if (!barcode) {
      toast.error('Scan or enter a product barcode or receiving code');
      return;
    }
    const token = getManagementToken();
    if (!token) {
      toast.error('Management session expired');
      return;
    }
    setBarcodeSearching(true);
    try {
      const res = await fetch(EDGE_URL + '?action=admin-inventory-receiving-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, barcode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not find barcode');
      if (data.mode === 'none') {
        toast.error('No China-import product or receiving code found');
        return;
      }

      setSearch('');
      setCategoryId('');
      setSubcategoryId('');
      setChinaImportBarcode('');

      if (data.mode === 'receipt' && data.receiving) {
        const receiving = data.receiving as ReceiptReceiveResult['receiving'];
        setReceivingResult({ mode: 'receipt', receiving });
        setReceiptQuantity(String(Math.max(receiving.remaining_quantity, 0)));
        setProductReceiveDrafts({});
        await load(1, undefined, {
          search: '',
          categoryId: '',
          subcategoryId: '',
          productId: receiving.product_id,
        });
        setExpanded({ [receiving.product_id]: true });
        toast.success('Receiving item found: ' + receiving.product_name);
        return;
      }

      if (data.mode === 'product' && data.product) {
        const product = data as ProductReceiveResult;
        setReceivingResult(product);
        setReceiptQuantity('');
        const initialDrafts = Object.fromEntries(product.variants.map((variant, index) => [
          canonicalVariantKey(variant.variant_options) + '|' + index,
          '',
        ]));
        setProductReceiveDrafts(initialDrafts);
        await load(1, undefined, {
          search: '',
          categoryId: '',
          subcategoryId: '',
          productId: product.product.id,
        });
        setExpanded({ [product.product.id]: true });
        toast.success('Product found: ' + product.product.name);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not find barcode');
    } finally {
      setBarcodeSearching(false);
    }
  };

  const closeReceiving = (force = false) => {
    if (receivingSaving && !force) return;
    setReceivingResult(null);
    setProductReceiveDrafts({});
    setReceiptQuantity('');
  };

  const receiveProductBarcode = async () => {
    if (!canAddStock || receivingResult?.mode !== 'product') return;
    const token = getManagementToken();
    if (!token) {
      toast.error('Management session expired');
      return;
    }
    const lines = receivingResult.variants.map((variant, index) => ({
      variant_options: variant.variant_options ?? {},
      quantity: Number(productReceiveDrafts[canonicalVariantKey(variant.variant_options) + '|' + index] || 0),
    })).filter(line => Number.isInteger(line.quantity) && line.quantity > 0);

    if (!lines.length) {
      toast.error('Enter the quantity you physically received. Leave unseen variants at 0.');
      return;
    }

    setReceivingSaving(true);
    try {
      const res = await fetch(EDGE_URL + '?action=admin-inventory-receive-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          product_id: receivingResult.product.id,
          lines,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not receive product stock');
      const total = Number(data.received_quantity ?? lines.reduce((sum, line) => sum + line.quantity, 0));
      toast.success('Received ' + total.toLocaleString() + ' unit' + (total === 1 ? '' : 's') + ' into inventory');
      const productId = receivingResult.product.id;
      closeReceiving(true);
      await load(1, undefined, { search: '', categoryId: '', subcategoryId: '', productId });
      setExpanded({ [productId]: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not receive product stock');
    } finally {
      setReceivingSaving(false);
    }
  };

  const receiveReceiptItem = async () => {
    if (!canAddStock || receivingResult?.mode !== 'receipt') return;
    const token = getManagementToken();
    if (!token) {
      toast.error('Management session expired');
      return;
    }
    const quantity = Number(receiptQuantity || 0);
    const remaining = receivingResult.receiving.remaining_quantity;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error('Enter a positive whole number');
      return;
    }
    if (quantity > remaining) {
      toast.error('You cannot receive more than the remaining quantity of ' + remaining.toLocaleString());
      return;
    }

    setReceivingSaving(true);
    try {
      const res = await fetch(EDGE_URL + '?action=admin-inventory-receive-invoice-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          invoice_item_id: receivingResult.receiving.id,
          quantity,
          source: 'receiving_code',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not receive this item');
      const receiving = data.receiving;
      const productId = receivingResult.receiving.product_id;
      toast.success('Received ' + quantity.toLocaleString() + ' unit' + (quantity === 1 ? '' : 's') + ' for ' + receivingResult.receiving.product_name);
      closeReceiving();
      await load(1, undefined, { search: '', categoryId: '', subcategoryId: '', productId });
      setExpanded({ [productId]: true });
      if (Number(receiving?.remaining_quantity ?? 0) === 0) {
        toast.success('This receiving item is now complete');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not receive this item');
    } finally {
      setReceivingSaving(false);
    }
  };

  const availableSubcategories = selectedCategory?.subcategories ?? [];

  const products = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>();
    rows.forEach(row => {
      const existing = map.get(row.id);
      if (existing) {
        existing.variants.push(row);
      } else {
        map.set(row.id, {
          id: row.id,
          name: row.name,
          image_url: row.image_url,
          category: row.category,
          parent_category: row.parent_category,
          is_active: row.is_active,
          variants: [row],
        });
      }
    });
    return Array.from(map.values());
  }, [rows]);

  const load = useCallback(async (
    page = 1,
    signal?: AbortSignal,
    overrides?: { search?: string; categoryId?: string; subcategoryId?: string; productId?: string },
  ) => {
    const token = getManagementToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(EDGE_URL + '?action=admin-inventory-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          page,
          per_page: PAGE_SIZE,
          search: (overrides?.search ?? search).trim(),
          category_id: overrides?.categoryId ?? categoryId,
          subcategory_id: overrides?.subcategoryId ?? subcategoryId,
          product_id: overrides?.productId ?? '',
        }),
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load inventory');
      const next = Array.isArray(data.products) ? data.products : [];
      setRows(next);
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setDrafts(Object.fromEntries(next.map((row: InventoryRow) => [variantKey(row), ''])));
      setSubtractDrafts(Object.fromEntries(next.map((row: InventoryRow) => [variantKey(row), ''])));
      setPagination(data.pagination ?? { page, per_page: PAGE_SIZE, total: 0, page_count: 1 });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Could not load inventory');
      setRows([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [search, categoryId, subcategoryId]);

  useEffect(() => {
    if (receivingResult) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(1, controller.signal), search.trim() ? 350 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, receivingResult]);

  const saveStock = async (row: InventoryRow) => {
    if (!canAddStock) {
      toast.error('You do not have permission to add inventory stock. Ask an administrator to grant Inventory → Add stock.');
      return;
    }
    const token = getManagementToken();
    if (!token) {
      toast.error('Management session expired');
      return;
    }
    const quantityToAdd = Number(drafts[variantKey(row)] || 0);
    if (!Number.isInteger(quantityToAdd) || quantityToAdd <= 0) {
      toast.error('Enter a whole number greater than 0 to add');
      return;
    }

    const key = variantKey(row);
    setSaving(key);
    try {
      const res = await fetch(EDGE_URL + '?action=admin-inventory-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          product_id: row.id,
          variant_options: row.variant_options ?? {},
          quantity_to_add: quantityToAdd,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not add stock');
      const nextQuantity = Number(data.inventory?.quantity ?? row.stock_quantity + quantityToAdd);
      setRows(current => current.map(item => variantKey(item) === key
        ? { ...item, stock_quantity: nextQuantity, stock_updated_at: data.inventory?.updated_at ?? new Date().toISOString() }
        : item));
      setDrafts(current => ({ ...current, [key]: '' }));
      toast.success('Added ' + quantityToAdd.toLocaleString() + ' unit' + (quantityToAdd === 1 ? '' : 's') + '. New stock: ' + nextQuantity.toLocaleString());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add stock');
    } finally {
      setSaving(null);
    }
  };

  const subtractStock = async (row: InventoryRow) => {
    const token = getManagementToken();
    if (!token) {
      toast.error('Management session expired');
      return;
    }
    if (!canSubtractStock) {
      toast.error('You do not have permission to subtract inventory stock');
      return;
    }

    const quantityToSubtract = Number(subtractDrafts[variantKey(row)] || 0);
    if (!Number.isInteger(quantityToSubtract) || quantityToSubtract <= 0) {
      toast.error('Enter a whole number greater than 0 to subtract');
      return;
    }
    if (quantityToSubtract > row.stock_quantity) {
      toast.error('You cannot subtract more than the current stock');
      return;
    }

    const key = variantKey(row);
    setSaving('subtract:' + key);
    try {
      const res = await fetch(EDGE_URL + '?action=admin-inventory-subtract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          product_id: row.id,
          variant_options: row.variant_options ?? {},
          quantity_to_subtract: quantityToSubtract,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not subtract stock');

      const nextQuantity = Number(data.inventory?.quantity ?? row.stock_quantity - quantityToSubtract);
      setRows(current => current.map(item => variantKey(item) === key
        ? { ...item, stock_quantity: nextQuantity, stock_updated_at: data.inventory?.updated_at ?? new Date().toISOString() }
        : item));
      setSubtractDrafts(current => ({ ...current, [key]: '' }));
      toast.success('Subtracted ' + quantityToSubtract.toLocaleString() + ' unit' + (quantityToSubtract === 1 ? '' : 's') + '. New stock: ' + nextQuantity.toLocaleString());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not subtract stock');
    } finally {
      setSaving(null);
    }
  };

  const totalStock = rows.reduce((sum, row) => sum + Number(row.stock_quantity || 0), 0);
  const lowStock = rows.filter(row => row.stock_quantity > 0 && row.stock_quantity <= 5).length;

  return (
    <div className="space-y-4">
      {receivingResult && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-3xl max-h-[92vh] overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wide font-black text-orange-500">
                  {receivingResult.mode === 'receipt' ? 'Receiving code found' : 'Product barcode found'}
                </p>
                <h2 className="text-base font-black text-gray-900 mt-1">
                  {receivingResult.mode === 'receipt' ? receivingResult.receiving.product_name : receivingResult.product.name}
                </h2>
                <p className="text-[11px] text-gray-400 mt-1">
                  {receivingResult.mode === 'receipt'
                    ? 'Only the quantity you confirm will be added to inventory.'
                    : 'Enter only what you physically received. Leave unseen variants at 0.'}
                </p>
              </div>
              <button type="button" onClick={() => closeReceiving()} disabled={receivingSaving} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>

            {receivingResult.mode === 'receipt' ? (
              <div className="p-5 overflow-y-auto max-h-[65vh] space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[9px] uppercase text-gray-400 font-bold">Invoice</p>
                    <p className="text-xs font-black text-gray-800 mt-1">{receivingResult.receiving.invoice_code || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[9px] uppercase text-gray-400 font-bold">Expected</p>
                    <p className="text-xs font-black text-gray-800 mt-1">{receivingResult.receiving.expected_quantity.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[9px] uppercase text-gray-400 font-bold">Previously received</p>
                    <p className="text-xs font-black text-gray-800 mt-1">{receivingResult.receiving.previously_received.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl bg-orange-50 p-3">
                    <p className="text-[9px] uppercase text-orange-500 font-bold">Remaining</p>
                    <p className="text-xs font-black text-orange-700 mt-1">{receivingResult.receiving.remaining_quantity.toLocaleString()}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-gray-800">Variant</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{Object.entries(receivingResult.receiving.variant_options ?? {}).map(([key, value]) => key + ': ' + value).join(' · ') || 'Base / no variant'}</p>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500">{receivingResult.receiving.receiving_code}</span>
                  </div>
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-gray-800">Physical quantity received</p>
                      <p className="text-[10px] text-gray-400 mt-1">Maximum {receivingResult.receiving.remaining_quantity.toLocaleString()}</p>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={receivingResult.receiving.remaining_quantity}
                      step="1"
                      value={receiptQuantity}
                      onChange={e => setReceiptQuantity(e.target.value)}
                      className="w-28 px-3 py-2.5 rounded-xl border border-orange-200 text-sm font-black text-center outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 overflow-y-auto max-h-[65vh]">
                <div className="mb-4 rounded-xl bg-orange-50 border border-orange-100 px-4 py-3">
                  <p className="text-xs font-bold text-orange-800">Product receiving</p>
                  <p className="text-[10px] text-orange-700 mt-1">The barcode identifies the product and its variants. It does not guess what physically arrived, so enter the quantities you counted.</p>
                </div>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left">
                      <thead className="bg-gray-50">
                        <tr className="text-[9px] uppercase tracking-wide text-gray-400">
                          <th className="px-4 py-2.5 font-bold">Variant</th>
                          <th className="px-4 py-2.5 font-bold">Current stock</th>
                          <th className="px-4 py-2.5 font-bold">Received now</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {receivingResult.variants.map((variant, index) => {
                          const key = JSON.stringify(variant.variant_options ?? {}) + '|' + index;
                          return (
                            <tr key={key}>
                              <td className="px-4 py-3 text-xs font-semibold text-gray-700">{variant.variant_label}</td>
                              <td className="px-4 py-3 text-xs font-black text-gray-600">{variant.stock_quantity.toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  placeholder="0"
                                  value={productReceiveDrafts[key] ?? ''}
                                  onChange={e => setProductReceiveDrafts(current => ({ ...current, [key]: e.target.value }))}
                                  className="w-28 px-3 py-2 rounded-lg border border-gray-200 text-sm font-black outline-none focus:border-orange-500"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 bg-white">
              <div className="text-[10px] text-gray-400">
                {receivingResult.mode === 'receipt'
                  ? 'The confirmed quantity is added to the exact invoice variant.'
                  : 'Zero/blank variants are ignored; only entered quantities are added.'}
              </div>
              <button
                type="button"
                onClick={() => void (receivingResult.mode === 'receipt' ? receiveReceiptItem() : receiveProductBarcode())}
                disabled={receivingSaving || !canAddStock}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black disabled:opacity-40"
              >
                {receivingSaving ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {receivingSaving ? 'Receiving…' : 'Confirm receiving'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-orange-500" />
              <h1 className="font-bold text-gray-900 text-sm">Inventory</h1>
              <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{pagination.total.toLocaleString()} products</span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Tap a product to view and add stock to each variant combination.</p>
          </div>
          <button onClick={() => void load(pagination.page)} disabled={loading} className="p-2 hover:bg-gray-100 rounded-lg" title="Refresh inventory">
            <RefreshCw className={loading ? 'w-4 h-4 text-gray-400 animate-spin' : 'w-4 h-4 text-gray-400'} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2 bg-orange-50/40">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-400" />
            <input value={chinaImportBarcode} onChange={e => setChinaImportBarcode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void findByChinaImportBarcode(); }} placeholder="Scan product barcode or receiving code…" inputMode="text" autoComplete="off" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-orange-200 bg-white text-sm outline-none focus:border-orange-500" />
          </div>
          <button onClick={() => void findByChinaImportBarcode()} disabled={barcodeSearching} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold disabled:opacity-50">
            {barcodeSearching ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            {barcodeSearching ? 'Finding…' : 'Find / receive'}
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product name…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-500" />
          </div>
          <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setSubcategoryId(''); }} className="min-w-[170px] px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 outline-none focus:border-orange-500">
            <option value="">All categories</option>
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select value={subcategoryId} onChange={e => setSubcategoryId(e.target.value)} disabled={!categoryId} className="min-w-[170px] px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 outline-none focus:border-orange-500 disabled:bg-gray-50 disabled:text-gray-400">
            <option value="">All subcategories</option>
            {availableSubcategories.map(subcategory => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
          </select>
          <span className="px-3 py-2.5 rounded-xl bg-gray-50 text-[11px] font-semibold text-gray-500">Visible stock: {totalStock.toLocaleString()}</span>
          {lowStock > 0 && <span className="px-3 py-2.5 rounded-xl bg-amber-50 text-[11px] font-semibold text-amber-700">{lowStock} low-stock</span>}
        </div>

        {error && <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] table-fixed text-left">
            <colgroup>
              <col className="w-[46%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-bold">Product</th>
                <th className="px-4 py-3 font-bold">Total stock</th>
                <th className="px-4 py-3 font-bold">Stock status</th>
                <th className="px-4 py-3 font-bold">Variants</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center"><Loader className="w-5 h-5 text-orange-500 animate-spin mx-auto" /></td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-gray-400">No inventory products found.</td></tr>
              ) : products.map(product => {
                const isOpen = !!expanded[product.id];
                const productStock = product.variants.reduce((sum, row) => sum + Number(row.stock_quantity || 0), 0);
                const hasRealVariants = product.variants.some(row => row.variant_options && Object.keys(row.variant_options).length > 0);
                const optionNames = Array.from(new Set(product.variants.flatMap(row => Object.keys(row.variant_options ?? {}))));
                return (
                  <>
                  <tr key={product.id} className="align-middle">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => setExpanded(current => ({ ...current, [product.id]: !isOpen }))}
                          className="p-0.5 rounded text-left hover:bg-gray-100 flex-shrink-0"
                          aria-label={isOpen ? 'Collapse product' : 'Expand product'}
                        >
                          <ChevronDown className={isOpen ? 'w-4 h-4 text-orange-500 transition-transform' : 'w-4 h-4 text-gray-400 -rotate-90 transition-transform'} />
                        </button>
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          {product.image_url ? <img src={product.image_url} alt="" className="w-full h-full object-cover" /> : null}
                        </div>
                        <div className="min-w-0">
                          <a
                            href={'/recommendations/' + product.id}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm font-semibold text-gray-900 truncate hover:text-orange-500 hover:underline"
                            title="Open product page"
                          >
                            {product.name}
                          </a>
                          <p className="text-[10px] text-gray-400 mt-0.5">{hasRealVariants ? product.variants.length.toLocaleString() + ' variant combinations' : 'No variants'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={productStock > 0 ? 'inline-flex min-w-[58px] justify-center px-2.5 py-1.5 rounded-lg text-xs font-black bg-emerald-50 text-emerald-700' : 'inline-flex min-w-[58px] justify-center px-2.5 py-1.5 rounded-lg text-xs font-black bg-gray-100 text-gray-500'}>
                        {productStock.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={productStock > 0 ? 'inline-flex min-w-[70px] justify-center px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold' : 'inline-flex min-w-[70px] justify-center px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-bold'}>
                        {productStock > 0 ? 'In stock' : 'Out of stock'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpanded(current => ({ ...current, [product.id]: !isOpen }))}
                        className="inline-flex min-w-[110px] justify-center px-2.5 py-1.5 rounded-lg bg-orange-50 text-orange-600 text-[10px] font-bold hover:bg-orange-100"
                      >
                        {isOpen ? 'Hide variants' : hasRealVariants ? 'View variants' : 'View stock'}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={4} className="p-0">

                        <div className="bg-gray-50/70 border-t border-gray-100 px-5 py-3">
                          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-gray-800">{hasRealVariants ? 'Variant inventory' : 'Base inventory'}</p>
                                <p className="text-[10px] text-gray-400">Adding stock increases the current quantity; it never replaces it.</p>
                              </div>
                              <span className="text-[10px] font-semibold text-gray-500">{productStock.toLocaleString()} total units</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[560px] text-left">
                                <thead className="bg-gray-50">
                                  <tr className="text-[9px] uppercase tracking-wide text-gray-400">
                                    {optionNames.map(name => <th key={name} className="px-4 py-2.5 font-bold">{name}</th>)}
                                    {!optionNames.length && <th className="px-4 py-2.5 font-bold">Stock type</th>}
                                    <th className="px-4 py-2.5 font-bold">Current stock</th>
                                    <th className="px-4 py-2.5 font-bold">Add stock</th>
                                    <th className="px-4 py-2.5 font-bold">Subtract stock</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {product.variants.map(row => {
                                    const key = variantKey(row);
                                    const options = row.variant_options ?? {};
                                    return (
                                      <tr key={key}>
                                        {optionNames.map(name => <td key={name} className="px-4 py-3 text-xs font-semibold text-gray-700">{options[name] || '—'}</td>)}
                                        {!optionNames.length && <td className="px-4 py-3 text-xs font-semibold text-gray-700">Base / no variant</td>}
                                        <td className="px-4 py-3">
                                          <span className={row.stock_quantity > 0 ? 'inline-flex min-w-[48px] justify-center px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-black' : 'inline-flex min-w-[48px] justify-center px-2 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-black'}>
                                            {row.stock_quantity.toLocaleString()}
                                          </span>
                                        </td>
                                        <td className="px-4 py-3">
                                          {canAddStock ? (
                                            <>
                                              <div className="flex items-center gap-2">
                                                <div className="relative">
                                                  <Plus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    placeholder="0"
                                                    value={drafts[key] ?? ''}
                                                    onChange={e => setDrafts(current => ({ ...current, [key]: e.target.value }))}
                                                    className="w-24 pl-7 pr-2 py-2 rounded-lg border border-gray-200 text-sm font-semibold outline-none focus:border-orange-500"
                                                  />
                                                </div>
                                                <button
                                                  onClick={() => void saveStock(row)}
                                                  disabled={saving === key}
                                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-[10px] font-bold disabled:opacity-40"
                                                >
                                                  <Save className="w-3.5 h-3.5" />
                                                  {saving === key ? 'Adding…' : 'Add'}
                                                </button>
                                              </div>
                                              <p className="text-[9px] text-gray-400 mt-1">{row.stock_updated_at ? 'Updated ' + new Date(row.stock_updated_at).toLocaleString('en-NG') : 'No stock registered yet'}</p>
                                            </>
                                          ) : (
                                            <p className="text-[9px] text-gray-400">Add stock permission required.</p>
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          {canSubtractStock ? (
                                            <>
                                              <div className="flex items-center gap-2">
                                                <div className="relative">
                                                  <Minus className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                                  <input
                                                    type="number"
                                                    min="1"
                                                    max={row.stock_quantity}
                                                    step="1"
                                                    placeholder="0"
                                                    value={subtractDrafts[key] ?? ''}
                                                    onChange={e => setSubtractDrafts(current => ({ ...current, [key]: e.target.value }))}
                                                    className="w-24 pl-7 pr-2 py-2 rounded-lg border border-gray-200 text-sm font-semibold outline-none focus:border-red-400"
                                                  />
                                                </div>
                                                <button
                                                  onClick={() => void subtractStock(row)}
                                                  disabled={saving === 'subtract:' + key || row.stock_quantity <= 0}
                                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-[10px] font-bold disabled:opacity-40"
                                                >
                                                  <Minus className="w-3.5 h-3.5" />
                                                  {saving === 'subtract:' + key ? 'Subtracting…' : 'Subtract'}
                                                </button>
                                              </div>
                                              <p className="text-[9px] text-gray-400 mt-1">Maximum: {row.stock_quantity.toLocaleString()}</p>
                                            </>
                                          ) : (
                                            <span className="text-[10px] text-gray-400">Permission required</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-400">{pagination.total === 0 ? '0 products' : 'Showing ' + (((pagination.page - 1) * PAGE_SIZE) + 1) + '–' + Math.min(pagination.page * PAGE_SIZE, pagination.total) + ' of ' + pagination.total.toLocaleString()}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => void load(pagination.page - 1)} disabled={loading || pagination.page <= 1} className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-semibold text-gray-600 min-w-[80px] text-center">Page {pagination.page} of {pagination.page_count}</span>
            <button onClick={() => void load(pagination.page + 1)} disabled={loading || pagination.page >= pagination.page_count} className="p-2 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

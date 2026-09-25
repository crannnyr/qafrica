import { Fragment, useState, useEffect, useCallback } from 'react';
import { Loader, Package, Users, Archive, CheckCircle2, FileDown, Eye, X, MapPin, Pencil, Save, User, CreditCard, Trash2 } from 'lucide-react';
import CONFIG from '@/lib/config';
import { CustomerDetail } from '@/pages/import-admin/ImportAdminCustomers';
import ClosedBatchDetail from '@/pages/import-admin/ClosedBatchDetail';
import { toast } from 'sonner';

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/china-import`;

interface OrderItem {
  id: string;
  name: string;
  image_url: string;
  quantity: number;
  price_ngn?: number;
  variant_options?: Record<string, string>;
  shipping_method?: 'flight' | 'sea_freight' | string | null;
}
interface DeliveryAddress {
  name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  landmark?: string;
}
interface OrderRow {
  id: string;
  code: string;
  user_id: string | null;
  customer_name: string;
  customer_whatsapp: string;
  items: OrderItem[];
  payment_status: string;
  staged_at: string | null;
  created_at: string;
  status?: string;
  shipped_at?: string | null;
  shipping_method?: 'flight' | 'sea_freight' | 'mixed' | null;
  delivery_type?: string;
  delivery_mode?: string | null;
  delivery_address?: DeliveryAddress | null;
  pickup_station_name?: string | null;
  pickup_station_address?: string | null;
  subtotal_ngn?: number;
  jumia_fee_ngn?: number;
  shipping_ngn?: number;
  total_ngn?: number;
  payment_method?: string | null;
  payment_reference?: string | null;
  paid_at?: string | null;
}
interface Group {
  key: string;
  productId: string;
  name: string;
  image_url: string;
  variantLabel: string;
  totalQty: number;
  buyers: Array<{ name: string; whatsapp: string; qty: number; orderCode: string; userId: string | null }>;
  orderIds: string[];
  stagedAt: string | null;
}
interface ClosedBatch {
  batchKey: string;
  stagedAt: string;
  orderCount: number;
  productCount: number;
  buyerCount: number;
  totalUnits: number;
}

function buildClosedBatches(orders: OrderRow[]): ClosedBatch[] {
  const map = new Map<string, { orders: Set<string>; products: Set<string>; buyers: Set<string>; units: number }>();
  for (const order of orders) {
    if (!order.staged_at) continue;
    const entry = map.get(order.staged_at) ?? { orders: new Set(), products: new Set(), buyers: new Set(), units: 0 };
    entry.orders.add(order.id);
    entry.buyers.add(order.user_id ?? order.code);
    for (const item of order.items ?? []) {
      entry.products.add(item.id);
      entry.units += item.quantity;
    }
    map.set(order.staged_at, entry);
  }
  return Array.from(map.entries())
    .map(([stagedAt, v]) => ({
      batchKey: stagedAt,
      stagedAt,
      orderCount: v.orders.size,
      productCount: v.products.size,
      buyerCount: v.buyers.size,
      totalUnits: v.units,
    }))
    .sort((a, b) => new Date(b.stagedAt).getTime() - new Date(a.stagedAt).getTime());
}

function buildGroups(orders: OrderRow[], showClosed: boolean): Group[] {
  const map = new Map<string, Group>();
  for (const order of orders) {
    const isStaged = !!order.staged_at;
    if (isStaged !== showClosed) continue;
    for (const item of order.items ?? []) {
      const variantLabel = item.variant_options
        ? Object.entries(item.variant_options).map(([k, v]) => `${k}: ${v}`).join(', ')
        : '';
      const key = `${item.id}::${variantLabel}::${isStaged ? order.staged_at : ''}`;
      const existing = map.get(key) ?? {
        key,
        productId: item.id,
        name: item.name,
        image_url: item.image_url,
        variantLabel,
        totalQty: 0,
        buyers: [],
        orderIds: [],
        stagedAt: isStaged ? order.staged_at : null,
      };
      existing.totalQty += item.quantity;
      existing.buyers.push({
        name: order.customer_name,
        whatsapp: order.customer_whatsapp,
        qty: item.quantity,
        orderCode: order.code,
        userId: order.user_id ?? null,
      });
      existing.orderIds.push(order.id);
      map.set(key, existing);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}


function OrderDetails({ token, order, onClose, onReload, onOpenClient }: {
  token: string; order: OrderRow; onClose: () => void; onReload: () => Promise<void>; onOpenClient: (customerId: string) => void;
}) {
  const [addressEditing, setAddressEditing] = useState(false);
  const [address, setAddress] = useState<DeliveryAddress>(order.delivery_address ?? {
    name: order.customer_name, phone: order.customer_whatsapp, address_line1: '', address_line2: '', city: '', state: '', landmark: ''
  });
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [variantText, setVariantText] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [removingItem, setRemovingItem] = useState<number | null>(null);

  const items = order.items ?? [];

  useEffect(() => {
    setAddress(order.delivery_address ?? {
      name: order.customer_name,
      phone: order.customer_whatsapp,
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      landmark: '',
    });
    setAddressEditing(false);
    setEditingItem(null);
    setVariantText('');
  }, [order.id, order.delivery_address, order.customer_name, order.customer_whatsapp]);

  const canEditAddress = !order.shipped_at && !['shipped_and_closed', 'clearance_and_closed', 'received', 'delivered'].includes(order.status ?? '');

  const saveAddress = async () => {
    setSavingAddress(true);
    try {
      const res = await fetch(EDGE_URL + '?action=admin-update-order-address', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_id: order.id, delivery_address: address, delivery_mode: order.delivery_mode ?? 'home', pickup_station_name: order.pickup_station_name, pickup_station_address: order.pickup_station_address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? 'Could not update address');
      setAddressEditing(false); await onReload(); toast.success('Order address updated');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not update address'); }
    finally { setSavingAddress(false); }
  };

  const saveVariant = async (index: number) => {
    const item = items[index];
    let parsed: Record<string, string> = {};
    if (variantText.trim()) {
      for (const part of variantText.split(',')) {
        const bits = part.split(':'); const k = bits.shift(); const v = bits.join(':');
        if (k?.trim() && v?.trim()) parsed[k.trim()] = v.trim();
      }
    }
    setSavingItem(true);
    try {
      const res = await fetch(EDGE_URL + '?action=admin-set-item-variant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_id: order.id, product_id: item.id, old_variant_options: item.variant_options ?? null, new_variant_options: parsed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? 'Could not update product variant');
      setEditingItem(null); await onReload(); toast.success('Product details updated');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not update product'); }
    finally { setSavingItem(false); }
  };

  const removeItem = async (index: number) => {
    const item = items[index];
    if (!window.confirm('Remove "' + item.name + '" from order ' + order.code + '? This creates the existing item-cancellation/refund record.')) return;
    setRemovingItem(index);
    try {
      const res = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/refunds?action=admin-cancel-item', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_id: order.id, item_index: index, reason: 'Item removed by Import Management from Order Details.' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? 'Could not remove item');
      await onReload(); toast.success(data.order_fully_cancelled ? 'Order cancelled' : 'Item removed and refund created');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove item'); }
    finally { setRemovingItem(null); }
  };

  const money = (n: unknown) => '₦' + Math.round(Number(n ?? 0)).toLocaleString();
  const statusClass = (v: string) => v === 'paid' || v === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : v === 'cancelled' || v === 'refunded' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600';

  return (
    <div className="fixed inset-0 z-50 bg-black/20 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="h-full w-full sm:max-w-[520px] bg-white shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Order Details</p><h2 className="font-black text-gray-900">{order.code}</h2></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="flex flex-wrap gap-2">
            <span className={"px-2.5 py-1 rounded-full text-[10px] font-bold capitalize " + statusClass(order.status ?? '')}>{(order.status ?? 'unknown').replace(/_/g, ' ')}</span>
            <span className={"px-2.5 py-1 rounded-full text-[10px] font-bold capitalize " + statusClass(order.payment_status)}>{order.payment_status.replaceAll('_',' ')}</span>
            <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 text-[10px] font-semibold">{new Date(order.created_at).toLocaleString('en-NG')}</span>
          </div>

          <section className="rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3"><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Client</p>{order.user_id && <button onClick={() => onOpenClient(order.user_id!)} className="text-[10px] font-bold text-orange-600 hover:underline">Client details</button>}</div>
            <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"><User className="w-4 h-4 text-gray-400" /></div><div><p className="text-sm font-bold text-gray-800">{order.customer_name}</p><p className="text-xs text-gray-400">{order.customer_whatsapp}</p></div></div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2"><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Items ({items.length})</p><span className="text-[10px] text-gray-400">Product details</span></div>
            <div className="space-y-2">
              {items.map((item, i) => {
                const editing = editingItem === i;
                return <div key={item.id + '-' + i} className="rounded-xl border border-gray-100 p-3">
                  <div className="flex gap-3">
                    {item.image_url ? <img src={item.image_url} className="w-12 h-12 rounded-lg object-cover border border-gray-100" alt="" /> : <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center"><Package className="w-4 h-4 text-gray-300" /></div>}
                    <div className="flex-1 min-w-0"><p className="text-xs font-bold text-gray-800">{item.name}</p><p className="text-[10px] text-gray-400 mt-0.5">Qty ×{item.quantity} · {money(item.price_ngn)} each</p>{item.variant_options && Object.keys(item.variant_options).length > 0 && <p className="text-[10px] text-gray-500 mt-1">{Object.entries(item.variant_options).map(([k,v]) => k + ': ' + v).join(', ')}</p>}</div>
                    <div className="flex items-start gap-1"><button disabled={!item.variant_options || Object.keys(item.variant_options).length === 0} onClick={() => { setEditingItem(editing ? null : i); setVariantText(Object.entries(item.variant_options ?? {}).map(([k,v]) => k + ': ' + v).join(', ')); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed" title={item.variant_options && Object.keys(item.variant_options).length > 0 ? 'Edit product details' : 'This product has no variants'}><Pencil className="w-3.5 h-3.5" /></button><button disabled={removingItem === i} onClick={() => void removeItem(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="Remove item"><Trash2 className="w-3.5 h-3.5" /></button></div>
                  </div>
                  {editing && <div className="mt-3 pt-3 border-t border-gray-100"><label className="text-[10px] font-bold text-gray-400 uppercase">Product variant</label><input value={variantText} onChange={e => setVariantText(e.target.value)} placeholder="Color: Black, Size: Large" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-gray-400" /><p className="text-[9px] text-gray-400 mt-1">Variant changes use the product's configured pricing.</p><div className="flex justify-end gap-2 mt-2"><button onClick={() => setEditingItem(null)} className="px-3 py-1.5 text-xs text-gray-500">Cancel</button><button disabled={savingItem} onClick={() => void saveVariant(i)} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold flex items-center gap-1">{savingItem ? <Loader className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>} Save</button></div></div>}
                </div>;
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3"><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Delivery address</p>{canEditAddress && <button onClick={() => setAddressEditing(v => !v)} className="text-[10px] font-bold text-orange-600 flex items-center gap-1"><Pencil className="w-3 h-3"/> {addressEditing ? 'Close edit' : 'Edit address'}</button>}</div>
            {!addressEditing ? <div className="text-xs text-gray-600 space-y-1"><div className="flex gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5"/><div><p className="font-semibold text-gray-800">{order.delivery_address?.name ?? order.customer_name} · {order.delivery_address?.phone ?? order.customer_whatsapp}</p><p>{order.delivery_address?.address_line1 || 'No street address saved'}</p>{order.delivery_address?.address_line2 && <p>{order.delivery_address.address_line2}</p>}<p>{[order.delivery_address?.city, order.delivery_address?.state].filter(Boolean).join(', ')}</p>{order.delivery_address?.landmark && <p>Landmark: {order.delivery_address.landmark}</p>}{order.pickup_station_name && <p className="mt-1 text-gray-500">Pickup: {order.pickup_station_name}{order.pickup_station_address ? ' — ' + order.pickup_station_address : ''}</p>}</div></div></div> : <div className="grid grid-cols-2 gap-2">{(['name','phone','address_line1','address_line2','city','state','landmark'] as const).map(k => <div key={k} className={k === 'address_line1' || k === 'address_line2' || k === 'landmark' ? 'col-span-2' : ''}><label className="text-[9px] font-bold text-gray-400 uppercase">{k.replaceAll('_',' ')}</label><input value={address[k] ?? ''} onChange={e => setAddress(a => ({...a,[k]:e.target.value}))} className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs outline-none focus:border-gray-400" /></div>)}<div className="col-span-2 flex justify-end gap-2 mt-1"><button onClick={() => setAddressEditing(false)} className="px-3 py-1.5 text-xs text-gray-500">Cancel</button><button disabled={savingAddress} onClick={() => void saveAddress()} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold flex items-center gap-1">{savingAddress ? <Loader className="w-3 h-3 animate-spin"/> : <Save className="w-3 h-3"/>} Save address</button></div></div>}
          </section>

          <section className="rounded-2xl border border-gray-100 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Payment & total</p><div className="space-y-2 text-xs"><div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span className="font-semibold">{money(order.subtotal_ngn)}</span></div><div className="flex justify-between"><span className="text-gray-400">Jumia / delivery fee</span><span>{money(order.jumia_fee_ngn)}</span></div><div className="flex justify-between"><span className="text-gray-400">Shipping</span><span>{money(order.shipping_ngn)}</span></div><div className="border-t border-gray-100 pt-2 flex justify-between"><span className="font-bold text-gray-700">Total</span><span className="font-black text-gray-900">{money(order.total_ngn)}</span></div><div className="pt-1 text-[10px] text-gray-400 flex items-center gap-1"><CreditCard className="w-3 h-3"/>{order.payment_method ?? '—'}{order.payment_reference ? ' · ' + order.payment_reference : ''}</div></div></section>
        </div>
      </div>
    </div>
  );
}

export default function ManagementOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [closingKey, setClosingKey] = useState<string | null>(null);
  const [closingAll, setClosingAll] = useState(false);
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedBatchKey, setSelectedBatchKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const token = sessionStorage.getItem('import_manager_token') || '';

  const load = useCallback(async () => {
    if (!token) {
      setOrders([]);
      setIsLoading(false);
      toast.error('Management session expired');
      return;
    }
    setIsLoading(true);
    try {
      const staged = showClosed ? 'closed' : 'active';
      const res = await fetch(`${EDGE_URL}?action=all-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, payment_status: 'paid', staged }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error ?? `Could not load ${staged} orders`);
      setOrders(data.orders ?? []);
    } catch (error) {
      setOrders([]);
      toast.error(error instanceof Error ? error.message : 'Could not load orders');
    } finally {
      setIsLoading(false);
    }
  }, [showClosed, token]);

  useEffect(() => { void load(); }, [load]);

  const groups = buildGroups(orders, showClosed);
  const closedBatches = buildClosedBatches(orders);
  const selectedOrder = selectedOrderId ? orders.find(o => o.id === selectedOrderId) ?? null : null;

  const downloadCsv = (rows: Group[]) => {
    const header = ['Customer Name', 'WhatsApp', 'Order Code', 'Product', 'Variant', 'Quantity'];
    const lines = [header.join(',')];
    for (const g of rows) {
      for (const b of g.buyers) {
        const cells = [b.name, b.whatsapp, b.orderCode, g.name, g.variantLabel || '—', String(b.qty)]
          .map(v => `"${String(v).replace(/"/g, '""')}"`);
        lines.push(cells.join(','));
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qafrica-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const closeGroup = async (group: Group) => {
    setClosingKey(group.key);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-close-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_ids: group.orderIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) throw new Error(data.error ?? 'Could not close this batch');
      await load();
      toast.success('Batch closed successfully');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not close this batch');
    } finally {
      setClosingKey(null);
    }
  };

  const closeAll = async () => {
    if (!groups.length) return;
    setClosingAll(true);
    try {
      downloadCsv(groups);
      const orderIds = Array.from(new Set(groups.flatMap(g => g.orderIds).filter(Boolean)));
      const res = await fetch(`${EDGE_URL}?action=admin-close-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_ids: orderIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) throw new Error(data.error ?? 'Could not close the active orders');
      await load();
      toast.success(`Closed ${data.count ?? data.closed_count ?? orderIds.length} active orders`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not close the active orders');
    } finally {
      setClosingAll(false);
    }
  };

  if (selectedBatchKey) {
    return (
      <ClosedBatchDetail
        token={token}
        batchKey={selectedBatchKey}
        orders={orders.filter(o => o.staged_at === selectedBatchKey)}
        onClose={() => setSelectedBatchKey(null)}
        onReload={load}
      />
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Orders</h2>
          <p className="text-xs text-gray-400">Paid import orders grouped for sourcing and batch processing.</p>
        </div>
        <div className="flex items-center gap-2">
          {!showClosed && groups.length > 0 && (
            <>
              <button onClick={() => downloadCsv(groups)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-gray-600 border border-gray-200 hover:bg-gray-50">
                <FileDown className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => void closeAll()} disabled={closingAll || closingKey !== null} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-40">
                {closingAll ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                Close All
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex bg-white rounded-xl border border-gray-100 p-1 gap-1">
        <button onClick={() => setShowClosed(false)} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${!showClosed ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'}`}>
          Active
        </button>
        <button onClick={() => setShowClosed(true)} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${showClosed ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700'}`}>
          Closed
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center"><Loader className="w-5 h-5 animate-spin text-gray-300 mx-auto" /></div>
        ) : showClosed ? (
          closedBatches.length === 0 ? (
            <div className="p-12 text-center"><Package className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">No closed batches yet.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Batch</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Orders</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Products</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buyers</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Units</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {closedBatches.map(b => (
                    <tr key={b.batchKey} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="flex items-center gap-2 text-sm font-semibold text-gray-800"><CheckCircle2 className="w-4 h-4 text-emerald-500" />{formatDate(b.stagedAt)}</div></td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.orderCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.productCount}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.buyerCount}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-800">{b.totalUnits}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => setSelectedBatchKey(b.batchKey)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100"><Eye className="w-3.5 h-3.5" /> View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : groups.length === 0 ? (
          <div className="p-12 text-center"><Package className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">No paid active orders right now.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Variant</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Qty</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buyers</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Orders</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groups.map(g => (
                  <Fragment key={g.key}>
                    <tr key={g.key} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-[230px]">
                          {g.image_url ? <img src={g.image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-100" /> : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center"><Package className="w-4 h-4 text-gray-300" /></div>}
                          <div className="min-w-0"><p className="text-sm font-semibold text-gray-800 truncate max-w-[250px]">{g.name}</p><p className="text-[10px] text-gray-400">{g.buyers.length} buyer{g.buyers.length !== 1 ? 's' : ''}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[220px]">{g.variantLabel || '—'}</td>
                      <td className="px-4 py-3"><span className="text-lg font-black text-orange-500">{g.totalQty}</span><span className="text-[10px] text-gray-400 ml-1">units</span></td>
                      <td className="px-4 py-3"><button onClick={() => setExpandedKey(expandedKey === g.key ? null : g.key)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:underline"><Users className="w-3.5 h-3.5" /> {g.buyers.length} View</button></td>
                      <td className="px-4 py-3 text-xs text-gray-600">{new Set(g.orderIds).size}</td>
                      <td className="px-4 py-3 text-right"><button onClick={() => void closeGroup(g)} disabled={closingKey === g.key || closingAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold hover:bg-gray-700 disabled:opacity-40"><Archive className="w-3.5 h-3.5" /> {closingKey === g.key ? 'Closing…' : 'Close batch'}</button></td>
                    </tr>
                    {expandedKey === g.key && (
                      <tr key={g.key + ':buyers'} className="bg-gray-50">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Buyers</div>
                            <table className="w-full text-left">
                              <tbody className="divide-y divide-gray-100">
                                {g.buyers.map((b, i) => (
                                  <tr
                                    key={i}
                                    onClick={() => {
                                      const found = orders.find(o => o.code === b.orderCode);
                                      if (found) setSelectedOrderId(found.id);
                                    }}
                                    className="cursor-pointer hover:bg-gray-50"
                                  >
                                    <td className="px-3 py-2 text-xs"><span className="text-gray-600">{b.name}</span></td>
                                    <td className="px-3 py-2 text-[11px]"><span className="font-mono font-semibold text-orange-600 hover:underline">{b.orderCode}</span></td>
                                    <td className="px-3 py-2 text-xs text-gray-600">{b.whatsapp || '—'}</td>
                                    <td className="px-3 py-2 text-xs font-semibold text-right">×{b.qty}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {profileCustomerId && <CustomerDetail token={token} customerId={profileCustomerId} onClose={() => setProfileCustomerId(null)} onFavoriteToggled={() => {}} />}
      {selectedOrder && <OrderDetails token={token} order={selectedOrder} onClose={() => setSelectedOrderId(null)} onReload={load} onOpenClient={(id) => { setSelectedOrderId(null); setProfileCustomerId(id); }} />}
    </div>
  );
}

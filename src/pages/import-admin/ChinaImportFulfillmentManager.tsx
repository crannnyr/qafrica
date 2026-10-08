import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Download, Loader2, PackageCheck, Printer, RefreshCw, Search, Truck, X, Plus } from 'lucide-react';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';
import ShipmentReceiptSheet, { type ShipmentReceiptData } from './ShipmentReceiptSheet';
import { downloadShipmentReceipts, printShipmentReceipts } from './shipmentReceiptPdf';

type FulfillmentItem = {
  id: string;
  order_id: string;
  order_item_index: number;
  product_id: string | null;
  product_name: string;
  image_url: string | null;
  variant_options: Record<string, unknown> | null;
  ordered_quantity: number;
  received_quantity: number;
  stock_quantity: number;
  allocated_quantity: number;
  shipped_quantity: number;
  delivered_quantity: number;
  status: string;
  received_at: string | null;
  order_code: string;
  customer_name: string;
  customer_whatsapp: string | null;
  customer_email: string | null;
  batch_id: string | null;
  batch_opened_at: string | null;
  order_status: string;
  shipping_method: string | null;
  seller_order_id: string | null;
  seller_order_number: string | null;
  seller_store_id: string | null;
  seller_store_name: string | null;
  seller_store_slug: string | null;
  seller_owner_id: string | null;
  delivery_address: unknown;
};

type OrderGroup = {
  id: string;
  orderCode: string;
  customerName: string;
  customerWhatsapp: string | null;
  customerEmail: string | null;
  batchId: string | null;
  batchOpenedAt: string | null;
  items: FulfillmentItem[];
};

const EDGE_URL = `${CONFIG.SUPABASE_URL}/functions/v1/import-management`;

function variantLabel(options: Record<string, unknown> | null) {
  if (!options || typeof options !== 'object') return '';
  return Object.entries(options)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim())
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

function sellerLabel(item: FulfillmentItem) {
  if (!item.seller_store_name) return null;
  return item.seller_store_slug ? `${item.seller_store_name} (/${item.seller_store_slug})` : item.seller_store_name;
}

export default function ChinaImportFulfillmentManager({ token, canReceive }: { token: string; canReceive: boolean }) {
  const [items, setItems] = useState<FulfillmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'awaiting_arrival' | 'at_qafrica_hq'>('all');
  const [openOrders, setOpenOrders] = useState<Set<string>>(new Set());
  const [openBatches, setOpenBatches] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [shipmentOrderId, setShipmentOrderId] = useState<string | null>(null);
  const [shipmentQuantities, setShipmentQuantities] = useState<Record<string, number>>({});
  const [shipmentNotes, setShipmentNotes] = useState('');
  const [shipmentLoading, setShipmentLoading] = useState(false);
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [shipments, setShipments] = useState<any[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [trackingDraft, setTrackingDraft] = useState({ carrier_name: '', tracking_number: '', tracking_url: '', waybill_url: '', delivery_mode: '', note: '' });
  const [shipmentUpdating, setShipmentUpdating] = useState(false);
  const [receiptShipment, setReceiptShipment] = useState<ShipmentReceiptData | null>(null);
  const [fulfillmentTab, setFulfillmentTab] = useState<'receiving' | 'received' | 'shipments'>('receiving');
  const [allShipments, setAllShipments] = useState<any[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [shipmentQuery, setShipmentQuery] = useState('');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState('all');
  const [bulkReceiptAction, setBulkReceiptAction] = useState<'download' | 'print' | null>(null);

  const loadShipments = useCallback(async () => {
    setShipmentsLoading(true);
    try {
      const res = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/import-fulfillment-shipments?action=admin-fulfillment-shipments-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load shipments');
      setAllShipments(Array.isArray(data.shipments) ? data.shipments : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load shipments');
      setAllShipments([]);
    } finally {
      setShipmentsLoading(false);
    }
  }, [token]);

  const showShipmentReceipt = useCallback((shipment: any) => {
    const customer = items.find(item => item.order_id === shipment.order_id);
    setReceiptShipment({
      shipment_code: shipment.shipment_code,
      status: shipment.status,
      created_at: shipment.created_at,
      shipped_at: shipment.shipped_at,
      delivered_at: shipment.delivered_at,
      carrier_name: shipment.carrier_name,
      tracking_number: shipment.tracking_number,
      delivery_mode: shipment.delivery_mode,
      pickup_station_name: shipment.pickup_station_name ?? null,
      pickup_station_address: shipment.pickup_station_address ?? null,
      notes: shipment.notes,
      order_code: customer?.order_code ?? '—',
      customer_name: shipment.customer_name ?? customer?.customer_name ?? 'Customer',
      customer_whatsapp: shipment.customer_whatsapp ?? customer?.customer_whatsapp ?? null,
      customer_email: shipment.customer_email ?? customer?.customer_email ?? null,
      delivery_address: shipment.delivery_address ?? null,
      items: (shipment.items ?? []).map((row: any) => ({
        product_name: row.fulfillment_item?.product_name ?? 'Item',
        quantity: row.quantity,
        variant_options: row.fulfillment_item?.variant_options ?? null,
      })),
    });
  }, [items]);

  const shipmentItems = useMemo(() => {
    if (!shipmentOrderId) return [];
    return items.filter(item =>
      item.order_id === shipmentOrderId &&
      item.received_quantity > item.allocated_quantity
    );
  }, [items, shipmentOrderId]);

  const openShipment = useCallback(async (orderId: string) => {
    setShipmentOrderId(orderId);
    setShipmentNotes('');
    setShipmentQuantities({});
    setShipmentLoading(true);
    try {
      const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/import-fulfillment-shipments?action=admin-fulfillment-shipments-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, order_id: orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load shipments');
      setShipments(Array.isArray(data.shipments) ? data.shipments : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load shipments');
      setShipments([]);
    } finally {
      setShipmentLoading(false);
    }
  }, [token]);

  const updateShipment = async (status: string) => {
    if (!selectedShipment) return;
    setShipmentUpdating(true);
    try {
      const res = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/import-fulfillment-shipments?action=admin-fulfillment-shipment-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token, shipment_id: selectedShipment.id, status, ...trackingDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status !== 200 || !res.ok || data.success !== true) {
        throw new Error(data.error ?? 'Shipment status update was not confirmed');
      }
      toast.success(status === 'shipped' ? 'Shipment dispatched' : 'Shipment marked ' + status.replaceAll('_', ' '));
      setSelectedShipment(data.shipment ?? null);
      setSelectedShipment(null);
      await load(true);
      if (shipmentOrderId) await openShipment(shipmentOrderId);
      if (fulfillmentTab === 'shipments') await loadShipments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update shipment');
    } finally {
      setShipmentUpdating(false);
    }
  };

  const createShipment = async () => {
    if (!shipmentOrderId) return;
    const selected = shipmentItems
      .map(item => ({
        fulfillment_item_id: item.id,
        quantity: Number(shipmentQuantities[item.id] ?? 0),
      }))
      .filter(item => Number.isInteger(item.quantity) && item.quantity > 0);

    if (!selected.length) {
      toast.error('Select at least one received quantity to ship');
      return;
    }

    setShipmentSaving(true);
    try {
      const res = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/import-fulfillment-shipments?action=admin-fulfillment-shipment-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          order_id: shipmentOrderId,
          items: selected,
          notes: shipmentNotes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not create shipment');
      toast.success(`Shipment ${data.shipment?.shipment_code ?? ''} created`);
      setShipmentQuantities({});
      setShipmentNotes('');
      await load(true);
      await openShipment(shipmentOrderId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create shipment');
    } finally {
      setShipmentSaving(false);
    }
  };

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-fulfillment-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manager_token: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not load fulfillment items');
      const next = Array.isArray(data.items) ? data.items as FulfillmentItem[] : [];
      setItems(next);
      setOpenOrders(current => {
        if (current.size > 0) return current;
        return new Set(next.slice(0, 1).map(item => item.order_id));
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load fulfillment items');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (fulfillmentTab === 'shipments') void loadShipments();
  }, [fulfillmentTab, loadShipments]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => {
      if (!needle) return true;
      return [item.order_code, item.customer_name, item.product_name, variantLabel(item.variant_options)]
        .join(' ').toLowerCase().includes(needle);
    });
  }, [items, query, statusFilter]);

  const orders = useMemo<OrderGroup[]>(() => {
    const map = new Map<string, OrderGroup>();
    for (const item of filtered) {
      const existing = map.get(item.order_id);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(item.order_id, {
          id: item.order_id,
          orderCode: item.order_code,
          customerName: item.customer_name,
          customerWhatsapp: item.customer_whatsapp,
          customerEmail: item.customer_email,
          batchId: item.batch_id,
          batchOpenedAt: item.batch_opened_at,
          items: [item],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const ad = Math.max(...a.items.map(item => new Date(item.received_at ?? item.batch_opened_at ?? 0).getTime()));
      const bd = Math.max(...b.items.map(item => new Date(item.received_at ?? item.batch_opened_at ?? 0).getTime()));
      return bd - ad;
    });
  }, [filtered]);

  const receive = async (item: FulfillmentItem) => {
    if (!item.product_id) {
      toast.error('This item is not linked to a product in inventory');
      return;
    }
    if (item.stock_quantity <= 0) {
      toast.error('No inventory stock is registered for this product');
      return;
    }
    if (item.received_quantity >= item.ordered_quantity) {
      toast.success('This item has already been fully received');
      return;
    }

    setActing(item.id);
    try {
      const res = await fetch(`${EDGE_URL}?action=admin-fulfillment-receive-from-stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_token: token,
          fulfillment_item_id: item.id,
          note: notes[item.id]?.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not receive from inventory');
      const updated = data.fulfillment_item as FulfillmentItem;
      setItems(current => current.map(row => row.id === item.id
        ? { ...row, ...updated, stock_quantity: Number(data.stock_remaining ?? 0) }
        : row));
      toast.success(
        Number(data.received_now ?? 0) >= (item.ordered_quantity - item.received_quantity)
          ? 'Item fully received at QAfrica HQ'
          : 'Available stock received; item remains partially received'
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not receive from inventory');
    } finally {
      setActing(null);
    }
  };

  const filteredShipments = useMemo(() => {
    const needle = shipmentQuery.trim().toLowerCase();
    return allShipments.filter(shipment => {
      if (shipmentStatusFilter !== 'all' && shipment.status !== shipmentStatusFilter) return false;
      if (!needle) return true;
      const customer = items.find(item => item.order_id === shipment.order_id);
      return [
        shipment.shipment_code,
        customer?.order_code,
        customer?.customer_name,
        shipment.carrier_name,
        shipment.tracking_number,
      ].filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [allShipments, items, shipmentQuery, shipmentStatusFilter]);

  const customerByOrder = useMemo(() => {
    const map = new Map<string, { order_code: string; customer_name: string; customer_whatsapp: string | null; customer_email: string | null }>();
    for (const item of items) {
      if (!map.has(item.order_id)) {
        map.set(item.order_id, {
          order_code: item.order_code,
          customer_name: item.customer_name,
          customer_whatsapp: item.customer_whatsapp,
          customer_email: item.customer_email,
        });
      }
    }
    return map;
  }, [items]);

  const runBulkReceiptAction = async (action: 'download' | 'print') => {
    if (!filteredShipments.length) {
      toast.error('There are no matching shipments to include');
      return;
    }

    setBulkReceiptAction(action);
    try {
      const statusLabel = shipmentStatusFilter === 'all'
        ? 'all'
        : shipmentStatusFilter.replaceAll('_', '-');
      const filename = `qafrica-shipment-receipts-${statusLabel}-${new Date().toISOString().slice(0, 10)}.pdf`;

      // The shipment list already contains fulfillment_item data. For safety, rebuild
      // the receipt item list from that payload and fall back to the fulfillment list
      // if an older Edge Function response returns an empty items array.
      const receiptShipments = filteredShipments.map(shipment => {
        const apiItems = Array.isArray(shipment.items) ? shipment.items : [];
        const receiptItems = apiItems
          .map((row: any) => ({
            product_name: row.fulfillment_item?.product_name ?? row.product_name ?? 'Item',
            quantity: Number(row.quantity ?? 0),
            variant_options: row.fulfillment_item?.variant_options ?? row.variant_options ?? null,
          }))
          .filter((item: any) => item.product_name && item.quantity > 0);

        if (receiptItems.length > 0) {
          return { ...shipment, items: receiptItems };
        }

        const fallbackItems = items
          .filter(item => item.order_id === shipment.order_id)
          .map(item => ({
            product_name: item.product_name,
            quantity: Math.max(0, Number(item.shipped_quantity || item.allocated_quantity || item.ordered_quantity || 0)),
            variant_options: item.variant_options,
          }))
          .filter(item => item.quantity > 0);

        return { ...shipment, items: fallbackItems };
      });

      if (action === 'download') {
        await downloadShipmentReceipts(receiptShipments, customerByOrder, filename);
        toast.success(`${receiptShipments.length} receipt${receiptShipments.length === 1 ? '' : 's'} downloaded as one PDF`);
      } else {
        await printShipmentReceipts(receiptShipments, customerByOrder);
        toast.success(`Opened ${receiptShipments.length} receipt${receiptShipments.length === 1 ? '' : 's'} for printing`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create receipt PDF');
    } finally {
      setBulkReceiptAction(null);
    }
  };

  const orderSummaries = useMemo(() => {
    return orders.map(order => {
      const ordered = order.items.reduce((sum, item) => sum + item.ordered_quantity, 0);
      const received = order.items.reduce((sum, item) => sum + item.received_quantity, 0);
      return {
        ...order,
        ordered,
        received,
        remaining: Math.max(0, ordered - received),
        status: received >= ordered ? 'fully_received' : received > 0 ? 'partially_received' : 'awaiting_arrival',
      };
    });
  }, [orders]);

  const batchGroups = useMemo(() => {
    const map = new Map<string, { id: string; openedAt: string | null; orders: typeof orderSummaries }>();
    for (const order of orderSummaries) {
      const batchKey = order.batchId ?? 'unassigned';
      const existing = map.get(batchKey);
      if (existing) {
        existing.orders.push(order);
      } else {
        map.set(batchKey, {
          id: batchKey,
          openedAt: order.batchOpenedAt,
          orders: [order],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const ad = new Date(a.openedAt ?? 0).getTime();
      const bd = new Date(b.openedAt ?? 0).getTime();
      return bd - ad;
    });
  }, [orderSummaries]);

  const awaitingCount = items.filter(item => item.received_quantity <= 0).length;
  const hqCount = items.filter(item => item.received_quantity > 0).length;
  const orderedUnits = items.reduce((sum, item) => sum + item.ordered_quantity, 0);
  const receivedUnits = items.reduce((sum, item) => sum + item.received_quantity, 0);

  return (
    <>
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <PackageCheck className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-black text-gray-900">China Import Fulfillment</h2>
        </div>
        <p className="text-xs text-gray-500 mt-1">Receive paid shipping order items from registered HQ inventory. Seller-originated China dropship orders retain their seller store and order reference for operations.</p>
      </div>

      <div className="flex rounded-xl bg-gray-100 p-1 gap-1">
        <button
          type="button"
          onClick={() => setFulfillmentTab('receiving')}
          className={fulfillmentTab === 'receiving' ? 'flex-1 py-2.5 rounded-lg text-sm font-bold bg-white text-gray-900 shadow-sm' : 'flex-1 py-2.5 rounded-lg text-sm font-bold text-gray-500'}
        >
          Receiving
        </button>

        <button
          type="button"
          onClick={() => setFulfillmentTab('received')}
          className={fulfillmentTab === 'received' ? 'flex-1 py-2.5 rounded-lg text-sm font-bold bg-white text-gray-900 shadow-sm' : 'flex-1 py-2.5 rounded-lg text-sm font-bold text-gray-500'}
        >
          Received
        </button>

        <button
          type="button"
          onClick={() => setFulfillmentTab('shipments')}
          className={fulfillmentTab === 'shipments' ? 'flex-1 py-2.5 rounded-lg text-sm font-bold bg-white text-gray-900 shadow-sm' : 'flex-1 py-2.5 rounded-lg text-sm font-bold text-gray-500'}
        >
          <span className="inline-flex items-center justify-center gap-1.5"><Truck className="w-4 h-4" /> Shipments</span>
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-xs">{error}</div>}

      {fulfillmentTab === 'received' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Received orders</p>
              <p className="text-xl font-black text-gray-900">{orderSummaries.filter(order => order.received > 0).length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Fully received</p>
              <p className="text-xl font-black text-emerald-600">{orderSummaries.filter(order => order.status === 'fully_received').length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3">
              <p className="text-[10px] text-gray-400 uppercase font-bold">Available to ship</p>
              <p className="text-xl font-black text-orange-600">{orderSummaries.filter(order => order.items.some(item => item.received_quantity > item.allocated_quantity)).length}</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search received order, customer or item…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-orange-300 bg-white"
            />
          </div>

          {orderSummaries.filter(order => order.received > 0).length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <PackageCheck className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No received orders yet</p>
              <p className="text-xs text-gray-400 mt-1">Orders will appear here when inventory has been received for their fulfillment items.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orderSummaries.filter(order => order.received > 0).map(order => {
                const isOpen = openOrders.has(order.id);
                const available = order.items.reduce((sum, item) => sum + Math.max(0, item.received_quantity - item.allocated_quantity), 0);
                const fullyReceived = order.status === 'fully_received';

                return (
                  <div key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="w-full p-4 flex items-center justify-between gap-3 text-left">
                      <button
                        type="button"
                        onClick={() => setOpenOrders(current => {
                          const next = new Set(current);
                          if (next.has(order.id)) next.delete(order.id); else next.add(order.id);
                          return next;
                        })}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs font-black text-gray-900">{order.orderCode}</p>
                          <span className={"text-[9px] font-bold px-1.5 py-0.5 rounded-full " + (fullyReceived ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                            {fullyReceived ? 'Fully received' : 'Partially received'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5 truncate">{order.customerName}{order.customerWhatsapp ? ' · ' + order.customerWhatsapp : ''}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{order.received}/{order.ordered} units received · {available} available to ship</p>
                      </button>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {available > 0 && (
                          <button
                            type="button"
                            onClick={() => void openShipment(order.id)}
                            className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold flex items-center gap-1.5"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            Create shipment
                          </button>
                        )}
                        {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">
                        {order.items.map(item => {
                          const availableItem = Math.max(0, item.received_quantity - item.allocated_quantity);
                          return (
                            <div key={item.id} className="p-4">
                              <div className="flex gap-3">
                                {item.image_url ? <img src={item.image_url} alt="" className="w-12 h-12 rounded-xl object-cover bg-gray-50 flex-shrink-0" /> : <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0" />}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-gray-900">{item.product_name}</p>
                                  {variantLabel(item.variant_options) && <p className="text-[10px] text-gray-500 mt-0.5">{variantLabel(item.variant_options)}</p>}
                                  <p className="text-[10px] text-gray-400 mt-1">Ordered {item.ordered_quantity} · Received {item.received_quantity} · Allocated {item.allocated_quantity} · Available {availableItem}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-black text-gray-900">Shipments</p>
                <p className="text-xs text-gray-400 mt-0.5">Dispatch and track shipments created from received orders.</p>
              </div>
              <button type="button" onClick={() => void loadShipments()} disabled={shipmentsLoading} className="px-3.5 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                <RefreshCw className={shipmentsLoading ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} /> Refresh
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {[
                { label: 'Total', value: allShipments.length, className: 'text-gray-900' },
                { label: 'Draft', value: allShipments.filter(s => s.status === 'draft').length, className: 'text-gray-600' },
                { label: 'In transit', value: allShipments.filter(s => s.status === 'in_transit' || s.status === 'out_for_delivery').length, className: 'text-orange-600' },
                { label: 'Delivered', value: allShipments.filter(s => s.status === 'delivered').length, className: 'text-emerald-600' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">{stat.label}</p>
                  <p className={"text-xl font-black mt-0.5 " + stat.className}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input
                value={shipmentQuery}
                onChange={e => setShipmentQuery(e.target.value)}
                placeholder="Search shipment, order, customer or tracking…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-orange-300 bg-white"
              />
            </div>
            <select value={shipmentStatusFilter} onChange={e => setShipmentStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs bg-white">
              <option value="all">All shipment statuses</option>
              <option value="draft">Draft</option>
              <option value="ready_to_ship">Ready to ship</option>
              <option value="shipped">Shipped</option>
              <option value="in_transit">In transit</option>
              <option value="out_for_delivery">Out for delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <div className="flex gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={() => void runBulkReceiptAction('download')}
                disabled={!filteredShipments.length || bulkReceiptAction !== null}
                className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                {bulkReceiptAction === 'download' ? 'Building PDF…' : 'Download all'}
              </button>
              <button
                type="button"
                onClick={() => void runBulkReceiptAction('print')}
                disabled={!filteredShipments.length || bulkReceiptAction !== null}
                className="px-3 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
              >
                <Printer className="w-3.5 h-3.5" />
                {bulkReceiptAction === 'print' ? 'Preparing…' : `Print all (${filteredShipments.length})`}
              </button>
            </div>
          </div>

          {shipmentsLoading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            </div>
          ) : filteredShipments.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <Truck className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">{allShipments.length === 0 ? 'No shipments yet' : 'No matching shipments'}</p>
              <p className="text-xs text-gray-400 mt-1">{allShipments.length === 0 ? 'Create a shipment from Receiving after items arrive at QAfrica HQ.' : 'Try a different search or status filter.'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wide font-black text-gray-400">Shipment</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wide font-black text-gray-400">Order / customer</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wide font-black text-gray-400">Items</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wide font-black text-gray-400">Status</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wide font-black text-gray-400">Created</th>
                      <th className="px-4 py-3 text-[10px] uppercase tracking-wide font-black text-gray-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredShipments.map(shipment => {
                      const customer = items.find(item => item.order_id === shipment.order_id);
                      const status = String(shipment.status).replaceAll('_', ' ');
                      const statusClass =
                        shipment.status === 'delivered' ? 'bg-emerald-50 text-emerald-700' :
                        shipment.status === 'cancelled' ? 'bg-red-50 text-red-600' :
                        shipment.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                        'bg-orange-50 text-orange-700';
                      const unitCount = (shipment.items ?? []).reduce((sum: number, row: any) => sum + Number(row.quantity ?? 0), 0);
                      return (
                        <tr key={shipment.id} className="hover:bg-gray-50/70">
                          <td className="px-4 py-3.5 align-top">
                            <p className="text-xs font-black text-gray-900 whitespace-nowrap">{shipment.shipment_code}</p>
                            {shipment.tracking_number && <p className="text-[10px] text-gray-400 mt-1 whitespace-nowrap">Tracking: {shipment.tracking_number}</p>}
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <p className="text-xs font-bold text-gray-800 whitespace-nowrap">{customer?.order_code ?? '—'}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5 max-w-[180px] truncate">{customer?.customer_name ?? 'Customer'}</p>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <p className="text-xs font-bold text-gray-800">{shipment.items?.length ?? 0} line{(shipment.items?.length ?? 0) === 1 ? '' : 's'}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{unitCount} unit{unitCount === 1 ? '' : 's'}</p>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <span className={"inline-flex px-2 py-1 rounded-full text-[9px] font-bold capitalize " + statusClass}>{status}</span>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <p className="text-[10px] text-gray-500 whitespace-nowrap">{new Date(shipment.created_at).toLocaleDateString()}</p>
                            <p className="text-[10px] text-gray-400 whitespace-nowrap">{new Date(shipment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => showShipmentReceipt(shipment)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 text-[10px] font-bold whitespace-nowrap">Receipt</button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedShipment(shipment);
                                  setTrackingDraft({
                                    carrier_name: shipment.carrier_name ?? '',
                                    tracking_number: shipment.tracking_number ?? '',
                                    tracking_url: shipment.tracking_url ?? '',
                                    waybill_url: shipment.waybill_url ?? '',
                                    delivery_mode: shipment.delivery_mode ?? '',
                                    note: '',
                                  });
                                }}
                                className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[10px] font-bold whitespace-nowrap"
                              >Manage</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl border border-gray-100 p-3"><p className="text-[10px] text-gray-400 uppercase font-bold">Awaiting</p><p className="text-xl font-black text-gray-900">{awaitingCount}</p></div>
            <div className="bg-white rounded-xl border border-gray-100 p-3"><p className="text-[10px] text-gray-400 uppercase font-bold">At HQ</p><p className="text-xl font-black text-emerald-600">{hqCount}</p></div>
            <div className="bg-white rounded-xl border border-gray-100 p-3"><p className="text-[10px] text-gray-400 uppercase font-bold">Units received</p><p className="text-xl font-black text-gray-900">{receivedUnits.toLocaleString()}<span className="text-xs text-gray-400">/{orderedUnits.toLocaleString()}</span></p></div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search order, customer or item…" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-orange-300 bg-white" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs bg-white">
              <option value="all">All fulfillment</option><option value="awaiting_arrival">Awaiting arrival</option><option value="at_qafrica_hq">At QAfrica HQ</option>
            </select>
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="px-3 py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"><RefreshCw className={refreshing ? 'w-3.5 h-3.5 animate-spin' : 'w-3.5 h-3.5'} /> Refresh</button>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>
          ) : batchGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center"><PackageCheck className="w-8 h-8 text-gray-200 mx-auto mb-2" /><p className="text-sm font-bold text-gray-700">No fulfillment items found</p><p className="text-xs text-gray-400 mt-1">Only paid consolidation-shipping orders are included.</p></div>
          ) : (
            <div className="space-y-3">
              {batchGroups.map(batch => {
                const visibleOrders = batch.orders.filter(order =>
                  statusFilter === 'all' || order.items.some(item => statusFilter === 'awaiting_arrival' ? item.received_quantity <= 0 : item.received_quantity > 0)
                );
                if (!visibleOrders.length) return null;
                const batchItems = visibleOrders.flatMap(order => order.items);
                const isOpen = openBatches.has(batch.id);
                const batchOrdered = batchItems.reduce((sum, item) => sum + item.ordered_quantity, 0);
                const batchReceived = batchItems.reduce((sum, item) => sum + item.received_quantity, 0);

                return (
                  <div key={batch.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <button type="button" onClick={() => setOpenBatches(current => { const next = new Set(current); if (next.has(batch.id)) next.delete(batch.id); else next.add(batch.id); return next; })} className="w-full p-4 flex items-center justify-between gap-3 text-left">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-gray-900">{batch.openedAt ? `Batch opened ${new Date(batch.openedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} · ${new Date(batch.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Unassigned batch'}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{batchItems.length} item line{batchItems.length === 1 ? '' : 's'} · {batchReceived}/{batchOrdered} units received</p>
                      </div>
                      {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-50 p-3 space-y-3">
                        {visibleOrders.map(order => {
                          const isOrderOpen = openOrders.has(order.id);
                          const orderReceived = order.items.reduce((sum, item) => sum + item.received_quantity, 0);
                          const orderOrdered = order.items.reduce((sum, item) => sum + item.ordered_quantity, 0);
                          const available = order.items.reduce((sum, item) => sum + Math.max(0, item.received_quantity - item.allocated_quantity), 0);
                          return (
                            <div key={order.id} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                              <button type="button" onClick={() => setOpenOrders(current => { const next = new Set(current); if (next.has(order.id)) next.delete(order.id); else next.add(order.id); return next; })} className="w-full p-3 flex items-center justify-between gap-3 text-left">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5"><p className="text-xs font-black text-gray-900">{order.orderCode}</p><span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white text-gray-500">{order.items.length} line{order.items.length === 1 ? '' : 's'}</span></div>
                                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">{order.customerName}{order.customerWhatsapp ? ' · ' + order.customerWhatsapp : ''}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">{orderReceived}/{orderOrdered} units received</p>
                                </div>
                                {isOrderOpen ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                              </button>

                              {isOrderOpen && (
                                <>
                                  <div className="border-t border-gray-100 divide-y divide-gray-100 bg-white">
                                    {order.items.map(item => {
                                      const complete = item.received_quantity >= item.ordered_quantity;
                                      return (
                                        <div key={item.id} className="p-4">
                                          <div className="flex gap-3">
                                            {item.image_url ? <img src={item.image_url} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-50 flex-shrink-0" /> : <div className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0" />}
                                            <div className="min-w-0 flex-1">
                                              <div className="flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-mono font-bold text-orange-600">{item.order_code}</span><span className={"text-[9px] font-bold px-1.5 py-0.5 rounded-full " + (complete ? 'bg-emerald-50 text-emerald-600' : item.received_quantity > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500')}>{complete ? 'At HQ' : item.received_quantity > 0 ? 'Partially received' : 'Awaiting arrival'}</span></div>
                                              <p className="text-xs font-bold text-gray-900 mt-1 leading-snug">{item.product_name}</p>
                                              {variantLabel(item.variant_options) && <p className="text-[10px] text-gray-500 mt-0.5">{variantLabel(item.variant_options)}</p>}
                                              <p className="text-[10px] text-gray-400 mt-1">Ordered {item.ordered_quantity} · Received {item.received_quantity} · Remaining {Math.max(0, item.ordered_quantity - item.received_quantity)}</p>
                                              {(sellerLabel(item) || item.seller_order_number) && <p className="text-[10px] text-gray-500 mt-1">{sellerLabel(item) ? `Seller store: ${sellerLabel(item)}` : ''}{item.seller_order_number ? `${sellerLabel(item) ? ' · ' : ''}Seller order: ${item.seller_order_number}` : ''}</p>}
                                            </div>
                                          </div>
                                          {canReceive && !complete && (
                                            <div className="mt-3 bg-gray-50 rounded-xl p-3">
                                              <div className="flex items-center justify-between gap-3">
                                                <div><p className="text-[10px] font-bold text-gray-500 uppercase">Available inventory</p><p className={"text-xs mt-0.5 font-bold " + (item.stock_quantity > 0 ? 'text-emerald-700' : 'text-red-500')}>{item.stock_quantity} unit{item.stock_quantity === 1 ? '' : 's'}</p></div>
                                                <button onClick={() => void receive(item)} disabled={acting === item.id || item.stock_quantity <= 0} className="flex-1 max-w-[240px] py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">{acting === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}{item.stock_quantity > 0 ? 'Receive from inventory' : 'No stock available'}</button>
                                              </div>
                                              <textarea value={notes[item.id] ?? ''} onChange={e => setNotes(current => ({ ...current, [item.id]: e.target.value }))} rows={2} placeholder="Optional internal note…" className="w-full mt-2 px-2.5 py-2 rounded-lg border border-gray-200 text-xs resize-none" />
                                            </div>
                                          )}
                                          {!canReceive && !complete && <p className="text-[10px] text-gray-400 mt-3">You can view fulfillment, but your account cannot record receiving.</p>}
                                          {item.received_at && <p className="text-[10px] text-gray-400 mt-2">Last received: {new Date(item.received_at).toLocaleString()}</p>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="border-t border-gray-100 p-3 flex items-center justify-between gap-3 bg-white">
                                    <p className="text-[10px] text-gray-400">{available} unit{available === 1 ? '' : 's'} available to allocate</p>
                                    {available > 0 && <button type="button" onClick={() => void openShipment(order.id)} className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Create shipment</button>}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>

      {shipmentOrderId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-gray-900">Create shipment</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Select received quantities. The same item can be split across multiple shipments.</p>
              </div>
              <button onClick={() => setShipmentOrderId(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-4 space-y-3">
              {shipmentLoading ? (
                <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Available received items</p>
                      {shipmentItems.length > 0 && (
                        <button
                          onClick={() => setShipmentQuantities(Object.fromEntries(shipmentItems.map(item => [item.id, Math.max(0, item.received_quantity - item.allocated_quantity)])))}
                          className="text-[10px] font-bold text-orange-600"
                        >Use all available</button>
                      )}
                    </div>
                    <div className="mt-2 space-y-2">
                      {shipmentItems.length === 0 ? (
                        <p className="text-xs text-gray-500">Nothing remains available for a new shipment.</p>
                      ) : shipmentItems.map(item => {
                        const available = Math.max(0, item.received_quantity - item.allocated_quantity);
                        return (
                          <div key={item.id} className="flex items-center gap-2.5 bg-white rounded-lg p-2.5 border border-gray-100">
                            {item.image_url ? <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <div className="w-10 h-10 rounded-lg bg-gray-100" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-bold text-gray-800 truncate">{item.product_name}</p>
                              <p className="text-[10px] text-gray-400">{variantLabel(item.variant_options)} · {available} available</p>
                            </div>
                            <input
                              type="number"
                              min={0}
                              max={available}
                              step={1}
                              value={shipmentQuantities[item.id] ?? 0}
                              onChange={e => setShipmentQuantities(current => ({ ...current, [item.id]: Number(e.target.value) }))}
                              className="w-20 px-2 py-2 rounded-lg border border-gray-200 text-xs text-center"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <textarea
                    value={shipmentNotes}
                    onChange={e => setShipmentNotes(e.target.value)}
                    rows={3}
                    placeholder="Optional shipment note…"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs resize-none"
                  />

                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Existing shipments</p>
                    {shipments.length === 0 ? (
                      <p className="text-xs text-gray-400">No shipment has been created for this order.</p>
                    ) : (
                      <div className="space-y-2">
                        {shipments.map(shipment => (
                          <div key={shipment.id} className="border border-gray-100 rounded-xl p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-black text-gray-800">{shipment.shipment_code}</p>
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{String(shipment.status).replaceAll('_', ' ')}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">{shipment.items?.length ?? 0} item line{(shipment.items?.length ?? 0) === 1 ? '' : 's'} · {new Date(shipment.created_at).toLocaleString()}</p>
                            <button
                              onClick={() => {
                                setSelectedShipment(shipment);
                                setTrackingDraft({
                                  carrier_name: shipment.carrier_name ?? '',
                                  tracking_number: shipment.tracking_number ?? '',
                                  tracking_url: shipment.tracking_url ?? '',
                                  waybill_url: shipment.waybill_url ?? '',
                                  delivery_mode: shipment.delivery_mode ?? '',
                                  note: '',
                                });
                              }}
                              className="mt-2 px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[10px] font-bold"
                            >Manage shipment</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => void createShipment()}
                    disabled={shipmentSaving || shipmentItems.length === 0}
                    className="w-full py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
                  >
                    {shipmentSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {shipmentSaving ? 'Creating shipment…' : 'Create draft shipment'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {selectedShipment && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-gray-900">{selectedShipment.shipment_code}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Shipment status: {String(selectedShipment.status).replaceAll('_', ' ')}</p>
              </div>
              <button onClick={() => setSelectedShipment(null)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input value={trackingDraft.carrier_name} onChange={e => setTrackingDraft(v => ({...v, carrier_name:e.target.value}))} placeholder="Carrier name" className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs" />
                <input value={trackingDraft.tracking_number} onChange={e => setTrackingDraft(v => ({...v, tracking_number:e.target.value}))} placeholder="Tracking number" className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs" />
                <input value={trackingDraft.tracking_url} onChange={e => setTrackingDraft(v => ({...v, tracking_url:e.target.value}))} placeholder="Tracking URL" className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs" />
                <input value={trackingDraft.waybill_url} onChange={e => setTrackingDraft(v => ({...v, waybill_url:e.target.value}))} placeholder="Waybill URL" className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs" />
                <select value={trackingDraft.delivery_mode} onChange={e => setTrackingDraft(v => ({...v, delivery_mode:e.target.value}))} className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs bg-white">
                  <option value="">Delivery mode</option>
                  <option value="door_delivery">Door delivery</option>
                  <option value="pickup">Pickup</option>
                </select>
              </div>
              <textarea value={trackingDraft.note} onChange={e => setTrackingDraft(v => ({...v, note:e.target.value}))} rows={3} placeholder="Internal tracking note…" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-xs resize-none" />
              <button
                type="button"
                onClick={() => showShipmentReceipt(selectedShipment)}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-bold"
              >
                Print shipment receipt
              </button>
              <div className="grid grid-cols-2 gap-2">
                {selectedShipment.status === 'draft' && <button onClick={() => void updateShipment('ready_to_ship')} disabled={shipmentUpdating} className="py-2.5 rounded-xl border border-orange-200 text-orange-600 text-xs font-bold disabled:opacity-40">Mark ready to ship</button>}
                {['draft','ready_to_ship'].includes(selectedShipment.status) && <button onClick={() => void updateShipment('shipped')} disabled={shipmentUpdating} className="py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold disabled:opacity-40">Dispatch shipment</button>}
                {selectedShipment.status === 'shipped' && <button onClick={() => void updateShipment('in_transit')} disabled={shipmentUpdating} className="py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold disabled:opacity-40">Mark in transit</button>}
                {selectedShipment.status === 'in_transit' && <button onClick={() => void updateShipment('out_for_delivery')} disabled={shipmentUpdating} className="py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold disabled:opacity-40">Out for delivery</button>}
                {selectedShipment.status === 'out_for_delivery' && <button onClick={() => void updateShipment('delivered')} disabled={shipmentUpdating} className="py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-bold disabled:opacity-40">Mark delivered</button>}
                {!['delivered','cancelled'].includes(selectedShipment.status) && <button onClick={() => void updateShipment('cancelled')} disabled={shipmentUpdating} className="py-2.5 rounded-xl border border-red-200 text-red-600 text-xs font-bold disabled:opacity-40">Cancel shipment</button>}
              </div>
              {shipmentUpdating && <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-orange-500" /></div>}
            </div>
          </div>
        </div>
      )}
      {receiptShipment && <ShipmentReceiptSheet data={receiptShipment} onClose={() => setReceiptShipment(null)} />}
    </>
  );
}

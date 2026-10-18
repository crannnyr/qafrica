import { useEffect, useState } from 'react';
import { Eye, Search, ShoppingCart, X, Package, MapPin, UserRound, CreditCard, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { orderService, supabase } from '@/services';

type OrderDetail = Record<string, any> & {
  id: string;
  order_number?: string;
  order_items?: Array<Record<string, any>>;
};

const money = (value: unknown) => `₦${Number(value ?? 0).toLocaleString('en-NG')}`;
const dateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => { void loadOrders(); }, []);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await orderService.getAllOrders();
      if (error) console.error('Failed to load orders:', error);
      else setOrders(data || []);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const viewOrder = async (order: OrderDetail) => {
    setSelectedOrder(order);
    setIsLoadingDetail(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          store:stores!orders_store_id_fkey(id,name,slug),
          order_items(
            *,
            product:products!order_items_product_id_fkey(id,name,images)
          )
        `)
        .eq('id', order.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Order details could not be found.');

      // China Import dropship items intentionally have no products-table relation.
      // Resolve their catalog image by source_id first, then legacy product IDs.
      const importedItems = (data.order_items ?? []).filter((item: any) =>
        item?.source_type === 'china_import' || item?.is_imported === true
      );
      const chinaIds = [...new Set(importedItems.flatMap((item: any) =>
        [item.source_id, item.original_product_id, item.product_id]
          .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      ))];

      let enrichedOrder: any = data;
      if (chinaIds.length) {
        const { data: catalogProducts, error: catalogError } = await supabase
          .from('china_import_products')
          .select('id,name,image_url,image_urls,variants')
          .in('id', chinaIds);

        if (catalogError) {
          console.warn('Could not resolve China Import order images:', catalogError.message);
        } else {
          const catalogById = new Map((catalogProducts ?? []).map((product: any) => [
            product.id,
            {
              name: product.name,
              images: Array.isArray(product.image_urls) && product.image_urls.length
                ? product.image_urls
                : product.image_url ? [product.image_url] : [],
              variants: product.variants ?? [],
            },
          ]));

          enrichedOrder = {
            ...data,
            order_items: (data.order_items ?? []).map((item: any) => {
              if (item?.source_type !== 'china_import' && item?.is_imported !== true) return item;
              const catalog = catalogById.get(item.source_id || item.original_product_id || item.product_id);
              if (!catalog) return item;
              const images = item.product?.images?.length
                ? item.product.images
                : (item.image_url || item.image || item.product_image_url)
                  ? [item.image_url || item.image || item.product_image_url]
                  : catalog.images;
              return {
                ...item,
                product_name: item.product_name || catalog.name,
                image_url: item.image_url || item.image || item.product_image_url || catalog.images[0] || null,
                product: {
                  ...(item.product ?? {}),
                  name: item.product?.name || catalog.name,
                  images,
                },
                imported_variants: catalog.variants,
              };
            }),
          };
        }
      }
      setSelectedOrder(enrichedOrder as OrderDetail);
    } catch (err) {
      console.error('Failed to load order details:', err);
      toast.error(err instanceof Error ? err.message : 'Could not load order details');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!selectedOrder) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedOrder(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [!!selectedOrder]);

  const filteredOrders = orders.filter((o) =>
    o.order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.customer_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-sky-100 text-sky-800',
    processing: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 mt-1">Manage all platform orders</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by order number, customer name or email..."
          className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-200 focus:border-orange-500 outline-none"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{order.order_number}</p>
                          <p className="text-xs text-gray-400">{order.order_items?.length || 0} items</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{order.customer_name}</p>
                      <p className="text-sm text-gray-500">{order.customer_email}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.store?.name || order.store_id?.slice(0, 8) + '...'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                        {order.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {money(order.total)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void viewOrder(order)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                        aria-label={`View order ${order.order_number || ''}`}
                      >
                        <Eye className="w-4 h-4" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex justify-end"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedOrder(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-order-details-title"
            className="h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col"
          >
            <header className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Order Details</p>
                <h2 id="admin-order-details-title" className="text-lg font-bold text-gray-900 truncate">
                  {selectedOrder.order_number || 'Order'}
                </h2>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} aria-label="Close order details" className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {isLoadingDetail ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-500 gap-2">
                  <LoaderCircle className="w-5 h-5 animate-spin" /> Loading full order details…
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 border border-gray-100 p-4">
                    <div>
                      <p className="text-xs text-gray-500">Order total</p>
                      <p className="text-2xl font-bold text-gray-900">{money(selectedOrder.total)}</p>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusColors[selectedOrder.status] || 'bg-gray-200 text-gray-700'}`}>
                      {selectedOrder.status || 'unknown'}
                    </span>
                  </div>

                  <section className="rounded-xl border border-gray-100 p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-3"><UserRound className="w-4 h-4" /> Customer</h3>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-gray-900">{selectedOrder.customer_name || '—'}</p>
                      <p className="text-gray-600 break-all">{selectedOrder.customer_email || '—'}</p>
                      <p className="text-gray-600">{selectedOrder.customer_phone || 'No phone provided'}</p>
                    </div>
                  </section>

                  <section className="rounded-xl border border-gray-100 p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-3"><Package className="w-4 h-4" /> Items ({selectedOrder.order_items?.length || 0})</h3>
                    {!selectedOrder.order_items?.length ? (
                      <p className="text-sm text-gray-500">No order items were returned for this order.</p>
                    ) : (
                      <div className="space-y-4">
                        {selectedOrder.order_items.map((item: any) => {
                          const image = item.product?.images?.[0] || item.image_url || item.product_image || '';
                          const name = item.product_name || item.product?.name || 'Product';
                          const qty = Number(item.quantity || 0);
                          const unit = Number(item.unit_price ?? item.price ?? 0);
                          const total = Number(item.total_price ?? unit * qty);
                          const variants = item.variant_options && typeof item.variant_options === 'object'
                            ? Object.entries(item.variant_options).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')
                            : '';
                          return (
                            <div key={item.id} className="flex gap-3">
                              <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                                {image ? <img src={image} alt={name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No image</div>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900">{name}</p>
                                <p className="text-xs text-gray-500 mt-1">Qty: {qty} × {money(unit)}</p>
                                {variants && <p className="text-xs text-gray-500 mt-1">{variants}</p>}
                              </div>
                              <p className="text-sm font-semibold text-gray-900 shrink-0">{money(total)}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="rounded-xl border border-gray-100 p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-3"><MapPin className="w-4 h-4" /> Delivery</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      {typeof selectedOrder.delivery_address === 'object' && selectedOrder.delivery_address ? (
                        <>
                          <p>{selectedOrder.delivery_address.address || 'Address not provided'}</p>
                          <p>{[selectedOrder.delivery_address.city, selectedOrder.delivery_address.state || selectedOrder.delivery_state].filter(Boolean).join(', ')}</p>
                          {selectedOrder.delivery_address.instructions && <p className="text-gray-500">Instructions: {selectedOrder.delivery_address.instructions}</p>}
                        </>
                      ) : (
                        <p>{selectedOrder.delivery_address || selectedOrder.shipping_address || 'Address not provided'}</p>
                      )}
                      <p className="pt-1">Delivery fee: {money(selectedOrder.delivery_fee)}</p>
                    </div>
                  </section>

                  <section className="rounded-xl border border-gray-100 p-4">
                    <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-3"><CreditCard className="w-4 h-4" /> Payment</h3>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Subtotal</dt><dd className="font-medium text-gray-900">{money(selectedOrder.subtotal)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Delivery</dt><dd className="font-medium text-gray-900">{money(selectedOrder.delivery_fee)}</dd></div>
                      <div className="flex justify-between gap-4 border-t border-gray-100 pt-2"><dt className="font-semibold text-gray-900">Total</dt><dd className="font-bold text-gray-900">{money(selectedOrder.total)}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Payment method</dt><dd className="text-gray-700 capitalize">{selectedOrder.payment_method || '—'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Payment status</dt><dd className="text-gray-700 capitalize">{selectedOrder.payment_status || '—'}</dd></div>
                      <div className="flex justify-between gap-4"><dt className="text-gray-500">Reference</dt><dd className="text-gray-700 break-all text-right">{selectedOrder.payment_reference || '—'}</dd></div>
                    </dl>
                  </section>

                  <section className="rounded-xl border border-gray-100 p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Order information</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-gray-500">Store</dt><dd className="text-gray-800 mt-1">{selectedOrder.store?.name || selectedOrder.store_id || '—'}</dd></div>
                      <div><dt className="text-gray-500">Created</dt><dd className="text-gray-800 mt-1">{dateTime(selectedOrder.created_at)}</dd></div>
                      <div><dt className="text-gray-500">Tracking number</dt><dd className="text-gray-800 mt-1 break-all">{selectedOrder.tracking_number || '—'}</dd></div>
                      <div><dt className="text-gray-500">Shipment status</dt><dd className="text-gray-800 mt-1 capitalize">{selectedOrder.shipbubble_status || '—'}</dd></div>
                    </dl>
                  </section>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

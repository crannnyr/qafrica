import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingCart, Package, ArrowUpRight,
  DollarSign, Eye, Plus, Store, TrendingUp,
  ExternalLink, Copy, Link2, Globe, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAuthStore, useStoreStore, useOrderStore, useWalletStore } from '@/stores';

const STORE_PROMO_IMAGES = [
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.19689509870634492.webp',
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.47853263406407076.webp',
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.8566548358244728.webp',
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.42678237174556055.webp',
  'https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.09752996319874485.webp',
];

export default function DashboardHome() {
  const [isStoreLinkOpen, setIsStoreLinkOpen] = useState(false);
  const [storePromoImage, setStorePromoImage] = useState(STORE_PROMO_IMAGES[0]);
  const [isCopyingStoreLink, setIsCopyingStoreLink] = useState(false);
  const { user }                                       = useAuthStore();
  const { currentStore, products, fetchUserStore }     = useStoreStore();
  const { orders, fetchStoreOrders }                   = useOrderStore();
  const { wallet, fetchWallet }                        = useWalletStore();

  useEffect(() => {
    if (user?.id && !currentStore) fetchUserStore(user.id);
  }, [user?.id, currentStore, fetchUserStore]);

  useEffect(() => {
    if (currentStore?.id) fetchStoreOrders(currentStore.id);
  }, [currentStore?.id, fetchStoreOrders]);

  useEffect(() => {
    if (user?.id) fetchWallet(user.id);
  }, [user?.id, fetchWallet]);

  // ── REAL earnings: only money that has been released from escrow ──────────
  // wallet.total_earned is incremented inside release_escrow_funds RPC only.
  const totalRevenue = Number(wallet?.total_earned ?? 0);

  // ── Order counts ──────────────────────────────────────────────────────────
  const totalOrders   = orders?.length ?? 0;
  const totalProducts = products?.length ?? 0;
  const totalViews    = products?.reduce((sum, p) => sum + (p.views || 0), 0) ?? 0;

  // ── Month-over-month for orders ───────────────────────────────────────────
  const { thisMonthOrders, lastMonthOrders } = useMemo(() => {
    const now      = new Date();
    const thisStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisM = (orders ?? []).filter(o =>
      new Date(o.created_at) >= thisStart
    ).length;
    const lastM = (orders ?? []).filter(o =>
      new Date(o.created_at) >= lastStart &&
      new Date(o.created_at) <= lastEnd
    ).length;
    return { thisMonthOrders: thisM, lastMonthOrders: lastM };
  }, [orders]);

  const orderTrend = lastMonthOrders === 0
    ? (thisMonthOrders > 0 ? '+100%' : '0%')
    : `${thisMonthOrders >= lastMonthOrders ? '+' : ''}${Math.round(((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100)}%`;

  // ── Recent orders ─────────────────────────────────────────────────────────
  const recentOrders = [...(orders ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // ── Top products by sales_count ───────────────────────────────────────────
  const topProducts = [...(products ?? [])]
    .sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0))
    .slice(0, 4);

  // ── Escrow balance (money earned but not yet released) ────────────────────
  const escrowBalance = Number((wallet as any)?.escrow_balance ?? 0);

  return (
    <div className="space-y-8">
      {/* ── Welcome header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.full_name?.split(' ')[0]}!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Here's what's happening with your store today.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button
            type="button"
            onClick={() => {
              setStorePromoImage(STORE_PROMO_IMAGES[Math.floor(Math.random() * STORE_PROMO_IMAGES.length)]);
              setIsStoreLinkOpen(true);
            }}
            className="bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200"
          >
            <Link2 className="w-4 h-4 mr-2" />
            Copy Store Link
          </Button>

          <Link to="/dashboard/products/add">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Revenue card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden"
        >
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-gray-400 font-medium mb-1 flex items-center gap-2 text-sm">
                Total Earned (Released)
                <TrendingUp className="w-4 h-4 text-green-400" />
              </p>
              <p className="text-4xl font-bold tracking-tight">
                ₦{totalRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Only counts payments released from escrow
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
          </div>

          {escrowBalance > 0 && (
            <div className="relative z-10 mt-4 bg-white/10 rounded-xl p-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs text-gray-400">In Escrow (Pending Release)</p>
                  <p className="text-lg font-bold text-yellow-300">
                    ₦{escrowBalance.toLocaleString()}
                  </p>
                </div>
                <Link
                  to="/dashboard/wallet"
                  className="text-xs text-orange-300 hover:text-orange-200 underline"
                >
                  View Wallet
                </Link>
              </div>
            </div>
          )}

          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
            <TrendingUp className="w-48 h-48 -mr-8 -mb-8" />
          </div>
        </motion.div>

        {/* Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalOrders}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <span className="text-xs font-bold text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">
            {orderTrend} vs last month
          </span>
        </motion.div>

        {/* Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Active Products</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalProducts}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-orange-500" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">{totalViews.toLocaleString()} total views</span>
          </div>
        </motion.div>
      </div>

      {/* ── Quick actions ── */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Add Product',     icon: Plus,         path: '/dashboard/products/add', color: 'bg-orange-500' },
            { label: 'View Orders',     icon: ShoppingCart, path: '/dashboard/orders',        color: 'bg-blue-500'   },
            { label: 'Import Catalog',  icon: Package,      path: '/dashboard/import-catalog',color: 'bg-green-500'  },
            { label: 'Settings',        icon: Store,        path: '/dashboard/settings',      color: 'bg-purple-500' },
          ].map((action, i) => (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={action.path}
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-500 hover:shadow-md transition-all group"
              >
                <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <span className="font-semibold text-gray-900 dark:text-white">{action.label}</span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Recent orders + top products ── */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Orders</h2>
            <Link to="/dashboard/orders" className="text-sm text-orange-500 font-bold bg-orange-50 dark:bg-orange-500/10 px-3 py-1.5 rounded-lg">
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  {['Order ID', 'Customer', 'Amount', 'Order Status', 'Payment Status'].map(h => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {recentOrders.length > 0 ? recentOrders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">
                      #{order.order_number?.slice(0, 8) || order.id.slice(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {order.customer_name}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 dark:text-white">
                      ₦{Number(order.total).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                        order.status === 'shipped'   ? 'bg-blue-100 text-blue-800' :
                                                       'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase ${
                        order.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                        order.payment_status === 'failed' || order.payment_status === 'refunded' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {(order.payment_status || 'unknown').replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">
                      No orders yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Top Products</h2>
            <Link to="/dashboard/products" className="text-sm text-orange-500 font-bold">View All</Link>
          </div>
          <div className="p-6 space-y-5">
            {topProducts.length > 0 ? topProducts.map((product, i) => (
              <div key={product.id} className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {product.images?.[0]
                    ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" />
                    : <span className="text-gray-400 font-bold text-sm">{i + 1}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white truncate text-sm">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.sales_count || 0} sales</p>
                </div>
                <p className="font-bold text-gray-900 dark:text-white text-sm flex-shrink-0">
                  ₦{Number(product.selling_price).toLocaleString()}
                </p>
              </div>
            )) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 font-medium text-sm">No products yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Store setup prompt ── */}
      {!currentStore && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Complete Your Store Setup</h2>
              <p className="text-orange-100">You're just a few steps away from making your first sale!</p>
            </div>
            <Link to="/dashboard/store-setup" className="flex-shrink-0">
              <Button className="bg-white text-orange-600 hover:bg-orange-50 py-6 px-8 rounded-xl font-bold shadow-md">
                Set Up Store
                <ArrowUpRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        </motion.div>
      )}
      <Dialog open={isStoreLinkOpen} onOpenChange={setIsStoreLinkOpen}>
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-0">
          <div className="relative h-44 sm:h-52 bg-orange-50 overflow-hidden">
            <img
              src={storePromoImage}
              alt="Store promotion inspiration"
              className="h-full w-full object-cover"
              onError={() => setStorePromoImage(STORE_PROMO_IMAGES[0])}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950/75 via-gray-950/15 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5 text-white">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                <Store className="h-3.5 w-3.5" /> Your store, your brand
              </span>
              <h2 className="mt-2 text-2xl font-bold">Share your store with the world</h2>
            </div>
          </div>
          <div className="p-5 sm:p-6 space-y-5">
            <DialogHeader className="text-left space-y-2">
              <DialogTitle className="text-xl">Your personal store link</DialogTitle>
              <DialogDescription className="text-sm leading-6">
                This is your own storefront link. Share it with friends, customers, and on social media so people can browse and buy directly from your store.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-3">
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900">Want a fully branded address?</p>
                  <p className="text-sm leading-5 text-gray-600">
                    Set up a custom domain such as <span className="font-semibold text-gray-800">joshua.com</span> from <span className="font-semibold">Sidebar → Store Setup → Custom Domain</span>. It gives your store its own identity instead of a link that looks affiliated with QAfrica.
                  </p>
                  <p className="text-xs leading-5 text-gray-500">You can keep using your default store link for testing or sharing on social media in the meantime.</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your current store link</label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
                <span className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-gray-800">
                  {currentStore ? `${window.location.origin}/${currentStore.slug}` : 'Set up your store to get a link'}
                </span>
                <Button
                  type="button"
                  disabled={!currentStore || isCopyingStoreLink}
                  onClick={async () => {
                    if (!currentStore) return;
                    const url = `${window.location.origin}/${currentStore.slug}`;
                    setIsCopyingStoreLink(true);
                    try {
                      await navigator.clipboard.writeText(url);
                      toast.success('Store link copied to clipboard');
                    } catch {
                      toast.error('Could not copy automatically. Please copy the link from your browser.');
                    } finally {
                      setIsCopyingStoreLink(false);
                    }
                  }}
                  className="shrink-0 bg-orange-500 text-white hover:bg-orange-600"
                >
                  {isCopyingStoreLink ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  Copy Link
                </Button>
              </div>
              {!currentStore && <p className="text-xs text-amber-700">Complete store setup before sharing your storefront.</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
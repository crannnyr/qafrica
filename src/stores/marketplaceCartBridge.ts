import { useCartStore } from './cartStore';
import { useImportCartStore, type ImportCartItem } from './importCartStore';

const QAFRICA_STORE_ID = '00000000-0000-0000-0000-000000000000';
const QAFRICA_STORE = { id: QAFRICA_STORE_ID, name: 'QAFRICA', slug: 'qafrica' } as any;

function marketplaceRouteActive() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/stores-v2');
}

function mirrorImportItem(item: ImportCartItem) {
  const cart = useCartStore.getState();
  const existing = cart.items.find(i =>
    i.sourceType === 'china_import' &&
    i.sourceId === item.id &&
    JSON.stringify(i.variantOptions ?? {}) === JSON.stringify(item.variant_selection ?? {})
  );
  if (existing) {
    if (existing.quantity !== item.quantity) cart.updateQuantity(existing.id, item.quantity);
    return;
  }

  cart.addItem(
    { id: item.id, name: item.name, images: item.image_urls?.length ? item.image_urls : [item.image_url].filter(Boolean), selling_price: item.price_ngn } as any,
    QAFRICA_STORE,
    item.quantity,
    item.variant_selection,
    item.price_ngn,
    { sourceType: 'china_import', sourceId: item.id },
  );
}

let started = false;
export function startMarketplaceCartBridge() {
  if (started) return;
  started = true;

  const sync = () => {
    if (!marketplaceRouteActive()) return;
    const importStore = useImportCartStore.getState();
    const items = importStore.cart;
    items.forEach(mirrorImportItem);
    if (items.length) importStore.clearCart();
  };

  useImportCartStore.subscribe(sync);
  window.addEventListener('popstate', sync);
  sync();
}

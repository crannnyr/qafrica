// Curated collections for the premium looks (Atelier, Noir).
// Each collection = a hero slide on the storefront + its own page of hand-picked products.
// Saved into stores.look_settings.collections (no separate table needed yet).

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, Eye, EyeOff, Pencil, Plus, Search, Trash2, X, Check, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { SingleImageUpload } from '@/components/ImageUpload';
import { useStoreStore } from '@/stores';
import type { Product, StoreCollection } from '@/types';
import { getCollections, liveCollections, MAX_COLLECTIONS, slugifyCollection } from '@/lib/storefrontLooks';

const IDEAS = ['December Sales', 'Valentine Specials', 'New Arrivals', 'Back to School', 'Under ₦10,000', 'Gift Sets'];

const emptyDraft = (): StoreCollection => ({ id: '', title: '', subtitle: '', image: '', cta: 'Shop now', product_ids: [], starts_at: null, ends_at: null });

export default function CollectionsManager({ products, locked }: { products: Product[]; locked: boolean }) {
  const { currentStore, updateStore } = useStoreStore();
  const saved = useMemo(() => (currentStore ? getCollections(currentStore) : []), [currentStore]);
  const live = useMemo(() => new Set(currentStore ? liveCollections(currentStore).map((c) => c.id) : []), [currentStore]);
  const [editing, setEditing] = useState<StoreCollection | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());

  if (!currentStore) return null;

  const persist = async (next: StoreCollection[], message: string) => {
    setBusy(true);
    const res = await updateStore(currentStore.id, { look_settings: { ...(currentStore.look_settings ?? {}), collections: next } });
    setBusy(false);
    if (res.success) toast.success(message);
    else toast.error(`Not saved: ${res.error ?? 'please try again'}`);
    return res.success;
  };

  const startNew = (title = '') => {
    if (saved.length >= MAX_COLLECTIONS) return toast.error(`You can have up to ${MAX_COLLECTIONS} collections.`);
    setIsNew(true);
    setEditing({ ...emptyDraft(), title });
  };

  const saveDraft = async (d: StoreCollection) => {
    const title = d.title.trim();
    if (!title) return toast.error('Give the collection a name.');
    if (d.product_ids.length === 0) return toast.error('Pick at least one product.');
    if (d.starts_at && d.ends_at && d.starts_at > d.ends_at) return toast.error('The end date is before the start date.');
    let id = d.id || slugifyCollection(title);
    if (isNew) {
      const taken = new Set(saved.map((c) => c.id));
      let n = 2;
      const base = id;
      while (taken.has(id)) id = `${base}-${n++}`;
    }
    const clean: StoreCollection = {
      id, title,
      subtitle: d.subtitle?.trim() || undefined,
      image: d.image || undefined,
      cta: d.cta?.trim() || 'Shop now',
      product_ids: d.product_ids,
      starts_at: d.starts_at || null,
      ends_at: d.ends_at || null,
      hidden: d.hidden || undefined,
    };
    const next = isNew ? [...saved, clean] : saved.map((c) => (c.id === d.id ? clean : c));
    if (await persist(next, isNew ? 'Collection added to your store.' : 'Collection updated.')) setEditing(null);
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...saved];
    const [c] = next.splice(i, 1);
    next.splice(i + dir, 0, c);
    persist(next, 'Order updated.');
  };

  return (
    <fieldset className={locked ? 'opacity-60 pointer-events-none select-none' : ''} aria-disabled={locked}>
      <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Curated collections</legend>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 max-w-xl">
        Group products into collections like "December Sales" or "Valentine Specials". Each live collection becomes a slide in your store's hero and opens its own page with only the products you picked. Add dates and it switches on and off by itself.
      </p>

      {saved.length === 0 && !editing && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-5 text-center">
          <Layers className="w-6 h-6 mx-auto text-gray-400" />
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">No collections yet. Start with one of these:</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {IDEAS.map((t) => (
              <button key={t} type="button" onClick={() => startNew(t)} className="px-3 h-8 rounded-full text-xs border border-gray-300 dark:border-gray-600 hover:border-orange-500 hover:text-orange-600">
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <ul className="space-y-2">
          {saved.map((c, i) => {
            const isLive = live.has(c.id);
            const status = c.hidden ? 'Hidden' : isLive ? 'Live' : c.starts_at && Date.parse(c.starts_at) > now ? `Starts ${fmt(c.starts_at)}` : 'Ended';
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 p-2.5">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 shrink-0">
                  {(c.image || products.find((p) => p.id === c.product_ids[0])?.images?.[0]) && (
                    <img src={c.image || products.find((p) => p.id === c.product_ids[0])?.images?.[0]} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {c.product_ids.length} products ·{' '}
                    <span className={isLive ? 'text-green-600 dark:text-green-400 font-medium' : ''}>{status}</span>
                    {c.ends_at && isLive && <> · until {fmt(c.ends_at)}</>}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <IconBtn label="Move up" disabled={i === 0 || busy} onClick={() => move(i, -1)}><ArrowUp className="w-4 h-4" /></IconBtn>
                  <IconBtn label="Move down" disabled={i === saved.length - 1 || busy} onClick={() => move(i, 1)}><ArrowDown className="w-4 h-4" /></IconBtn>
                  <IconBtn label={c.hidden ? 'Show' : 'Hide'} disabled={busy} onClick={() => persist(saved.map((x) => (x.id === c.id ? { ...x, hidden: !x.hidden || undefined } : x)), c.hidden ? 'Collection shown.' : 'Collection hidden.')}>
                    {c.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </IconBtn>
                  <IconBtn label="Edit" disabled={busy} onClick={() => { setIsNew(false); setEditing({ ...c }); }}><Pencil className="w-4 h-4" /></IconBtn>
                  <IconBtn label="Delete" disabled={busy} onClick={() => { if (confirm(`Delete "${c.title}"? Products stay in your store.`)) persist(saved.filter((x) => x.id !== c.id), 'Collection deleted.'); }}>
                    <Trash2 className="w-4 h-4" />
                  </IconBtn>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!editing && saved.length > 0 && saved.length < MAX_COLLECTIONS && (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => startNew()}>
          <Plus className="w-4 h-4 mr-1.5" /> New collection
        </Button>
      )}

      {editing && (
        <Editor
          draft={editing}
          isNew={isNew}
          products={products}
          storeId={currentStore.id}
          busy={busy}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => saveDraft(editing)}
        />
      )}
    </fieldset>
  );
}

function Editor(p: {
  draft: StoreCollection; isNew: boolean; products: Product[]; storeId: string; busy: boolean;
  onChange: (d: StoreCollection) => void; onCancel: () => void; onSave: () => void;
}) {
  const d = p.draft;
  const [q, setQ] = useState('');
  const set = (patch: Partial<StoreCollection>) => p.onChange({ ...d, ...patch });
  const picked = new Set(d.product_ids);
  const list = p.products.filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => set({ product_ids: picked.has(id) ? d.product_ids.filter((x) => x !== id) : [...d.product_ids, id] });
  const input = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500';

  return (
    <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 sm:p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.isNew ? 'New collection' : `Edit "${d.title}"`}</p>
        <button type="button" onClick={p.onCancel} aria-label="Close" className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"><X className="w-4 h-4" /></button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Name</span>
          <input className={input} value={d.title} maxLength={40} placeholder="December Sales" onChange={(e) => set({ title: e.target.value })} />
        </label>
        <label className="block">
          <span className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Button label</span>
          <input className={input} value={d.cta ?? ''} maxLength={20} placeholder="Shop now" onChange={(e) => set({ cta: e.target.value })} />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Short line <span className="font-normal text-gray-400">(optional)</span></span>
          <input className={input} value={d.subtitle ?? ''} maxLength={90} placeholder="Up to 30% off gifts, this week only" onChange={(e) => set({ subtitle: e.target.value })} />
        </label>
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Hero image</span>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">A wide, bright photo works best (at least 1600px across). Without one, the first product photo is used.</p>
        <div className="max-w-sm">
          <SingleImageUpload bucket="store-banners" folder={`${p.storeId}/collections`} value={d.image ?? ''} onChange={(url) => set({ image: (url as string) || '' })} placeholder="Upload hero image" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 max-w-md">
        <label className="block">
          <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 mb-1"><CalendarDays className="w-4 h-4" />Starts</span>
          <input type="date" className={input} value={d.starts_at?.slice(0, 10) ?? ''} onChange={(e) => set({ starts_at: e.target.value || null })} />
        </label>
        <label className="block">
          <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 mb-1"><CalendarDays className="w-4 h-4" />Ends</span>
          <input type="date" className={input} value={d.ends_at?.slice(0, 10) ?? ''} onChange={(e) => set({ ends_at: e.target.value || null })} />
        </label>
        <p className="sm:col-span-2 -mt-2 text-xs text-gray-500 dark:text-gray-400">Leave empty to keep it live until you hide it.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Products <span className="font-normal text-gray-500">({d.product_ids.length} picked)</span></span>
          {d.product_ids.length > 0 && <button type="button" onClick={() => set({ product_ids: [] })} className="text-xs text-gray-500 underline">Clear</button>}
        </div>
        <div className="relative mb-2 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className={`${input} pl-9`} placeholder="Search your products" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {p.products.length === 0 ? (
          <p className="text-sm text-gray-500">Add products to your store first.</p>
        ) : (
          <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 max-h-80 overflow-y-auto pr-1">
            {list.map((x) => {
              const on = picked.has(x.id);
              return (
                <li key={x.id}>
                  <button type="button" onClick={() => toggle(x.id)} aria-pressed={on}
                    className={`relative w-full text-left rounded-lg overflow-hidden border-2 transition-colors ${on ? 'border-orange-500' : 'border-transparent hover:border-gray-300'}`}>
                    <div className="aspect-square bg-gray-100 dark:bg-gray-700">
                      {x.images?.[0] && <img src={x.images[0]} alt="" loading="lazy" className="w-full h-full object-cover" />}
                    </div>
                    <p className="px-1.5 py-1 text-[11px] leading-tight text-gray-800 dark:text-gray-200 line-clamp-2 bg-white dark:bg-gray-800">{x.name}</p>
                    {on && <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center"><Check className="w-3 h-3 text-white" /></span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={p.onCancel}>Cancel</Button>
        <Button type="button" size="sm" onClick={p.onSave} disabled={p.busy} className="bg-orange-500 hover:bg-orange-600 text-white">
          {p.busy ? 'Saving…' : p.isNew ? 'Add collection' : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

function IconBtn(p: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={p.label} title={p.label} onClick={p.onClick} disabled={p.disabled}
      className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-30 disabled:pointer-events-none">
      {p.children}
    </button>
  );
}

const fmt = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });

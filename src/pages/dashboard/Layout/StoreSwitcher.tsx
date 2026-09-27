// Store switcher for accounts granted multi-store access (server-enforced via
// list_switchable_stores / switch_active_store). Dropdown on desktop, bottom sheet on phones.

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Store as StoreIcon, X } from 'lucide-react';

export type SwitchableStore = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
};

type Props = {
  stores: SwitchableStore[];
  currentStoreId: string | undefined;
  onSwitch: (storeId: string) => Promise<void>;
};

function Logo({ store, size = 'sm' }: { store: Pick<SwitchableStore, 'name' | 'logo_url'>; size?: 'sm' | 'md' }) {
  const dim = size === 'md' ? 'w-9 h-9 text-sm' : 'w-6 h-6 text-[11px]';
  return store.logo_url ? (
    <img src={store.logo_url} alt="" className={`${dim} rounded-md object-cover shrink-0 bg-gray-100`} />
  ) : (
    <span className={`${dim} rounded-md shrink-0 bg-orange-100 text-orange-700 font-bold flex items-center justify-center`} aria-hidden>
      {store.name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function StoreSwitcher({ stores, currentStoreId, onSwitch }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const current = stores.find((s) => s.id === currentStoreId);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  if (stores.length < 2) return null;

  const pick = async (id: string) => {
    if (id === currentStoreId || pending) {
      setOpen(false);
      return;
    }
    setPending(id);
    try {
      await onSwitch(id);
      setOpen(false);
    } finally {
      setPending(null);
    }
  };

  const list = (
    <ul role="listbox" aria-label="Your stores" className="py-1">
      {stores.map((s) => {
        const selected = s.id === currentStoreId;
        return (
          <li key={s.id} role="option" aria-selected={selected}>
            <button
              type="button"
              onClick={() => pick(s.id)}
              disabled={!!pending}
              className="w-full flex items-center gap-3 px-4 py-3 sm:py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/60 disabled:opacity-60 focus-visible:outline-none focus-visible:bg-gray-50 dark:focus-visible:bg-gray-700/60"
            >
              <Logo store={s} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">{s.name}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                  qafrica.store/{s.slug}
                  {!s.is_active && <span className="ml-1.5 text-amber-600 dark:text-amber-400">• Offline</span>}
                </span>
              </span>
              {pending === s.id ? (
                <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" aria-label="Switching" />
              ) : selected ? (
                <Check className="w-4 h-4 text-orange-500" aria-hidden />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Current store: ${current?.name ?? 'none'}. Switch store`}
        className="flex items-center gap-2 max-w-[46vw] sm:max-w-[240px] pl-1.5 pr-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        {current ? <Logo store={current} /> : <StoreIcon className="w-4 h-4 text-gray-400" />}
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{current?.name ?? 'Choose store'}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <>
          {/* Desktop dropdown */}
          <div className="hidden sm:block absolute left-0 top-full mt-2 w-72 max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl z-50">
            <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Switch store</p>
            {list}
          </div>

          {/* Phone bottom sheet */}
          <div className="sm:hidden fixed inset-0 z-[60]">
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl max-h-[75vh] overflow-y-auto"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-4 pt-4 pb-2">
                <p className="text-base font-semibold text-gray-900 dark:text-white">Switch store</p>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {list}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

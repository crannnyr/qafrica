import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ExternalLink, ImageOff, Smartphone, PanelLeft, PanelRight, PanelBottom, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { productService } from '@/services';
import type { Product, Store, StorefrontLook, StorefrontNavStyle } from '@/types';
import { STOREFRONT_LOOKS, getLook, loadLookFonts } from '@/lib/storefrontLooks';
import { buildCategories } from '@/lib/storefrontCategories';

type Draft = {
  storefront_look: StorefrontLook;
  nav_style: StorefrontNavStyle;
  sidebar_side: 'left' | 'right';
  look_settings: Record<string, string>;
  category_images: Record<string, string>;
};

const fromStore = (s: Store): Draft => ({
  storefront_look: s.storefront_look ?? 'classic',
  nav_style: s.nav_style ?? 'auto',
  sidebar_side: s.sidebar_side ?? 'left',
  look_settings: Object.fromEntries(
    Object.entries(s.look_settings ?? {}).filter(([, v]) => typeof v === 'string'),
  ) as Record<string, string>,
  category_images: { ...(s.category_images ?? {}) },
});

export default function StorefrontLookSettings() {
  const { currentStore, updateStore } = useStoreStore();
  // Unsaved edits; until the owner changes something the form shows the saved store
  const [edits, setDraft] = useState<Draft | null>(null);
  const draft = edits ?? (currentStore ? fromStore(currentStore) : null);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewSrc, setPreviewSrc] = useState('');

  useEffect(() => {
    if (!currentStore?.id) return;
    productService.getStoreProducts(currentStore.id).then(({ data }) =>
      setProducts(((data as Product[]) ?? []).filter((p) => p.is_active)),
    );
  }, [currentStore?.id]);

  // Load every look's fonts so the cards show the real typefaces
  useEffect(() => STOREFRONT_LOOKS.forEach(loadLookFonts), []);

  const look = getLook(draft?.storefront_look);
  const effectiveNav = draft?.nav_style === 'auto' ? look?.defaultNav ?? 'bottom' : draft?.nav_style;

  const previewUrl =
    currentStore && draft
      ? `/${currentStore.slug}?${new URLSearchParams({
          sf_preview: '1',
          sf_look: draft.storefront_look,
          sf_nav: draft.nav_style,
          sf_side: draft.sidebar_side,
          sf_settings: JSON.stringify(draft.look_settings),
        }).toString()}`
      : '';

  // Debounce so typing in a field doesn't reload the preview on every key
  useEffect(() => {
    const t = setTimeout(() => setPreviewSrc(previewUrl), 500);
    return () => clearTimeout(t);
  }, [previewUrl]);

  const categories = useMemo(
    () => (currentStore ? buildCategories(products, { ...currentStore, category_images: {} }) : []),
    [products, currentStore],
  );

  if (!currentStore || !draft) return null;

  const saved = fromStore(currentStore);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setField = (key: string, value: string) =>
    set({ look_settings: { ...draft.look_settings, [key]: value } });

  const save = async () => {
    setSaving(true);
    // Only keep settings that belong to a look and aren't empty
    const allowed = new Set(STOREFRONT_LOOKS.flatMap((l) => l.fields.map((f) => f.key)));
    const look_settings = Object.fromEntries(
      Object.entries(draft.look_settings)
        .map(([k, v]) => [k, v.trim()] as const)
        .filter(([k, v]) => allowed.has(k) && v),
    );
    const category_images = Object.fromEntries(Object.entries(draft.category_images).filter(([, v]) => !!v));
    const res = await updateStore(currentStore.id, { ...draft, look_settings, category_images });
    setSaving(false);
    if (res.success) {
      setDraft(null); // show the freshly saved store
      toast.success('Layout saved. Your store is updated.');
    }
    else toast.error(`Layout not saved: ${res.error ?? 'please try again'}`);
  };

  const lookCards: { id: StorefrontLook; name: string; summary: string; bestFor: string; font?: string }[] = [
    { id: 'classic', name: 'Classic', summary: 'The layout your store has today.', bestFor: 'Keep things as they are.' },
    ...STOREFRONT_LOOKS.map((l) => ({ id: l.id, name: l.name, summary: l.summary, bestFor: l.bestFor, font: l.fonts.display })),
  ];

  const navOptions: { id: StorefrontNavStyle; label: string; help: string; icon: typeof PanelBottom }[] = [
    { id: 'bottom', label: 'Bottom bar', help: 'Home, categories, search, cart and account along the bottom of the phone screen.', icon: PanelBottom },
    { id: 'sidebar', label: 'Sidebar', help: 'A side menu. Always visible on computers; slides in on phones.', icon: draft.sidebar_side === 'right' ? PanelRight : PanelLeft },
  ];

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Store layout</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
            Choose how your store is arranged for shoppers. Your colours come from the theme below and stay the same whichever layout you pick.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="lg:hidden">
            <Button variant="outline" size="sm"><Smartphone className="w-4 h-4 mr-1.5" />Preview</Button>
          </a>
          <Button size="sm" onClick={save} disabled={!dirty || saving} className="bg-orange-500 hover:bg-orange-600 text-white">
            {saving ? 'Saving…' : dirty ? 'Save layout' : 'Saved'}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_300px] gap-8">
        <div className="space-y-8 min-w-0">
          {/* Look */}
          <fieldset>
            <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Layout</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {lookCards.map((c) => {
                const selected = draft.storefront_look === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => set({ storefront_look: c.id })}
                    className={`relative text-left rounded-xl border-2 p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                      selected ? 'border-orange-500 bg-orange-50/60 dark:bg-orange-500/10' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {selected && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    )}
                    <span className="block text-2xl text-gray-900 dark:text-white leading-none mb-2" style={c.font ? { fontFamily: c.font } : undefined}>
                      {c.name}
                    </span>
                    <span className="block text-sm text-gray-600 dark:text-gray-300">{c.summary}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-2">Good for: {c.bestFor}</span>
                    {currentStore.storefront_look === c.id && (
                      <span className="inline-block mt-2 text-[11px] font-medium text-green-700 dark:text-green-400">Live now</span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {look && (
            <>
              {/* Details this look needs */}
              {(look.fields.length > 0 || look.needsBanner) && (
                <fieldset>
                  <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Details for {look.name}</legend>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">This layout uses a few extra details. Optional, but your store looks best with them filled in.</p>
                  {look.needsBanner && !currentStore.banner_url && (
                    <div className="flex gap-2.5 rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4 text-sm text-amber-900">
                      <ImageOff className="w-4 h-4 mt-0.5 shrink-0" />
                      <p>
                        {look.name} opens with a large cover photo and you haven't added one.{' '}
                        <Link to="/dashboard/settings?tab=images" className="font-semibold underline underline-offset-2">Add a cover photo</Link>
                        {' '}(a wide photo, at least 1600px across, works best).
                      </p>
                    </div>
                  )}
                  <div className="space-y-4">
                    {look.fields.map((f) => (
                      <div key={f.key}>
                        <label htmlFor={`lf-${f.key}`} className="block text-sm font-medium text-gray-800 dark:text-gray-200">{f.label}</label>
                        <p id={`lf-${f.key}-help`} className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-1.5">{f.help}</p>
                        <input
                          id={`lf-${f.key}`}
                          aria-describedby={`lf-${f.key}-help`}
                          value={draft.look_settings[f.key] ?? ''}
                          maxLength={f.maxLength}
                          placeholder={f.placeholder}
                          onChange={(e) => setField(f.key, e.target.value)}
                          className="w-full max-w-md px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                        {f.maxLength && (
                          <p className="text-[11px] text-gray-400 mt-1">{(draft.look_settings[f.key] ?? '').length}/{f.maxLength}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* Navigation */}
              <fieldset>
                <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Navigation</legend>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {look.name} uses a {look.defaultNav === 'bottom' ? 'bottom bar' : 'sidebar'} unless you choose otherwise.
                </p>
                <div className="grid sm:grid-cols-2 gap-3 max-w-xl">
                  {navOptions.map((o) => {
                    const active = effectiveNav === o.id;
                    const Icon = o.icon;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => set({ nav_style: o.id })}
                        className={`text-left rounded-lg border-2 p-3 flex gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${
                          active ? 'border-orange-500' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-5 h-5 mt-0.5 shrink-0 text-gray-700 dark:text-gray-300" />
                        <span>
                          <span className="block text-sm font-medium text-gray-900 dark:text-white">{o.label}</span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{o.help}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {draft.nav_style !== 'auto' && draft.nav_style !== look.defaultNav && (
                  <button type="button" onClick={() => set({ nav_style: 'auto' })} className="mt-2 text-xs text-orange-600 underline underline-offset-2">
                    Use the {look.name} default instead
                  </button>
                )}

                {effectiveNav === 'sidebar' && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">Sidebar side</p>
                    <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1" role="radiogroup" aria-label="Sidebar side">
                      {(['left', 'right'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={draft.sidebar_side === s}
                          onClick={() => set({ sidebar_side: s })}
                          className={`px-4 py-1.5 text-sm rounded-md capitalize ${
                            draft.sidebar_side === s ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>

              {/* Category circles */}
              <fieldset>
                <legend className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Category circles</legend>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Each category shows as a circle with one product photo. By default it's your newest product in that category; pick a different photo if you prefer.
                </p>
                {categories.length === 0 ? (
                  <p className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    Add a category to your products and circles will appear here.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {categories.map((c) => {
                      const options = Array.from(
                        new Set(products.filter((p) => p.category === c.name).flatMap((p) => p.images?.slice(0, 3) ?? [])),
                      ).slice(0, 12);
                      const chosen = draft.category_images[c.name] ?? '';
                      return (
                        <li key={c.name}>
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                            {c.name} <span className="text-xs font-normal text-gray-400">({c.count})</span>
                          </p>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            <button
                              type="button"
                              onClick={() => set({ category_images: { ...draft.category_images, [c.name]: '' } })}
                              aria-pressed={!chosen}
                              className={`shrink-0 w-14 h-14 rounded-full text-[10px] font-medium flex items-center justify-center border-2 ${
                                !chosen ? 'border-orange-500 text-orange-600' : 'border-gray-200 text-gray-500 dark:border-gray-600'
                              }`}
                            >
                              Auto
                            </button>
                            {options.map((img) => (
                              <button
                                key={img}
                                type="button"
                                aria-label={`Use this photo for ${c.name}`}
                                aria-pressed={chosen === img}
                                onClick={() => set({ category_images: { ...draft.category_images, [c.name]: img } })}
                                className={`shrink-0 w-14 h-14 rounded-full overflow-hidden border-2 ${chosen === img ? 'border-orange-500' : 'border-transparent'}`}
                              >
                                <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                              </button>
                            ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </fieldset>
            </>
          )}

          {!look && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Classic keeps your current layout. Pick one of the other layouts to set navigation, sidebar side and category circles.
            </p>
          )}
        </div>

        {/* Live phone preview (desktop) */}
        <div className="hidden lg:block">
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Phone preview</p>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 inline-flex items-center gap-1">
                Open full size <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="rounded-[2.2rem] border-[10px] border-gray-900 overflow-hidden bg-white shadow-xl" style={{ width: 300, height: 600 }}>
              {previewSrc && (
                <iframe
                  key={previewSrc}
                  title="Store preview"
                  src={previewSrc}
                  style={{ width: 390, height: 808, transform: 'scale(0.718)', transformOrigin: 'top left', border: 0 }}
                />
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Preview shows unsaved changes. Category photo picks show after you save.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

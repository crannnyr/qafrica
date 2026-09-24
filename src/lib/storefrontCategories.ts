import type { Product, Store } from '@/types';

export type CategoryEntry = { name: string; image?: string; count: number };

/** Builds category list; circle image = owner's pick, else newest product image in that category. */
export function buildCategories(products: Product[], store: Store): CategoryEntry[] {
  const map = new Map<string, CategoryEntry & { newest: number }>();
  for (const p of products) {
    const name = p.category?.trim();
    if (!name) continue;
    const created = p.created_at ? Date.parse(p.created_at) || 0 : 0;
    const entry = map.get(name);
    const img = p.images?.[0];
    if (!entry) {
      map.set(name, { name, image: img, count: 1, newest: img ? created : -1 });
    } else {
      entry.count += 1;
      if (img && created > entry.newest) {
        entry.image = img;
        entry.newest = created;
      }
    }
  }
  const picks = store.category_images ?? {};
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .map(({ name, image, count }) => ({ name, count, image: picks[name] || image }));
}

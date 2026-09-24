// Storefront "looks" = layout templates. Separate from `theme` in lib/themes.ts,
// which only controls colours/fonts palette. A store's colours still come from
// store.primary_color; the look decides layout, typography and navigation defaults.

import type { Store, StorefrontLook, StorefrontNavStyle } from '@/types';

export type LookSettingField = {
  key: string;
  label: string;
  help: string;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
};

export type LookDefinition = {
  id: Exclude<StorefrontLook, 'classic'>;
  name: string;
  summary: string;
  bestFor: string;
  fonts: {
    display: string;
    body: string;
    googleFamilies: string[]; // Google Fonts css2 family specs
  };
  defaultNav: Exclude<StorefrontNavStyle, 'auto'>;
  // Details the owner is asked for when they pick this look
  fields: LookSettingField[];
  // Things the look needs from the store itself (checked in settings)
  needsBanner?: boolean;
};

export const STOREFRONT_LOOKS: LookDefinition[] = [
  {
    id: 'clean',
    name: 'Clean',
    summary: 'Two-tone wordmark, lots of white space, nothing competing with your products.',
    bestFor: 'Any store. A safe, modern default.',
    fonts: {
      display: "'Geist', system-ui, sans-serif",
      body: "'Geist', system-ui, sans-serif",
      googleFamilies: ['Geist:wght@400;500;600;700;800'],
    },
    defaultNav: 'bottom',
    fields: [
      {
        key: 'wordmark_dark',
        label: 'Wordmark: dark part',
        help: 'The first part of your name, shown in bold black. Example: "Riv" in RivSpace.',
        placeholder: 'Riv',
        maxLength: 20,
      },
      {
        key: 'wordmark_accent',
        label: 'Wordmark: coloured part',
        help: 'The second part, shown in your brand colour. Example: "Space". Leave both empty to split your store name automatically.',
        placeholder: 'Space',
        maxLength: 20,
      },
    ],
  },
  {
    id: 'boutique',
    name: 'Boutique',
    summary: 'Editorial serif type, a large cover photo and tall product photos.',
    bestFor: 'Fashion, beauty, jewellery, fragrance.',
    fonts: {
      display: "'Cormorant Garamond', Georgia, serif",
      body: "'Jost', system-ui, sans-serif",
      googleFamilies: ['Cormorant+Garamond:ital,wght@0,500;0,600;1,500', 'Jost:wght@400;500;600'],
    },
    defaultNav: 'sidebar',
    needsBanner: true,
    fields: [
      {
        key: 'tagline',
        label: 'Cover line',
        help: 'One short line shown over your cover photo. Example: "Handmade ankara, cut to fit."',
        placeholder: 'Handmade ankara, cut to fit.',
        maxLength: 70,
      },
    ],
  },
  {
    id: 'catalog',
    name: 'Catalog',
    summary: 'Search always visible, dense grid, sorting by price. Built for big inventories.',
    bestFor: 'Phones, laptops, accessories, spare parts, groceries.',
    fonts: {
      display: "'Inter Tight', system-ui, sans-serif",
      body: "'Inter Tight', system-ui, sans-serif",
      googleFamilies: ['Inter+Tight:wght@400;500;600;700'],
    },
    defaultNav: 'sidebar',
    fields: [],
  },
  {
    id: 'social',
    name: 'Social',
    summary: 'Handwritten headings, story-style category circles and a scrolling feed of products.',
    bestFor: 'Sellers who grew on Instagram, TikTok or WhatsApp.',
    fonts: {
      display: "'Caveat', 'Comic Sans MS', cursive",
      body: "'Nunito', system-ui, sans-serif",
      googleFamilies: ['Caveat:wght@600;700', 'Nunito:wght@400;600;700;800'],
    },
    defaultNav: 'bottom',
    fields: [
      {
        key: 'bio',
        label: 'Short bio',
        help: 'A line under your name, like an Instagram bio. Example: "Thrift finds every Friday • Lagos delivery".',
        placeholder: 'Thrift finds every Friday • Lagos delivery',
        maxLength: 90,
      },
    ],
  },
  {
    id: 'bento',
    name: 'Bento',
    summary: 'Oversized store name and a mixed-size tile grid that puts your best items first.',
    bestFor: 'Gadgets, sneakers, streetwear, home décor.',
    fonts: {
      display: "'Space Grotesk', system-ui, sans-serif",
      body: "'Space Grotesk', system-ui, sans-serif",
      googleFamilies: ['Space+Grotesk:wght@400;500;600;700'],
    },
    defaultNav: 'bottom',
    fields: [
      {
        key: 'headline',
        label: 'Headline',
        help: 'Big text at the top of your store. Leave empty to use your store name.',
        placeholder: 'New drops weekly',
        maxLength: 40,
      },
    ],
  },
];

export const getLook = (id?: string | null): LookDefinition | undefined =>
  STOREFRONT_LOOKS.find((l) => l.id === id);

export const isNewLook = (id?: string | null): id is LookDefinition['id'] => !!getLook(id);

export function resolveNavStyle(store: Pick<Store, 'nav_style' | 'storefront_look'>): 'bottom' | 'sidebar' {
  if (store.nav_style === 'bottom' || store.nav_style === 'sidebar') return store.nav_style;
  return getLook(store.storefront_look)?.defaultNav ?? 'bottom';
}

export function lookSetting(store: Pick<Store, 'look_settings'>, key: string): string {
  const v = store.look_settings?.[key];
  return typeof v === 'string' ? v.trim() : '';
}

export function splitWordmark(store: Pick<Store, 'name' | 'look_settings'>): [string, string] {
  const dark = lookSetting(store, 'wordmark_dark');
  const accent = lookSetting(store, 'wordmark_accent');
  if (dark || accent) return [dark, accent];
  const name = store.name.trim();
  const space = name.indexOf(' ');
  if (space > 0) return [name.slice(0, space), name.slice(space)];
  // Split CamelCase ("RivSpace") or fall back to the midpoint
  const camel = name.slice(1).search(/[A-Z]/);
  const at = camel >= 0 ? camel + 1 : Math.ceil(name.length / 2);
  return [name.slice(0, at), name.slice(at)];
}

export function getContrastColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return '#ffffff';
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#000000' : '#ffffff';
}

/** Loads a look's Google Fonts once per page. */
export function loadLookFonts(look: LookDefinition) {
  const id = `sf-fonts-${look.id}`;
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${look.fonts.googleFamilies
    .map((f) => `family=${f}`)
    .join('&')}&display=swap`;
  document.head.appendChild(link);
}

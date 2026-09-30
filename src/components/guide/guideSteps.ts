// Content of the dashboard setup guide: the spotlight tour and the setup checklist.
// `target` matches a data-tour="…" attribute in the dashboard (sidebar items are "nav-<path>").

export type TourStep = {
  id: string;
  target?: string;          // absent = centred card
  title: string;
  body: string;
  core?: boolean;           // every seller must see these; skipping warns about unseen ones
  short?: string;           // one line shown in the skip warning
  cta?: { label: string; to: string };
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: "Let's get your store ready",
    body: 'A 2-minute tour of your dashboard. We will show you where everything is and the few things every seller needs to do.',
  },
  {
    id: 'email',
    short: 'Orders, payouts and security alerts only reach a confirmed email.',
    target: 'nav-/dashboard/settings',
    core: true,
    title: 'Start here: confirm your email',
    body: 'New orders, payouts and security alerts are sent to your email. Open Settings, then Account, and enter the 6-digit code we send you. It is the first item on your checklist.',
  },
  {
    id: 'menu',
    target: 'sidebar-nav',
    title: 'Everything lives in this menu',
    body: 'Products, orders, money and store setup each have their own section. Tap a section to open it.',
  },
  {
    id: 'store-link',
    target: 'store-card',
    title: 'This is your store link',
    body: 'Share it on WhatsApp, Instagram and TikTok. Sales from people who use your own link have no QAFRICA fee.',
  },
  {
    id: 'products',
    short: 'Clear photos on white, the right price and stock sell; blurry ones do not.',
    target: 'nav-/dashboard/products',
    core: true,
    title: 'Add what you sell',
    body: 'Add clear photos (the main photo on a plain white background), your price, stock, and sizes or colours. Turn on dropshipping to let other sellers resell your product. With Import Catalog you can also sell other sellers’ products without holding stock.',
  },
  {
    id: 'orders',
    short: 'Mark paid orders "Ready to ship" within 48 hours.',
    target: 'nav-/dashboard/orders',
    core: true,
    title: 'Orders, coupons and reviews',
    body: 'When a paid order arrives, pack it and mark it "Ready to ship" within 48 hours. Coupons let you run discounts, and Reviews is where you reply to your buyers.',
  },
  {
    id: 'money',
    short: 'Money is held until the buyer receives the order, then you can withdraw it.',
    target: 'nav-/dashboard/wallet',
    core: true,
    title: 'How you get paid',
    body: 'Buyers pay QAFRICA first, so they trust you. The money waits "On hold" until the buyer receives the order, becomes "Available" 7 days after delivery, and then you withdraw it to your bank.',
  },
  {
    id: 'delivery',
    short: 'Set the states you deliver to and your fee for each, or buyers cannot check out correctly.',
    target: 'nav-/dashboard/delivery-zones',
    core: true,
    title: 'Where you deliver, and for how much',
    body: 'In Store Setup, choose the states you deliver to and the delivery fee for each. Buyers see this at checkout.',
  },
  {
    id: 'domain',
    target: 'nav-/dashboard/delivery-zones',
    title: 'Make it fully yours with a domain',
    body: 'Buy your own .com, .store or .shop in Store Setup, then Custom Domain. Your store opens on your own name, like yourbrand.com, and looks completely like your brand.',
  },
  {
    id: 'marketplace',
    target: 'nav-/dashboard/marketplace',
    title: 'Get extra customers',
    body: 'Switch on the QAFRICA Marketplace to also show your products to shoppers browsing QAFRICA. A few simple rules apply, like shipping within 48 hours.',
  },
  {
    id: 'themes',
    target: 'nav-/dashboard/themes',
    title: 'Make it look like your brand',
    body: 'Pick a layout and colours. The Growth plan unlocks premium themes with a rotating hero and curated collections like "December Sales".',
  },
  {
    id: 'help',
    target: 'nav-/dashboard/how-to-use',
    title: 'Help is always here',
    body: 'Replay this tour or read the guides any time from How to Use. Your setup checklist stays in the corner until you finish it.',
  },
  {
    id: 'finish',
    title: "You're ready. Now the checklist",
    body: 'Work through the checklist in the corner, starting with confirming your email. Most sellers finish it in about 15 minutes.',
    cta: { label: 'Confirm my email', to: '/dashboard/settings?tab=account' },
  },
];

export type ChecklistKey = 'email' | 'images' | 'delivery' | 'product' | 'share' | 'marketplace' | 'domain';

export const CHECKLIST: { key: ChecklistKey; label: string; hint: string; to: string }[] = [
  { key: 'email',       label: 'Confirm your email',              hint: 'So order and payout emails reach you',        to: '/dashboard/settings?tab=account' },
  { key: 'images',      label: 'Add your logo and banner',        hint: 'Buyers trust stores that look finished',      to: '/dashboard/settings?tab=images' },
  { key: 'delivery',    label: 'Set delivery states and fees',    hint: 'Choose where you deliver and what it costs',  to: '/dashboard/delivery-zones' },
  { key: 'product',     label: 'Add your first product',          hint: 'Photo on white, price, stock',                to: '/dashboard/products/add' },
  { key: 'share',       label: 'Share your store link',           hint: 'Post it on WhatsApp, Instagram or TikTok',    to: '' },
  { key: 'marketplace', label: 'Switch on the marketplace',       hint: 'Reach shoppers browsing QAFRICA',             to: '/dashboard/marketplace' },
  { key: 'domain',      label: 'Get your own domain',             hint: '.com, .store or .shop for full branding',     to: '/dashboard/domain' },
];

// src/pages/blog/posts/index.ts

export interface BlogPost {
  slug:        string;
  title:       string;
  description: string;
  category:    string;
  readTime:    string;
  date:        string;
  keywords:    string[];
  featured:    boolean;
}

export const posts: BlogPost[] = [
  {
    slug:        'what-sells-best-on-jumia-2026',
    title:       'What Sells Best on Jumia in 2026 (And How to Sell It Without Touching Stock)',
    description: 'We analysed millions of Jumia transactions to find the top selling products. The best part? You can sell every single one without ever holding inventory.',
    category:    'Jumia',
    readTime:    '6 min read',
    date:        'June 2026',
    keywords:    ['what sells on jumia','best products jumia nigeria','jumia top sellers 2026','sell on jumia without stock'],
    featured:    true,
  },
  {
    slug:        'how-to-sell-on-jumia-without-getting-banned',
    title:       'How to Sell on Jumia Without Getting Banned (The Quality Control Secret)',
    description: "Jumia bans thousands of sellers every month for quality violations. Here's exactly how to stay safe — and how QAFRICA's 2-layer QC does it for you automatically.",
    category:    'Jumia',
    readTime:    '7 min read',
    date:        'June 2026',
    keywords:    ['jumia seller banned','jumia quality control','how to sell on jumia safely','jumia vendor tips nigeria'],
    featured:    true,
  },
  {
    slug:        'dropshipping-from-china-to-nigeria',
    title:       'Dropshipping from China to Nigeria in 2026 — The Complete Guide',
    description: 'Source products from China, sell them in Nigeria without ever seeing them. QAFRICA handles warehousing, quality checks, listing and fulfilment.',
    category:    'Dropshipping',
    readTime:    '8 min read',
    date:        'June 2026',
    keywords:    ['dropshipping china nigeria','source products china nigeria','import from china nigeria','dropshipping nigeria 2026'],
    featured:    true,
  },
  {
    slug:        'how-to-create-online-store-nigeria',
    title:       'How to Create an Online Store in Nigeria in 10 Minutes',
    description: 'A step-by-step guide to launching your Nigerian online store — no coding, no design skills, no stress. From zero to first sale.',
    category:    'Getting Started',
    readTime:    '5 min read',
    date:        'June 2026',
    keywords:    ['create online store nigeria','sell online nigeria','nigerian ecommerce','online business nigeria 2026'],
    featured:    false,
  },
  {
    slug:        'best-niches-nigeria-2026',
    title:       'The 10 Most Profitable Niches to Sell Online in Nigeria (2026)',
    description: 'Data-backed breakdown of the highest demand niches in Nigeria right now — with supplier suggestions, margin estimates and how to get started on QAFRICA.',
    category:    'Strategy',
    readTime:    '7 min read',
    date:        'June 2026',
    keywords:    ['best niches nigeria','profitable products nigeria','what to sell online nigeria','niche selection nigeria'],
    featured:    false,
  },
];

export const getFeatured  = ()           => posts.filter(p => p.featured);
export const getBySlug    = (slug: string) => posts.find(p => p.slug === slug);
export const getRelated   = (slug: string, category: string) =>
  posts.filter(p => p.slug !== slug && p.category === category).slice(0, 2);
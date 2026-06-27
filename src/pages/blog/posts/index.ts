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
    keywords:    [
      'what sells on jumia','best products jumia nigeria','jumia top sellers 2026',
      'sell on jumia without stock','how to sell on jumia','jumia seller nigeria',
      'jumia marketplace tips','start selling jumia 2026','jumia product research',
    ],
    featured:    true,
  },
  {
    slug:        'how-to-sell-on-jumia-without-getting-banned',
    title:       'How to Sell on Jumia Without Getting Banned (The Quality Control Secret)',
    description: "Jumia bans thousands of sellers every month for quality violations. Here's exactly how to stay safe — and how QAFRICA's 2-layer QC does it for you automatically.",
    category:    'Jumia',
    readTime:    '7 min read',
    date:        'June 2026',
    keywords:    [
      'jumia seller banned','jumia quality control','how to sell on jumia safely',
      'jumia vendor tips nigeria','jumia account suspended','jumia seller requirements',
      'avoid jumia ban','sell on konga nigeria','konga seller guide',
    ],
    featured:    true,
  },
  {
    slug:        'dropshipping-from-china-to-nigeria',
    title:       'Dropshipping from China to Nigeria in 2026 — The Complete Guide',
    description: 'Source products from China, sell them on Jumia, Konga and Jiji without ever seeing them. QAFRICA handles sourcing, quality checks, warehousing and fulfilment.',
    category:    'Dropshipping',
    readTime:    '8 min read',
    date:        'June 2026',
    keywords:    [
      'dropshipping china nigeria','source products china nigeria','import from china nigeria',
      'dropshipping nigeria 2026','1688 nigeria','how to import from china','china to nigeria shipping',
      'alibaba nigeria seller','dropship to jumia','dropship to konga',
    ],
    featured:    true,
  },
  {
    slug:        'how-to-create-online-store-nigeria',
    title:       'How to Create an Online Store in Nigeria in 10 Minutes',
    description: 'A step-by-step guide to launching your Nigerian online store — no coding, no design skills, no stress. From zero to first sale, with built-in B2B dropship income.',
    category:    'Getting Started',
    readTime:    '5 min read',
    date:        'June 2026',
    keywords:    [
      'create online store nigeria','sell online nigeria','nigerian ecommerce',
      'online business nigeria 2026','how to start ecommerce nigeria','sell on jumia konga jiji',
      'online store payment gateway nigeria','ecommerce website nigeria','paystack store nigeria',
      'start online business nigeria no capital',
    ],
    featured:    false,
  },
  {
    slug:        'best-niches-nigeria-2026',
    title:       'The 10 Most Profitable Niches to Sell Online in Nigeria (2026)',
    description: 'Data-backed breakdown of the highest demand niches in Nigeria right now — with supplier suggestions, margin estimates and how to get started on QAFRICA.',
    category:    'Strategy',
    readTime:    '7 min read',
    date:        'June 2026',
    keywords:    [
      'best niches nigeria','profitable products nigeria','what to sell online nigeria',
      'niche selection nigeria','jumia best selling categories','konga top products',
      'online business ideas nigeria','jiji selling tips','most profitable online business nigeria 2026',
    ],
    featured:    false,
  },
  {
    slug:        'sell-on-jumia-konga-jiji-nigeria',
    title:       'How to Sell on Jumia, Konga and Jiji at the Same Time (Without Extra Work)',
    description: 'List once on QAFRICA and push your products to Jumia, Konga and Jiji automatically. No duplicate work, no separate accounts needed.',
    category:    'Marketplace',
    readTime:    '5 min read',
    date:        'June 2026',
    keywords:    [
      'sell on jumia konga jiji','list products multiple marketplaces nigeria',
      'jumia konga jiji seller','marketplace nigeria 2026','how to sell on konga',
      'how to sell on jiji','multi-channel selling nigeria','jumia seller account nigeria',
    ],
    featured:    false,
  },
  {
    slug:        'import-products-from-china-nigeria',
    title:       'How to Import Products from China to Nigeria Without a Freight Agent',
    description: 'QAFRICA handles sourcing, quality control, warehousing and customs. You pick products from our catalog or send screenshots from 1688 — we handle everything else.',
    category:    'Importation',
    readTime:    '6 min read',
    date:        'June 2026',
    keywords:    [
      'import from china nigeria','china to nigeria shipping','importation business nigeria',
      'source products china nigeria 2026','1688 app nigeria','how to buy from 1688 nigeria',
      'alibaba to nigeria','clearing agent nigeria','import duty nigeria',
    ],
    featured:    false,
  },
];

export const getFeatured  = ()              => posts.filter(p => p.featured);
export const getBySlug    = (slug: string)  => posts.find(p => p.slug === slug);
export const getRelated   = (slug: string, category: string) =>
  posts.filter(p => p.slug !== slug && p.category === category).slice(0, 2);

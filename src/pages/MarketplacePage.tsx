// src/pages/MarketplacePage.tsx

import { Helmet } from 'react-helmet-async';

import MarketplaceHero        from './Marketplace/MarketplaceHero';
import MarketplaceCalculator  from './Marketplace/MarketplaceCalculator';
import WhatSellsBest          from './Marketplace/WhatSellsBest';
import MarketplaceHowItWorks  from './Marketplace/MarketplaceHowItWorks';
import MarketplaceQC          from './Marketplace/MarketplaceQC';
import PlatformBreakdown      from './Marketplace/PlatformBreakdown';
import MarketplaceFaq         from './Marketplace/MarketplaceFaq';
import MarketplaceCtaBanner   from './Marketplace/MarketplaceCtaBanner';

export default function MarketplacePage() {
  return (
    <>
      <Helmet>
        <title>Sell on Jumia, Konga & Jiji — QAFRICA Marketplace</title>
        <meta
          name="description"
          content="List your products on Jumia, Konga and Jiji simultaneously from one dashboard. QAFRICA handles QC, warehousing and fulfilment. Start selling on Nigeria's top marketplaces today."
        />
        <meta
          name="keywords"
          content="sell on jumia nigeria, sell on konga nigeria, sell on jiji nigeria, jumia seller registration, konga vendor nigeria, how to sell on jumia, jumia seller fees, nigerian marketplace seller, dropshipping nigeria jumia"
        />
        <link rel="canonical" href="https://qafrica.store/marketplaces" />
        <meta property="og:title"       content="Sell on Jumia, Konga & Jiji — QAFRICA" />
        <meta property="og:description" content="Post once. Sell on Jumia, Konga and Jiji automatically. QAFRICA handles QC, listing and fulfilment." />
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content="https://qafrica.store/marketplaces" />
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:title"       content="Sell on Jumia, Konga & Jiji — QAFRICA" />
        <meta name="twitter:description" content="Post once. Sell on Jumia, Konga and Jiji automatically." />
        <script type="application/ld+json">{JSON.stringify({
          '@context':   'https://schema.org',
          '@type':      'WebPage',
          'name':       'QAFRICA Marketplace — Sell on Jumia, Konga & Jiji',
          'description':'List products on Jumia, Konga and Jiji simultaneously from one QAFRICA dashboard.',
          'url':        'https://qafrica.store/marketplaces',
          'publisher':  {
            '@type': 'Organization',
            'name':  'QAFRICA',
            'url':   'https://qafrica.store',
          },
          'mainEntity': {
            '@type': 'FAQPage',
            'mainEntity': [
              {
                '@type':          'Question',
                'name':           'How do I start selling on Jumia in Nigeria?',
                'acceptedAnswer': {
                  '@type': 'Answer',
                  'text':  'Register as a Jumia vendor, submit business documents and list products. With QAFRICA, we handle listing, QC and fulfilment — you just pick products and set your price.',
                },
              },
              {
                '@type':          'Question',
                'name':           'How much does Jumia charge sellers in Nigeria?',
                'acceptedAnswer': {
                  '@type': 'Answer',
                  'text':  'Jumia charges approximately 12% commission, plus 7.5% VAT and logistics costs — around 20% total deductions from your selling price.',
                },
              },
              {
                '@type':          'Question',
                'name':           'Can I sell on Jumia without my own products?',
                'acceptedAnswer': {
                  '@type': 'Answer',
                  'text':  'Yes — through dropshipping via QAFRICA. Select products from our catalog, set your price, and we list and fulfil orders for you.',
                },
              },
              {
                '@type':          'Question',
                'name':           'How do I sell on Konga Nigeria?',
                'acceptedAnswer': {
                  '@type': 'Answer',
                  'text':  'QAFRICA lists your products on Konga simultaneously with Jumia and Jiji from one dashboard with one upload.',
                },
              },
            ],
          },
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-white dark:bg-gray-950">
        <MarketplaceHero />
        <MarketplaceCalculator />
        <WhatSellsBest />
        <MarketplaceHowItWorks />
        <MarketplaceQC />
        <PlatformBreakdown />
        <MarketplaceFaq />
        <MarketplaceCtaBanner />
      </div>
    </>
  );
}
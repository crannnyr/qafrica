import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'product' | 'article';
  keywords?: string[];
  author?: string;
  twitterHandle?: string;
  noindex?: boolean;
}

export default function SEO({
  title,
  description = 'QAFRICA - Nigeria\'s premier e-commerce platform builder. Create your online store in minutes.',
  image = 'https://bahiqhpypapvktpxrths.supabase.co/storage/v1/object/public/review-images/1000131377%20(1).png',
  url = typeof window !== 'undefined' ? window.location.href : 'https://qafrica.store',
  type = 'website',
  keywords = ['e-commerce', 'Nigeria', 'online store', 'sell online', 'QAFRICA'],
  author = 'QAFRICA',
  twitterHandle = '@qafrica',
  noindex = false,
}: SEOProps) {
  const fullTitle = title.includes('QAFRICA') ? title : `${title} | QAFRICA`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords.join(', ')} />
      <meta name="author" content={author} />
      
      {/* Robots */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow" />
      )}
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="QAFRICA" />
      <meta property="og:locale" content="en_NG" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:creator" content={twitterHandle} />
      <meta name="twitter:site" content={twitterHandle} />
      
      {/* Additional Meta */}
      <meta name="theme-color" content="#F97316" />
      <meta name="msapplication-TileColor" content="#F97316" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="QAFRICA" />
      
      {/* Geo Tags */}
      <meta name="geo.region" content="NG" />
      <meta name="geo.placename" content="Nigeria" />
    </Helmet>
  );
}

// Store-specific SEO
export function StoreSEO({
  storeName,
  storeDescription,
  storeLogo,
  storeUrl,
  productName,
  productImage,
  isProduct = false,
}: {
  storeName: string;
  storeDescription?: string;
  storeLogo?: string;
  storeUrl: string;
  productName?: string;
  productImage?: string;
  productPrice?: number;
  isProduct?: boolean;
}) {
  const title = isProduct && productName 
    ? `${productName} - ${storeName}` 
    : `${storeName} - Online Store`;
  
  const description = storeDescription || `Shop at ${storeName} on QAFRICA`;
  const image = productImage || storeLogo || 'https://bahiqhpypapvktpxrths.supabase.co/storage/v1/object/public/review-images/1000131377%20(1).png';

  return (
    <SEO
      title={title}
      description={description}
      image={image}
      url={storeUrl}
      type={isProduct ? 'product' : 'website'}
      keywords={[storeName, 'online store', 'Nigeria', 'shop online', 'QAFRICA']}
    />
  );
}

// Product Schema for structured data
export function ProductSchema({
  name,
  description,
  image,
  price,
  currency = 'NGN',
  availability = 'InStock',
  brand,
  sku,
  url,
}: {
  name: string;
  description: string;
  image: string;
  price: number;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  brand?: string;
  sku?: string;
  url: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    image,
    sku,
    brand: {
      '@type': 'Brand',
      name: brand || 'QAFRICA Store',
    },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: currency,
      price: price.toString(),
      availability: `https://schema.org/${availability}`,
      seller: {
        '@type': 'Organization',
        name: brand || 'QAFRICA Store',
      },
    },
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
}

// Organization Schema
export function OrganizationSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'QAFRICA',
    url: 'https://qafrica.store',
    logo: 'https://bahiqhpypapvktpxrths.supabase.co/storage/v1/object/public/review-images/1000131377%20(1).png',
    description: 'Nigeria\'s premier e-commerce platform builder',
    sameAs: [
      'https://twitter.com/qafrica',
      'https://facebook.com/qafrica',
      'https://instagram.com/qafrica',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+234-800-QAFRICA',
      contactType: 'customer support',
      areaServed: 'NG',
      availableLanguage: ['English'],
    },
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(schema)}
      </script>
    </Helmet>
  );
}
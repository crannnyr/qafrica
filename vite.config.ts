import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import sitemap from 'vite-plugin-sitemap'
import mdx from '@mdx-js/rollup'

export default defineConfig({
  base: '/',
  plugins: [
    mdx({
      providerImportSource: '@mdx-js/react',
    }),
    react({
      include: /\.(jsx|js|mdx|md|tsx|ts)$/,
    }),
    sitemap({
      hostname: 'https://qafrica.store',
      // Product pages are listed in a second, always-current sitemap served by
      // netlify/edge-functions/import-sitemap.ts; this adds it to robots.txt.
      externalSitemaps: ['https://qafrica.store/sitemap-products.xml'],
      // robots.txt is generated from here on every build (the old robots.txt in
      // the repo root was never deployed), so this is the single source of truth.
      robots: [
        {
          userAgent: '*',
          allow: ['/', '/blog', '/marketplace', '/recommendations', '/stores', '/pricing'],
          disallow: ['/dashboard', '/admin', '/developer/dashboard', '/payment', '/customer/dashboard'],
        },
      ],
      dynamicRoutes: [
        '/',
        '/stores',
        '/login',
        '/signup',
        '/pricing',
        '/marketplaces',
        '/recommendations',
        '/blog',
        '/blog/what-sells-best-on-jumia-2026',
        '/blog/how-to-sell-on-jumia-without-getting-banned',
        '/blog/dropshipping-from-china-to-nigeria',
        '/blog/how-to-create-online-store-nigeria',
        '/blog/best-niches-nigeria-2026',
        '/blog/sell-on-jumia-konga-jiji-nigeria',
        '/blog/import-products-from-china-nigeria',
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import sitemap from 'vite-plugin-sitemap'
import mdx from '@mdx-js/rollup'

export default defineConfig({
  base: '/',
  plugins: [
    // MDX must come before react()
    mdx({
      providerImportSource: '@mdx-js/react',
    }),
    react({
      include: /\.(jsx|js|mdx|md|tsx|ts)$/,
    }),
    sitemap({
      hostname: 'https://qafrica.store',
      dynamicRoutes: [
        '/',
        '/stores',
        '/login',
        '/signup',
        '/pricing',
        '/blog',
        '/blog/what-sells-best-on-jumia-2026',
        '/blog/how-to-sell-on-jumia-without-getting-banned',
        '/blog/dropshipping-from-china-to-nigeria',
        '/blog/how-to-create-online-store-nigeria',
        '/blog/best-niches-nigeria-2026',
        '/marketplace',
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
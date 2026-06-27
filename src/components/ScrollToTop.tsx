// src/components/ScrollToTop.tsx
// Drop this inside your router, above all <Route> definitions.
// It fires on every pathname change and snaps the window back to y=0.

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

// ── Usage ─────────────────────────────────────────────────────────────────────
// In your root router file (e.g. App.tsx):
//
// import ScrollToTop from '@/components/ScrollToTop';
//
// <BrowserRouter>          (or <Router>)
//   <ScrollToTop />        ← add this line, nothing else needed
//   <Routes>
//     <Route path="/blog"        element={<BlogIndexPage />} />
//     <Route path="/blog/:slug"  element={<BlogPostPage />} />
//     …
//   </Routes>
// </BrowserRouter>

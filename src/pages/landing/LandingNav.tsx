// src/pages/landing/Landing/LandingNav.tsx

import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ShoppingBag, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DarkModeToggle from '@/components/DarkModeToggle';

interface Props {
  isScrolled:         boolean;
  isMobileMenuOpen:   boolean;
  logoBoxVisible:     boolean;
  navLogoBoxRef:      React.RefObject<HTMLDivElement | null>;
  onToggleMobileMenu: () => void;
  onScrollToSection:  (id: string) => void;
}

export default function LandingNav({
  isScrolled,
  isMobileMenuOpen,
  logoBoxVisible,
  navLogoBoxRef,
  onToggleMobileMenu,
  onScrollToSection,
}: Props) {
  const [exploreOpen, setExploreOpen] = useState(false);
  const [loginOpen, setLoginOpen]     = useState(false);
  const exploreRef = useRef<HTMLDivElement>(null);
  const loginRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (exploreRef.current && !exploreRef.current.contains(e.target as Node)) setExploreOpen(false);
      if (loginRef.current && !loginRef.current.contains(e.target as Node)) setLoginOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled
        ? 'bg-white/95 dark:bg-gray-950/95 backdrop-blur-lg shadow-sm'
        : 'bg-transparent'
    }`}>
      <div className="container-custom">
        <div className="flex items-center justify-between h-16 lg:h-20">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <motion.div
              ref={navLogoBoxRef}
              animate={{ opacity: logoBoxVisible ? 1 : 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center"
            >
              <ShoppingBag className="w-6 h-6 text-white" />
            </motion.div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              QAFRICA
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden lg:flex items-center gap-7">
            <Link
              to="/stores"
              className="text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors text-sm"
            >
              Browse Stores
            </Link>
            <button
              onClick={() => onScrollToSection('features')}
              className="text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors text-sm"
            >
              Features
            </button>
            <button
              onClick={() => onScrollToSection('pricing')}
              className="text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors text-sm"
            >
              Pricing
            </button>
            <button
              onClick={() => onScrollToSection('faq')}
              className="text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors text-sm"
            >
              FAQ
            </button>
            <Link
              to="/blog"
              className="text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors text-sm"
            >
              Blog
            </Link>

            {/* Explore: China Importation + Marketplaces, grouped so the nav
                row doesn't have to carry both as separate top-level items */}
            <div className="relative" ref={exploreRef}>
              <button
                onClick={() => setExploreOpen(o => !o)}
                className="flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors text-sm"
              >
                Explore
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${exploreOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {exploreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0  }}
                    exit={{   opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-56 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-lg shadow-black/5 p-1.5"
                  >
                    <Link
                      to="/importations"
                      onClick={() => setExploreOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-orange-600 transition-colors"
                    >
                      🇨🇳 China Importation
                    </Link>
                    <Link
                      to="/marketplaces"
                      onClick={() => setExploreOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-orange-600 transition-colors"
                    >
                      🏪 Jumia · Konga · Jiji
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            <DarkModeToggle />

            {/* Log In: Seller vs Shopper grouped under one trigger instead
                of two separate ghost buttons competing for space */}
            <div className="relative" ref={loginRef}>
              <button
                onClick={() => setLoginOpen(o => !o)}
                className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors px-3 py-2"
              >
                Log In
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${loginOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {loginOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0  }}
                    exit={{   opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-lg shadow-black/5 p-1.5"
                  >
                    <Link
                      to="/login"
                      onClick={() => setLoginOpen(false)}
                      className="block px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-orange-600 transition-colors"
                    >
                      Seller Sign In
                    </Link>
                    <Link
                      to="/customer/login"
                      onClick={() => setLoginOpen(false)}
                      className="block px-3 py-2.5 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-orange-600 transition-colors"
                    >
                      Shopper Login
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Link to="/signup">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                Start Your Store
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden p-2"
            onClick={onToggleMobileMenu}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen
              ? <X    className="w-6 h-6 text-gray-900 dark:text-white" />
              : <Menu className="w-6 h-6 text-gray-900 dark:text-white" />
            }
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0  }}
            exit={{   opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-800 shadow-lg"
          >
            <div className="container-custom py-4 space-y-1">
              <Link
                to="/stores"
                onClick={onToggleMobileMenu}
                className="block py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm"
              >
                Browse Stores
              </Link>
              <button
                onClick={() => onScrollToSection('features')}
                className="block w-full text-left py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm"
              >
                Features
              </button>
              <button
                onClick={() => onScrollToSection('pricing')}
                className="block w-full text-left py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm"
              >
                Pricing
              </button>
              <button
                onClick={() => onScrollToSection('faq')}
                className="block w-full text-left py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm"
              >
                FAQ
              </button>
              <Link
                to="/blog"
                onClick={onToggleMobileMenu}
                className="block py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm"
              >
                Blog
              </Link>

              <p className="pt-3 pb-1 px-3 text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">Explore</p>
              <Link
                to="/importations"
                onClick={onToggleMobileMenu}
                className="block py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm"
              >
                🇨🇳 China Importation
              </Link>
              <Link
                to="/marketplaces"
                onClick={onToggleMobileMenu}
                className="block py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm"
              >
                🏪 Jumia · Konga · Jiji
              </Link>

              <hr className="border-gray-100 dark:border-gray-800 my-2" />

              <p className="pb-1 px-3 text-[10px] font-bold text-gray-300 dark:text-gray-600 uppercase tracking-widest">Log in</p>
              <Link
                to="/login"
                onClick={onToggleMobileMenu}
                className="block py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm"
              >
                Seller Sign In
              </Link>
              <Link
                to="/customer/login"
                onClick={onToggleMobileMenu}
                className="block py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm"
              >
                Shopper Login
              </Link>
              <Link to="/signup" onClick={onToggleMobileMenu}>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white mt-2">
                  Start Your Store
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// src/pages/landing/Landing/LandingNav.tsx

import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ShoppingBag } from 'lucide-react';
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
          <div className="hidden lg:flex items-center gap-8">
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

            {/* NEW: China Importation */}
            <Link
              to="/importations"
              className="text-gray-600 dark:text-gray-300 hover:text-orange-600 transition-colors text-sm flex items-center gap-1"
            >
              🇨🇳 China Importation
            </Link>

            {/* NEW: Marketplaces — colourful to grab attention */}
            <Link
              to="/marketplaces"
              className="text-sm font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 text-white transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #FF6600, #C8202F)' }}
            >
              Jumia · Konga · Jiji
            </Link>
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-4">
            <DarkModeToggle />
            <Link to="/login">
              <Button
                variant="ghost"
                className="text-gray-600 dark:text-gray-300 hover:text-orange-600"
              >
                Sign In
              </Button>
            </Link>
            <Link to="/customer/login">
              <Button
                variant="ghost"
                className="text-gray-600 dark:text-gray-300 hover:text-orange-600"
              >
                Shopper Login
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                Start Free Trial
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

              {/* NEW: China Importation */}
              <Link
                to="/importations"
                onClick={onToggleMobileMenu}
                className="block py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm"
              >
                🇨🇳 China Importation
              </Link>

              {/* NEW: Marketplaces */}
              <Link
                to="/marketplaces"
                onClick={onToggleMobileMenu}
                className="block py-2.5 px-3 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #FF6600, #C8202F)' }}
              >
                🏪 Jumia · Konga · Jiji
              </Link>

              <hr className="border-gray-100 dark:border-gray-800 my-2" />

              <Link
                to="/login"
                onClick={onToggleMobileMenu}
                className="block py-2.5 px-3 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm"
              >
                Sign In
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
                  Start Free Trial
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

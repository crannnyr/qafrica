// src/pages/landing/LandingPage.tsx

import { useState, useEffect, useRef } from 'react';
import SEO, { OrganizationSchema } from '@/components/SEO';

import { FlyingLogo }          from './animations';
import LandingNav              from './LandingNav';
import HeroSection             from './HeroSection';
import StatsSection            from './StatsSection';
import FeaturesSection         from './FeaturesSection';
import NichesSection           from './NichesSection';
import HowItWorksSection       from './HowItWorksSection';
import PricingSection          from './PricingSection';
import TestimonialsSection     from './TestimonialsSection';
import FaqSection              from './FaqSection';
import CtaSection              from './CtaSection';
import FooterSection           from './FooterSection';

export default function LandingPage() {
  // ── Nav state ──────────────────────────────────────────────────────────────
  const [isScrolled, setIsScrolled]             = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ── Animation state ────────────────────────────────────────────────────────
  const navLogoBoxRef                           = useRef<HTMLDivElement>(null);
  const sellRef                                 = useRef<HTMLSpanElement>(null);
  const anythingRef                             = useRef<HTMLSpanElement>(null);

  const [animRects, setAnimRects]               = useState<{
    start: DOMRect; sell: DOMRect; any: DOMRect;
  } | null>(null);
  const [animDone, setAnimDone]                 = useState(false);
  const [logoBoxVisible, setLogoBoxVisible]     = useState(false);
  const [sellNudge, setSellNudge]               = useState(false);
  const [anyNudge, setAnyNudge]                 = useState(false);

  // ── Scroll handler ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Capture rects for animation ────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => {
      if (
        !navLogoBoxRef.current ||
        !sellRef.current       ||
        !anythingRef.current
      ) return;

      setAnimRects({
        start: navLogoBoxRef.current.getBoundingClientRect(),
        sell:  sellRef.current.getBoundingClientRect(),
        any:   anythingRef.current.getBoundingClientRect(),
      });
    }, 400);
    return () => clearTimeout(id);
  }, []);

  // ── Mobile menu toggle ─────────────────────────────────────────────────────
  const handleToggleMobileMenu = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  // ── Animation callbacks ────────────────────────────────────────────────────
  const handleAnimComplete = () => {
    setAnimDone(true);
    setLogoBoxVisible(true);
  };

  // ── Scroll to section ──────────────────────────────────────────────────────
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      {/* Flying logo animation */}
      {animRects && !animDone && (
        <FlyingLogo
          startRect={animRects.start}
          sellRect={animRects.sell}
          anyRect={animRects.any}
          onComplete={handleAnimComplete}
          onSellHit={() => setSellNudge(true)}
          onAnyHit={()  => setAnyNudge(true)}
          isPaused={isMobileMenuOpen}
        />
      )}

      <SEO
        title="QAFRICA — Build & Grow Your Online Store in Nigeria"
        description="QAFRICA is Nigeria's leading e-commerce platform. Create a beautiful online store in minutes, import products, manage orders, and accept secure payments. Built for Nigerian entrepreneurs."
        keywords={[
          'Nigerian e-commerce platform',
          'online store Nigeria',
          'sell online Nigeria',
          'create online store Nigeria',
          'Nigerian marketplace',
          'Naira payment online store',
          'e-commerce Lagos',
          'QAFRICA',
          'dropshipping Nigeria',
          'Nigerian online business',
          'sell on Jumia Nigeria',
          'sell on Konga Nigeria',
        ]}
        url="https://qafrica.store"
        type="website"
      />
      <OrganizationSchema />

      <LandingNav
        isScrolled={isScrolled}
        isMobileMenuOpen={isMobileMenuOpen}
        logoBoxVisible={logoBoxVisible}
        navLogoBoxRef={navLogoBoxRef}
        onToggleMobileMenu={handleToggleMobileMenu}
        onScrollToSection={scrollToSection}
      />

      <HeroSection
        sellRef={sellRef}
        anythingRef={anythingRef}
        sellNudge={sellNudge}
        anyNudge={anyNudge}
      />

      <StatsSection />
      <FeaturesSection />
      <NichesSection />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />

      <FooterSection onScrollToSection={scrollToSection} />

    </div>
  );
}

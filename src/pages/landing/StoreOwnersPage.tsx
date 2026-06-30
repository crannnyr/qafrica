// src/pages/landing/StoreOwnersPage.tsx

import { useState, useEffect, useRef } from 'react';
import SEO, { OrganizationSchema } from '@/components/SEO';

import LandingNav          from './LandingNav';
import StoreOwnerHeroSection from './StoreOwnerHeroSection';
import StatsSection        from './StatsSection';
import FeaturesSection     from './FeaturesSection';
import HowItWorksSection   from './HowItWorksSection';
import PricingSection      from './PricingSection';
import TestimonialsSection from './TestimonialsSection';
import FaqSection          from './FaqSection';
import CtaSection          from './CtaSection';
import FooterSection       from './FooterSection';

export default function StoreOwnersPage() {
  const [isScrolled, setIsScrolled]             = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navLogoBoxRef                           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleToggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">

      <SEO
        title="QAFRICA — Get a Website & Build Your Seller Network"
        description="Own your store for ₦5,000/month. Let dropshippers sell your products for you. Connect your group chat, share promo content, and push to Jumia, Konga & Jiji — all on QAFRICA."
        keywords={[
          'online store Nigeria',
          'store owner Nigeria',
          'get a website Nigeria',
          'dropshipping Nigeria',
          'manage dropshippers',
          'sell on Jumia Nigeria',
          'sell on Konga Nigeria',
          'sell on Jiji Nigeria',
          'QAFRICA store owners',
          'Nigerian e-commerce platform',
        ]}
        url="https://qafrica.store/store-owners"
        type="website"
      />
      <OrganizationSchema />

      <LandingNav
        isScrolled={isScrolled}
        isMobileMenuOpen={isMobileMenuOpen}
        logoBoxVisible={true}
        navLogoBoxRef={navLogoBoxRef}
        onToggleMobileMenu={handleToggleMobileMenu}
        onScrollToSection={scrollToSection}
      />

      <StoreOwnerHeroSection />

      <StatsSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />

      <FooterSection onScrollToSection={scrollToSection} />

    </div>
  );
}

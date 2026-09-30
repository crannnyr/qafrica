// src/pages/landing/LandingPage.tsx

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO, { OrganizationSchema } from '@/components/SEO';
import QbotGuide from '@/components/QbotGuide';

import { FlyingLogo } from './animations';
import LandingNav from './LandingNav';
import HeroSection from './HeroSection';
import StatsSection from './StatsSection';
import FeaturesSection from './FeaturesSection';
import NichesSection from './NichesSection';
import HowItWorksSection from './HowItWorksSection';
import PricingSection from './PricingSection';
import TestimonialsSection from './TestimonialsSection';
import FaqSection from './FaqSection';
import CtaSection from './CtaSection';
import FooterSection from './FooterSection';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navLogoBoxRef = useRef<HTMLDivElement>(null);
  const sellRef = useRef<HTMLSpanElement>(null);
  const anythingRef = useRef<HTMLSpanElement>(null);
  const [animRects, setAnimRects] = useState<{ start: DOMRect; sell: DOMRect; any: DOMRect } | null>(null);
  const [animDone, setAnimDone] = useState(false);
  const [logoBoxVisible, setLogoBoxVisible] = useState(false);
  const [sellNudge, setSellNudge] = useState(false);
  const [anyNudge, setAnyNudge] = useState(false);
  useEffect(() => { const handleScroll = () => setIsScrolled(window.scrollY > 50); window.addEventListener('scroll', handleScroll, { passive: true }); return () => window.removeEventListener('scroll', handleScroll); }, []);
  useEffect(() => { const id = setTimeout(() => { if (!navLogoBoxRef.current || !sellRef.current || !anythingRef.current) return; setAnimRects({ start: navLogoBoxRef.current.getBoundingClientRect(), sell: sellRef.current.getBoundingClientRect(), any: anythingRef.current.getBoundingClientRect() }); }, 400); return () => clearTimeout(id); }, []);
  const handleToggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);
  const handleAnimComplete = () => { setAnimDone(true); setLogoBoxVisible(true); };
  const scrollToSection = (id: string) => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setIsMobileMenuOpen(false); };
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {animRects && !animDone && <FlyingLogo startRect={animRects.start} sellRect={animRects.sell} anyRect={animRects.any} onComplete={handleAnimComplete} onSellHit={() => setSellNudge(true)} onAnyHit={() => setAnyNudge(true)} isPaused={isMobileMenuOpen} />}
      <SEO title="QAFRICA — Build & Grow Your Online Store in Nigeria" description="QAFRICA is Nigeria's leading e-commerce platform. Create a beautiful online store in minutes, import products, manage orders, and accept secure payments. Built for Nigerian entrepreneurs." keywords={['Nigerian e-commerce platform','online store Nigeria','sell online Nigeria','create online store Nigeria','Nigerian marketplace','Naira payment online store','e-commerce Lagos','QAFRICA','dropshipping Nigeria','Nigerian online business','sell on Jumia Nigeria','sell on Konga Nigeria']} url="https://qafrica.store" type="website" />
      <OrganizationSchema />
      <LandingNav isScrolled={isScrolled} isMobileMenuOpen={isMobileMenuOpen} logoBoxVisible={logoBoxVisible} navLogoBoxRef={navLogoBoxRef} onToggleMobileMenu={handleToggleMobileMenu} onScrollToSection={scrollToSection} />
      <HeroSection sellRef={sellRef} anythingRef={anythingRef} sellNudge={sellNudge} anyNudge={anyNudge} />
      <StatsSection /><FeaturesSection /><NichesSection /><HowItWorksSection /><PricingSection /><TestimonialsSection /><FaqSection /><CtaSection />
      <FooterSection onScrollToSection={scrollToSection} />
      {animDone && <QbotGuide stepId="home-intro" message="Hi, I'm Qbot — connect me to your ChatGPT. I'm not just an AI, I'm also your business analyst. Storefront, dropshipping, or reselling vendors and direct China products: I'll show you what works, you connect your social media, and I'll check in weekly to keep you profitable. QAFRICA never leaves you behind — quickly sign up now, I can't wait to show you all I can do." ctaLabel="Start Your Store" onCta={() => navigate('/signup')} position="center" imageSrc="https://dpioixansygkjdbphfdj.supabase.co/storage/v1/object/public/product-images/0.060143133080175715.webp" imageSize="lg" />}
    </div>
  );
}

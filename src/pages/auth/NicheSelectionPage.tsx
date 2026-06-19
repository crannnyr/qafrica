// src/pages/auth/NicheSelectionPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Lock } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';

import OnboardingProgress from './NicheSelection/OnboardingProgress';
import NicheGrid from './NicheSelection/NicheGrid';
import FreeTrialCallout from './NicheSelection/FreeTrialCallout';
import NicheSelectionFooter from './NicheSelection/NicheSelectionFooter';

interface Niche {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export default function NicheSelectionPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [niches, setNiches]                 = useState<Niche[]>([]);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [isLoading, setIsLoading]           = useState(true);
  const [isSaving, setIsSaving]             = useState(false);

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchNiches(), resumeProgress()]);
      setIsLoading(false);
    };
    init();
  }, [user]);

  const fetchNiches = async () => {
    const { data, error } = await supabase
      .from('niches')
      .select('id, name, icon, description')
      .eq('is_active', true)
      .order('sort_order');

    if (error) { toast.error('Failed to load niches. Please refresh.'); return; }
    setNiches(data ?? []);
  };

  const resumeProgress = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_data')
      .eq('id', user.id)
      .single();

    const saved = data?.onboarding_data;
    if (saved?.selected_niches?.length) setSelectedNiches(saved.selected_niches);
  };

  const toggleNiche = (nicheId: string) => {
    setSelectedNiches((prev) => {
      if (prev.includes(nicheId)) return prev.filter((id) => id !== nicheId);
      if (prev.length >= 1) {
        toast.error('Free Trial Limit', {
          description: 'Start with 1 niche. Unlock more by upgrading later.',
          icon: <Lock className="w-4 h-4 text-orange-500" />,
        });
        return prev;
      }
      return [...prev, nicheId];
    });
  };

  const handleContinue = async () => {
    if (selectedNiches.length === 0) { toast.error('Please select a niche to continue.'); return; }
    if (!user) { toast.error('Session expired. Please sign in again.'); navigate('/login'); return; }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          onboarding_step: 2,
          onboarding_data: { step: 2, selected_niches: selectedNiches },
        })
        .eq('id', user.id);

      if (error) throw error;
      navigate('/onboarding/store-setup');
    } catch {
      toast.error('Failed to save your selection. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading niches…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 py-8 px-4">
      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">QAFRICA</span>
          </div>
        </div>

        <OnboardingProgress step={2} />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Select Your Niche</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Choose the category that best describes your business. Start with 1 niche
              for your trial — unlock more by upgrading later.
            </p>
          </div>

          {/* Counter */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="text-sm text-gray-500">Selected:</span>
            <span className={`text-sm font-medium ${
              selectedNiches.length > 0 ? 'text-orange-600' : 'text-gray-400'
            }`}>
              {selectedNiches.length} of 1
            </span>
            <span className="text-xs text-gray-400 ml-2">(More available after upgrade)</span>
          </div>

          <NicheGrid
            niches={niches}
            selectedNiches={selectedNiches}
            onToggle={toggleNiche}
          />

          <FreeTrialCallout />

          <NicheSelectionFooter
            isSaving={isSaving}
            hasSelection={selectedNiches.length > 0}
            onBack={() => navigate('/signup')}
            onContinue={handleContinue}
          />
        </motion.div>

        <p className="text-center mt-6 text-gray-500 text-sm">
          Need help choosing?{' '}
          <a href="#" className="text-orange-600 hover:text-orange-700">Contact our support team</a>
        </p>
      </div>
    </div>
  );
}
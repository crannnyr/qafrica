import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShoppingBag, ArrowRight, Check, Lock,
  Shirt, Gem, Smartphone, Sparkles, Home, Dumbbell,
  Utensils, Heart, Car, BookOpen, PawPrint, Palette,
  Briefcase, Wheat, Baby,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Niche {
  id: string;
  name: string;
  icon: string;
  description: string;
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  Shirt, Gem, Smartphone, Sparkles, Home, Dumbbell,
  Utensils, Heart, Car, BookOpen, PawPrint, Palette,
  Briefcase, Wheat, Baby, ShoppingBag,
};

// ── Shared progress bar (used across all onboarding steps) ───────────────────

export function OnboardingProgress({ step }: { step: number }) {
  const steps = ['Account', 'Niche', 'Store', 'Plan'];
  return (
    <div className="flex items-center justify-center gap-2 mb-12">
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isComplete = step > stepNum;
        const isCurrent = step === stepNum;
        return (
          <div key={label} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                isComplete ? 'bg-green-500 text-white' :
                isCurrent  ? 'bg-sky-500 text-white'   :
                              'bg-gray-200 text-gray-500'
              }`}>
                {isComplete ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${
                isComplete ? 'text-green-600' :
                isCurrent  ? 'text-sky-600'   :
                              'text-gray-400'
              }`}>{label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 sm:w-12 h-0.5 mx-2 ${
                step > stepNum ? 'bg-sky-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NicheSelectionPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [niches, setNiches]               = useState<Niche[]>([]);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [isLoading, setIsLoading]         = useState(true);
  const [isSaving, setIsSaving]           = useState(false);

  // ── On mount: fetch niches + resume saved progress ────────────────────────
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

    if (error) {
      toast.error('Failed to load niches. Please refresh.');
      return;
    }
    setNiches(data ?? []);
  };

  // Read onboarding_data from profile to pre-fill saved niche
  const resumeProgress = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_data')
      .eq('id', user.id)
      .single();

    const saved = data?.onboarding_data;
    if (saved?.selected_niches?.length) {
      setSelectedNiches(saved.selected_niches);
    }
  };

  // ── Niche toggle (1 max on free plan) ─────────────────────────────────────
  const toggleNiche = (nicheId: string) => {
    setSelectedNiches((prev) => {
      if (prev.includes(nicheId)) return prev.filter((id) => id !== nicheId);
      if (prev.length >= 1) {
        toast.error('Free Trial Limit', {
          description: 'Start with 1 niche. Unlock more by upgrading later.',
          icon: <Lock className="w-4 h-4 text-sky-500" />,
        });
        return prev;
      }
      return [...prev, nicheId];
    });
  };

  // ── Continue: save progress to Supabase then navigate ─────────────────────
  const handleContinue = async () => {
    if (selectedNiches.length === 0) {
      toast.error('Please select a niche to continue.');
      return;
    }
    if (!user) {
      toast.error('Session expired. Please sign in again.');
      navigate('/login');
      return;
    }

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

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading niches…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-50 py-8 px-4">
      {/* Ambient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-sky-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-sky-300/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-sky-500 rounded-xl flex items-center justify-center">
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

          {/* Selection counter */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="text-sm text-gray-500">Selected:</span>
            <span className={`text-sm font-medium ${
              selectedNiches.length > 0 ? 'text-sky-600' : 'text-gray-400'
            }`}>
              {selectedNiches.length} of 1
            </span>
            <span className="text-xs text-gray-400 ml-2">(More available after upgrade)</span>
          </div>

          {/* Niches grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {niches.map((niche, index) => {
              const Icon      = ICON_MAP[niche.icon] ?? ShoppingBag;
              const isSelected = selectedNiches.includes(niche.id);
              const isLocked   = !isSelected && selectedNiches.length >= 1;

              return (
                <motion.button
                  key={niche.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => toggleNiche(niche.id)}
                  className={`relative p-6 rounded-xl border-2 transition-all duration-300 text-left overflow-hidden ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50 shadow-lg'
                      : isLocked
                        ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                        : 'border-gray-200 hover:border-sky-300 hover:shadow-md bg-white'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-sky-500 rounded-full flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  )}
                  {isLocked && (
                    <div className="absolute top-3 right-3 w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                      <Lock className="w-3 h-3 text-gray-500" />
                    </div>
                  )}
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                    isSelected ? 'bg-sky-500' : isLocked ? 'bg-gray-200' : 'bg-sky-100'
                  }`}>
                    <Icon className={`w-6 h-6 ${
                      isSelected ? 'text-white' : isLocked ? 'text-gray-400' : 'text-sky-600'
                    }`} />
                  </div>
                  <h3 className={`font-semibold mb-1 ${
                    isSelected ? 'text-sky-800' : isLocked ? 'text-gray-400' : 'text-gray-900'
                  }`}>{niche.name}</h3>
                  <p className={`text-sm ${
                    isSelected ? 'text-sky-700' : isLocked ? 'text-gray-400' : 'text-gray-500'
                  }`}>{niche.description}</p>
                </motion.button>
              );
            })}
          </div>

          {/* Free trial callout */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <h4 className="font-semibold text-sky-900 mb-1">Free Trial Available</h4>
                <p className="text-sm text-sky-700">
                  Start with a 4-day free trial on the One Niche plan.
                  Upgrade anytime to access more niches and features.
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/signup')}
              className="text-gray-500 hover:text-gray-700 font-medium"
            >
              ← Back
            </button>
            <Button
              onClick={handleContinue}
              disabled={selectedNiches.length === 0 || isSaving}
              className="bg-sky-500 hover:bg-sky-600 text-white px-8 h-12"
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Continue <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </div>
        </motion.div>

        <p className="text-center mt-6 text-gray-500 text-sm">
          Need help choosing?{' '}
          <a href="#" className="text-sky-600 hover:text-sky-700">Contact our support team</a>
        </p>
      </div>
    </div>
  );
}

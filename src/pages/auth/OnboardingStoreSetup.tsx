// src/pages/auth/OnboardingStoreSetup.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { useAuthStore } from '@/stores';
import { storeService, supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { sendStoreCreatedEmail } from '@/services/email';

import OnboardingProgress from './NicheSelection/OnboardingProgress';
import StoreSubStepIndicator from './StoreSetup/StoreSubStepIndicator';
import StoreBasicInfo from './StoreSetup/StoreBasicInfo';
import StoreThemePicker from './StoreSetup/StoreThemePicker';
import StoreBrandingPicker from './StoreSetup/StoreBrandingPicker';
import StoreNavFooter from './StoreSetup/StoreNavFooter';
import { RESERVED_SLUGS, INITIAL_FORM_DATA } from './StoreSetup/constants';

export default function OnboardingStoreSetup() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [subStep, setSubStep]               = useState(1);
  const [isLoading, setIsLoading]           = useState(true);
  const [isSaving, setIsSaving]             = useState(false);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [formData, setFormData]             = useState(INITIAL_FORM_DATA);

  // ── Resume progress ────────────────────────────────────────────────────────
  useEffect(() => {
    const resume = async () => {
      if (!user) { navigate('/login'); return; }

      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_data, full_name')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        toast.error('Could not load your progress. Please try again.');
        navigate('/select-niche');
        return;
      }

      const saved = data.onboarding_data ?? {};

      if (!saved.selected_niches?.length) { navigate('/select-niche'); return; }
      if (saved.store_id) { navigate('/onboarding/choice'); return; }

      setSelectedNiches(saved.selected_niches);

      const defaultName = data.full_name ? `${data.full_name}'s Store` : '';
      const defaultSlug = defaultName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');

      setFormData((prev) => ({ ...prev, name: defaultName, slug: defaultSlug }));
      setIsLoading(false);
    };

    resume();
  }, [user, navigate]);

  // ── Slug helpers ───────────────────────────────────────────────────────────
  const toSlug = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

  const handleNameChange = (value: string) =>
    setFormData((prev) => ({ ...prev, name: value, slug: toSlug(value) }));

  const handleSlugChange = (value: string) =>
    setFormData((prev) => ({ ...prev, slug: toSlug(value) }));

  // ── Step validation ────────────────────────────────────────────────────────
  const handleNext = () => {
    if (subStep === 1) {
      if (!formData.name.trim()) { toast.error('Please enter a store name.'); return; }
      if (!formData.slug.trim()) { toast.error('Please enter a store URL.');  return; }
      if (RESERVED_SLUGS.has(formData.slug.toLowerCase())) {
        toast.error('That store URL is reserved. Please choose a different one.');
        return;
      }
    }
    setSubStep((s) => s + 1);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!user) { toast.error('Session expired. Please sign in again.'); navigate('/login'); return; }

    setIsSaving(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        session = refreshed.session;
      }
      if (!session) {
        toast.error('Session expired. Please sign in again.');
        navigate('/login');
        return;
      }

      const { data: store, error } = await storeService.createStore({
        owner_id:        user.id,
        name:            formData.name,
        slug:            formData.slug,
        description:     formData.description,
        theme:           formData.theme,
        primary_color:   formData.primary_color,
        secondary_color: formData.secondary_color,
        niches:          selectedNiches,
        is_active:       false,
      });

      if (error) {
        const isDuplicate = error.message?.includes('duplicate') || error.message?.includes('unique');
        if (isDuplicate) {
          toast.error('That store URL is already taken. Please choose a different one.');
          setSubStep(1);
        } else {
          toast.error(error.message || 'Failed to create store. Please try again.');
        }
        return;
      }

      if (!store) throw new Error('No store returned');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_step: 3,
          onboarding_data: {
            step: 3,
            selected_niches: selectedNiches,
            store_id: store.id,
          },
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      sendStoreCreatedEmail(
        user.email,
        user.full_name || 'there',
        store.name,
        store.slug,
      );

      toast.success('Store created! Now choose your plan.');
      navigate('/onboarding/choice');
    } catch (err: any) {
      console.error('Store creation error:', err);
      toast.error(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading your progress…</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 py-8 px-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-300/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-2xl mx-auto relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">QAFRICA</span>
          </div>
        </div>

        <OnboardingProgress step={3} />
        <StoreSubStepIndicator subStep={subStep} />

        <AnimatePresence mode="wait">
          <motion.div
            key={subStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22 }}
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8"
          >
            {subStep === 1 && (
              <StoreBasicInfo
                formData={formData}
                onNameChange={handleNameChange}
                onSlugChange={handleSlugChange}
                onDescriptionChange={(val) =>
                  setFormData((prev) => ({ ...prev, description: val }))
                }
              />
            )}

            {subStep === 2 && (
              <StoreThemePicker
                selectedTheme={formData.theme}
                onSelect={(themeId) =>
                  setFormData((prev) => ({ ...prev, theme: themeId }))
                }
              />
            )}

            {subStep === 3 && (
              <StoreBrandingPicker
                formData={formData}
                onSelectPreset={(primary, secondary) =>
                  setFormData((prev) => ({
                    ...prev,
                    primary_color: primary,
                    secondary_color: secondary,
                  }))
                }
              />
            )}

            <StoreNavFooter
              subStep={subStep}
              isSaving={isSaving}
              onBack={() => subStep === 1 ? navigate('/select-niche') : setSubStep((s) => s - 1)}
              onNext={handleNext}
              onSubmit={handleSubmit}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
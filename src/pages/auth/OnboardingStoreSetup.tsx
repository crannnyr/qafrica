import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ArrowRight, Check, Loader as Loader2, Palette, Type, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores';
import { storeService, supabase } from '@/services/supabase';
import { OnboardingProgress } from './NicheSelectionPage';
import { toast } from 'sonner';
import { sendStoreCreatedEmail } from '@/services/email';

const themes = [
  { id: 'modern',  name: 'Modern',  description: 'Clean and minimalist', color: '#F97316' },
  { id: 'classic', name: 'Classic', description: 'Elegant and timeless', color: '#1F2937' },
  { id: 'vibrant', name: 'Vibrant', description: 'Bold and colorful',    color: '#8B5CF6' },
  { id: 'natural', name: 'Natural', description: 'Organic and earthy',   color: '#10B981' },
];

const colorPresets = [
  { primary: '#F97316', secondary: '#FED7AA', name: 'Orange' },
  { primary: '#3B82F6', secondary: '#BFDBFE', name: 'Blue'   },
  { primary: '#8B5CF6', secondary: '#DDD6FE', name: 'Purple' },
  { primary: '#10B981', secondary: '#A7F3D0', name: 'Green'  },
  { primary: '#EF4444', secondary: '#FECACA', name: 'Red'    },
  { primary: '#1F2937', secondary: '#E5E7EB', name: 'Dark'   },
];

const steps = [
  { number: 1, title: 'Basic Info', icon: Store   },
  { number: 2, title: 'Theme',      icon: Palette },
  { number: 3, title: 'Branding',   icon: Type    },
];

export default function OnboardingStoreSetup() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: sessionStorage.getItem('signup_full_name')
      ? `${sessionStorage.getItem('signup_full_name')}'s Store`
      : '',
    slug: '',
    description: '',
    theme: 'modern',
    primary_color: '#F97316',
    secondary_color: '#FED7AA',
  });

  const handleSlugChange = (value: string) => {
    const slug = value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    setFormData({ ...formData, slug });
  };

  const handleNameChange = (value: string) => {
    // Auto-generate slug from name if slug is empty or was auto-generated
    const slug = value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    setFormData({ ...formData, name: value, slug });
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        toast.error('Please enter a store name');
        return;
      }
      if (!formData.slug.trim()) {
        toast.error('Please enter a store URL');
        return;
      }
      const RESERVED_WORDS = [
        'admin', 'finance', 'api', 'store', 'shop', 'dashboard', 'login',
        'signup', 'register', 'auth', 'payment', 'checkout', 'wallet',
        'support', 'help', 'billing', 'account', 'settings', 'staff',
        'developer', 'dev', 'test', 'demo', 'null', 'undefined', 'qafrica',
        'system', 'internal', 'legal', 'terms', 'privacy', 'about',
      ];
      const slugLower = formData.slug.toLowerCase();
      if (RESERVED_WORDS.includes(slugLower)) {
        toast.error('That store name is reserved. Please choose a different one.');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Session expired. Please sign in again.');
      navigate('/login');
      return;
    }

    const selectedNiches = JSON.parse(sessionStorage.getItem('selected_niches') || '[]');
    if (selectedNiches.length === 0) {
      toast.error('No niche selected. Please go back.');
      navigate('/select-niche');
      return;
    }

    setIsLoading(true);

    try {
      // Verify active session before hitting RLS-protected table
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        session = refreshed.session;
      }
      if (!session) {
        toast.error('Your session expired. Please sign in again.');
        navigate('/login');
        setIsLoading(false);
        return;
      }

      const { data: store, error } = await storeService.createStore({
        owner_id: user.id,
        name: formData.name,
        slug: formData.slug,
        description: formData.description,
        theme: formData.theme,
        primary_color: formData.primary_color,
        secondary_color: formData.secondary_color,
        niches: selectedNiches,
        is_active: false, // activated after plan selection
      });

      if (error) {
        if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
          toast.error('That store URL is already taken. Please choose a different one.');
          setStep(1);
        } else {
          toast.error(error.message || 'Failed to create store. Please try again.');
        }
        setIsLoading(false);
        return;
      }

      if (store) {
        sessionStorage.setItem('onboarding_store_id', store.id);
        toast.success('Store created! Now choose your plan.');
        sendStoreCreatedEmail(user.email, user.full_name || 'there', store.name, store.slug);
        navigate('/onboarding/choice');
      }
    } catch (err) {
      console.error('Store creation error:', err);
      toast.error('Something went wrong. Please try again.');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 py-8 px-4">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
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

        {/* Outer onboarding progress (Account → Niche → Store → Plan) */}
        <OnboardingProgress step={3} />

        {/* Inner store setup sub-steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {steps.map((s, index) => (
            <div key={s.number} className="flex items-center">
              <div className={`flex items-center gap-2 ${step >= s.number ? 'text-orange-600' : 'text-gray-400'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  step > s.number  ? 'bg-green-500 text-white' :
                  step === s.number ? 'bg-orange-500 text-white' :
                                      'bg-gray-200 text-gray-400'
                }`}>
                  {step > s.number ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                </div>
                <span className="hidden sm:block text-sm font-medium">{s.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-8 sm:w-12 h-0.5 mx-3 ${step > s.number ? 'bg-orange-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8"
          >
            {/* Step 1 — Basic Info */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Name Your Store</h2>
                  <p className="text-gray-500">You can always change this later from settings</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Store Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g., Fashion Hub Nigeria"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Store URL *</label>
                  <div className="flex w-full overflow-hidden">
                    <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-200 rounded-l-xl text-gray-500 text-sm whitespace-nowrap shrink-0">
                      qafrica.store/
                    </span>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      className="flex-1 min-w-0 px-4 py-3 border border-gray-200 rounded-r-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="your-store"
                      autoComplete="off"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers, and hyphens</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Store Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[100px] resize-none"
                    placeholder="Tell customers what your store is about..."
                  />
                </div>
              </div>
            )}

            {/* Step 2 — Theme */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose a Theme</h2>
                  <p className="text-gray-500">Pick the style that fits your brand</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setFormData({ ...formData, theme: theme.id })}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        formData.theme === theme.id
                          ? 'border-orange-500 bg-orange-50 shadow-md'
                          : 'border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      <div className="w-full h-20 rounded-lg mb-3" style={{ backgroundColor: theme.color }} />
                      <p className="font-semibold text-gray-900">{theme.name}</p>
                      <p className="text-sm text-gray-500">{theme.description}</p>
                      {formData.theme === theme.id && (
                        <div className="mt-2 flex items-center gap-1 text-orange-600 text-xs font-medium">
                          <Check className="w-3 h-3" /> Selected
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 — Branding */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Choose Your Brand Colors</h2>
                  <p className="text-gray-500">Make your store uniquely yours</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setFormData({
                        ...formData,
                        primary_color: preset.primary,
                        secondary_color: preset.secondary,
                      })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        formData.primary_color === preset.primary
                          ? 'border-orange-500 bg-orange-50 shadow-md'
                          : 'border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      <div className="flex gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full border border-gray-100" style={{ backgroundColor: preset.primary }} />
                        <div className="w-7 h-7 rounded-full border border-gray-100" style={{ backgroundColor: preset.secondary }} />
                      </div>
                      <p className="text-sm font-medium text-gray-900">{preset.name}</p>
                    </button>
                  ))}
                </div>

                {/* Live Preview */}
                <div className="bg-gray-50 rounded-xl p-5">
                  <p className="text-sm font-medium text-gray-600 mb-3">Live Preview</p>
                  <div className="rounded-xl p-5 text-white" style={{ backgroundColor: formData.primary_color }}>
                    <h3 className="text-lg font-bold mb-1">{formData.name || 'Your Store Name'}</h3>
                    <p className="opacity-80 text-sm mb-3">{formData.description || 'Your store tagline'}</p>
                    <button
                      className="px-4 py-2 rounded-lg text-sm font-semibold"
                      style={{ backgroundColor: formData.secondary_color, color: formData.primary_color }}
                    >
                      Shop Now
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              <button
                onClick={() => step === 1 ? navigate('/select-niche') : setStep(step - 1)}
                className="text-gray-500 hover:text-gray-700 font-medium"
                disabled={isLoading}
              >
                ← Back
              </button>

              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 h-11"
                >
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-8 h-11"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Store...
                    </>
                  ) : (
                    <>
                      Create Store
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
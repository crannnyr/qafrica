import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, ArrowRight, Check, Shirt, Gem, Smartphone, Sparkles, Home, Dumbbell, Utensils, Heart, Gamepad, BookOpen, Car, PawPrint, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CONFIG from '@/lib/config';
import { toast } from 'sonner';

const nicheIcons: Record<string, React.ElementType> = {
  clothing: Shirt,
  jewelry: Gem,
  electronics: Smartphone,
  beauty: Sparkles,
  home: Home,
  sports: Dumbbell,
  food: Utensils,
  health: Heart,
  toys: Gamepad,
  books: BookOpen,
  automotive: Car,
  pets: PawPrint,
};

// Shared progress bar used across all onboarding steps
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
                isCurrent  ? 'bg-sky-500 text-white' :
                             'bg-gray-200 text-gray-500'
              }`}>
                {isComplete ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span className={`text-sm font-medium hidden sm:block ${
                isComplete ? 'text-green-600' :
                isCurrent  ? 'text-sky-600' :
                             'text-gray-400'
              }`}>{label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 sm:w-12 h-0.5 mx-2 ${step > stepNum ? 'bg-sky-500' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NicheSelectionPage() {
  const navigate = useNavigate();
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);

  const toggleNiche = (nicheId: string) => {
    setSelectedNiches((prev) => {
      if (prev.includes(nicheId)) {
        return prev.filter((id) => id !== nicheId);
      }
      if (prev.length >= 1) {
        toast.error('Free Trial Limit', {
          description: 'You can only select 1 niche during setup. Unlock more by upgrading later.',
          icon: <Lock className="w-4 h-4 text-sky-500" />,
        });
        return prev;
      }
      return [...prev, nicheId];
    });
  };

  const handleContinue = () => {
    if (selectedNiches.length === 0) {
      toast.error('Please select at least one niche');
      return;
    }
    // Save niche to sessionStorage — store will be created in next step
    sessionStorage.setItem('selected_niches', JSON.stringify(selectedNiches));
    navigate('/onboarding/store-setup');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-sky-50 py-8 px-4">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
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
          transition={{ duration: 0.5 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">Select Your Niche</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Choose the category that best describes your business. Start with 1 niche for your trial —
              unlock unlimited niches by upgrading later.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-8">
            <span className="text-sm text-gray-500">Selected:</span>
            <span className={`text-sm font-medium ${selectedNiches.length > 0 ? 'text-sky-600' : 'text-gray-400'}`}>
              {selectedNiches.length} of 1
            </span>
            <span className="text-xs text-gray-400 ml-2">(More available after upgrade)</span>
          </div>

          {/* Niches Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {CONFIG.NICHES.map((niche, index) => {
              const Icon = nicheIcons[niche.id] || ShoppingBag;
              const isSelected = selectedNiches.includes(niche.id);
              const isLocked = !isSelected && selectedNiches.length >= 1;

              return (
                <motion.button
                  key={niche.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
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

          {/* Info Box */}
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

          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/signup')} className="text-gray-500 hover:text-gray-700 font-medium">
              ← Back
            </button>
            <Button
              onClick={handleContinue}
              className="bg-sky-500 hover:bg-sky-600 text-white px-8 h-12"
              disabled={selectedNiches.length === 0}
            >
              Continue
              <ArrowRight className="w-5 h-5 ml-2" />
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
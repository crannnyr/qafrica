import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, AlertCircle, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore, useAuthStore } from '@/stores';
import { toast } from 'sonner';
import CONFIG from '@/lib/config';
import { STEPS, EMPTY_FORM } from './constants';
import { useDraft } from './hooks/useDraft';
import { useProductForm } from './hooks/useProductForm';
import { StepBar } from './components/StepBar';
import { Step1Basics } from './components/steps/Step1Basics';
import { Step2Images } from './components/steps/Step2Images';
import { Step3Pricing } from './components/steps/Step3Pricing';
import { Step4Variants } from './components/steps/Step4Variants';
import { Step5Shipping } from './components/steps/Step5Shipping';
import { Step6SEO } from './components/steps/Step6SEO';
import type { VariantCombination } from './types';

export default function AddProductPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentStore } = useStoreStore();

  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantCombination[]>([]);

  const allowedNiches = currentStore?.niches || [];
  const isTerminalMode = currentStore?.delivery_mode === 'terminal';

  const { formData, set, hasDraft, clearDraft } = useDraft({ user, setStep, setImages });
  const { isLoading, validateStep, handleSubmit } = useProductForm({
    formData, images, variants, step, setStep, currentStore, user, set,
  });

  useEffect(() => {
    if (allowedNiches.length === 0) {
      toast.error('Please select a niche in your store settings first');
      navigate('/dashboard/niches');
    }
  }, [allowedNiches, navigate]);

  const goNext = () => { if (!validateStep(step)) return; setStep(s => Math.min(s + 1, STEPS.length)); };
  const goBack = () => setStep(s => Math.max(s - 1, 1));

  const stepProps = { formData, set, currentStore, allowedNiches };

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard/products')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Fill in the details across each section</p>
        </div>
        {formData.name && (
          <button type="button" onClick={() => toast.success('Draft saved')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Draft saved</span>
          </button>
        )}
      </div>

      {hasDraft && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Save className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">Draft recovered</p>
              <p className="text-xs text-amber-700">Continuing from where you left off.</p>
            </div>
          </div>
          <button onClick={clearDraft} className="text-xs text-amber-600 hover:text-amber-800 underline whitespace-nowrap">
            Start fresh
          </button>
        </div>
      )}

      {allowedNiches.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Plan: {currentStore?.niches?.length ? 'Active' : 'Loading...'}</p>
            <p className="text-sm text-blue-700 mt-0.5">
              Niches available: {allowedNiches.map(n => CONFIG.NICHES.find((cn: any) => cn.id === n)?.name || n).join(', ')}
            </p>
          </div>
        </div>
      )}

      <StepBar current={step} total={STEPS.length} />

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
          {step === 1 && <Step1Basics {...stepProps} />}
          {step === 2 && <Step2Images images={images} onChange={setImages} />}
          {step === 3 && <Step3Pricing {...stepProps} />}
          {step === 4 && <Step4Variants formData={formData} set={set} variants={variants} setVariants={setVariants} />}
          {step === 5 && <Step5Shipping {...stepProps} isTerminalMode={isTerminalMode} />}
          {step === 6 && <Step6SEO {...stepProps} />}
        </motion.div>
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-4 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <button type="button" onClick={step === 1 ? () => navigate('/dashboard/products') : goBack}
            className="flex items-center gap-2 px-5 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors hover:bg-gray-100 rounded-xl">
            <ArrowLeft className="w-4 h-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          <div className="text-sm text-gray-400">{step} / {STEPS.length}</div>
          {step < STEPS.length ? (
            <button type="button" onClick={goNext}
              className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <Button type="button" onClick={() => handleSubmit(variants)} disabled={isLoading}
              className="flex items-center gap-2 px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl h-12">
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Add Product</>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
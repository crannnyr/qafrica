import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Store, Check, ArrowRight, Loader2, Palette, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore, useStoreStore } from '@/stores';
import { toast } from 'sonner';

const themes = [
  { id: 'modern', name: 'Modern', description: 'Clean and minimalist design', color: '#F97316' },
  { id: 'classic', name: 'Classic', description: 'Elegant and timeless', color: '#1F2937' },
  { id: 'vibrant', name: 'Vibrant', description: 'Bold and colorful', color: '#8B5CF6' },
  { id: 'natural', name: 'Natural', description: 'Organic and earthy', color: '#10B981' },
];

const colorPresets = [
  { primary: '#F97316', secondary: '#FED7AA', name: 'Orange' },
  { primary: '#3B82F6', secondary: '#BFDBFE', name: 'Blue' },
  { primary: '#8B5CF6', secondary: '#DDD6FE', name: 'Purple' },
  { primary: '#10B981', secondary: '#A7F3D0', name: 'Green' },
  { primary: '#EF4444', secondary: '#FECACA', name: 'Red' },
  { primary: '#1F2937', secondary: '#E5E7EB', name: 'Dark' },
];

export default function StoreSetup() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { createStore } = useStoreStore();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    theme: 'modern',
    primary_color: '#F97316',
    secondary_color: '#FED7AA',
  });

  const handleSlugChange = (value: string) => {
    // Convert to lowercase, remove special characters, replace spaces with hyphens
    const slug = value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
    setFormData({ ...formData, slug });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.slug) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    const result = await createStore({
      owner_id: user?.id,
      name: formData.name,
      slug: formData.slug,
      description: formData.description,
      theme: formData.theme,
      primary_color: formData.primary_color,
      secondary_color: formData.secondary_color,
      is_active: true,
    });

    if (result.success) {
      toast.success('Store created successfully!');
      navigate('/dashboard');
    } else {
      toast.error(result.error || 'Failed to create store');
    }

    setIsLoading(false);
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Store Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="input-custom"
          placeholder="e.g., Fashion Hub Nigeria"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Store URL *
        </label>
        <div className="flex">
          <span className="inline-flex items-center px-4 bg-gray-100 border border-r-0 border-gray-200 rounded-l-lg text-gray-500">
            qafrica.store/
          </span>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            className="input-custom rounded-l-none"
            placeholder="your-store"
          />
        </div>
        <p className="text-sm text-gray-500 mt-1">
          This will be your store's unique web address
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Store Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="input-custom min-h-[100px]"
          placeholder="Tell customers what your store is about..."
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-4">
          Choose a Theme
        </label>
        <div className="grid grid-cols-2 gap-4">
          {themes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => setFormData({ ...formData, theme: theme.id })}
              className={`p-4 rounded-xl border-2 transition-all ${
                formData.theme === theme.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              <div 
                className="w-full h-20 rounded-lg mb-3"
                style={{ backgroundColor: theme.color }}
              />
              <p className="font-medium text-gray-900">{theme.name}</p>
              <p className="text-sm text-gray-500">{theme.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-4">
          Choose Your Brand Colors
        </label>
        <div className="grid grid-cols-3 gap-4">
          {colorPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => setFormData({ 
                ...formData, 
                primary_color: preset.primary,
                secondary_color: preset.secondary 
              })}
              className={`p-4 rounded-xl border-2 transition-all ${
                formData.primary_color === preset.primary
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              <div className="flex gap-2 mb-3">
                <div 
                  className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: preset.primary }}
                />
                <div 
                  className="w-8 h-8 rounded-full"
                  style={{ backgroundColor: preset.secondary }}
                />
              </div>
              <p className="font-medium text-gray-900">{preset.name}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-6">
        <p className="text-sm font-medium text-gray-700 mb-4">Preview</p>
        <div 
          className="rounded-xl p-6 text-white"
          style={{ backgroundColor: formData.primary_color }}
        >
          <h3 className="text-xl font-bold mb-2">{formData.name || 'Your Store Name'}</h3>
          <p className="opacity-80">{formData.description || 'Your store description'}</p>
          <button 
            className="mt-4 px-4 py-2 rounded-lg font-medium"
            style={{ backgroundColor: formData.secondary_color, color: formData.primary_color }}
          >
            Shop Now
          </button>
        </div>
      </div>
    </div>
  );

  const steps = [
    { number: 1, title: 'Basic Info', icon: Store },
    { number: 2, title: 'Theme', icon: Palette },
    { number: 3, title: 'Branding', icon: Type },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your Store</h1>
        <p className="text-gray-500">Let's get your store ready for customers</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, index) => (
          <div key={s.number} className="flex items-center">
            <div className={`flex items-center gap-3 ${
              step >= s.number ? 'text-orange-600' : 'text-gray-400'
            }`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step > s.number ? 'bg-green-500 text-white' :
                step === s.number ? 'bg-orange-500 text-white' :
                'bg-gray-200'
              }`}>
                {step > s.number ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
              </div>
              <span className="hidden sm:block font-medium">{s.title}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-4 ${
                step > s.number ? 'bg-orange-500' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Form Card */}
      <motion.div
        key={step}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
      >
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <button
            onClick={() => setStep(step - 1)}
            className={`text-gray-500 hover:text-gray-700 font-medium ${
              step === 1 ? 'invisible' : ''
            }`}
          >
            ← Back
          </button>
          
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Create Store
                  <Check className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

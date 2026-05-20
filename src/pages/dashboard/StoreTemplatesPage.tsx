import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, Check, ArrowRight, Sparkles, Shirt, 
  Smartphone, Home, Utensils, Dumbbell, Laptop,
  Baby, Gem, Car, BookOpen, Music, Camera,
  Briefcase, Heart, X, Eye, Crown, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { toast } from 'sonner';
import { AVAILABLE_THEMES, getThemeById } from '@/lib/themes';
import { NICHE_CATEGORIES } from '@/lib/nicheCategories';

// Template definitions - for theme preview purposes only
const templates = [
  {
    id: 'fashion',
    name: 'Fashion & Apparel',
    description: 'Clothing, shoes, and accessories',
    icon: Shirt,
    color: 'from-pink-500 to-rose-500',
    previewTheme: 'elegant',
  },
  {
    id: 'electronics',
    name: 'Electronics & Gadgets',
    description: 'Phones, laptops, and tech',
    icon: Smartphone,
    color: 'from-blue-500 to-cyan-500',
    previewTheme: 'tech',
  },
  {
    id: 'home',
    name: 'Home & Living',
    description: 'Furniture and home essentials',
    icon: Home,
    color: 'from-amber-500 to-orange-500',
    previewTheme: 'warm',
  },
  {
    id: 'food',
    name: 'Food & Groceries',
    description: 'Fresh food and beverages',
    icon: Utensils,
    color: 'from-green-500 to-emerald-500',
    previewTheme: 'fresh',
  },
  {
    id: 'beauty',
    name: 'Beauty & Personal Care',
    description: 'Skincare and cosmetics',
    icon: Sparkles,
    color: 'from-purple-500 to-violet-500',
    previewTheme: 'elegant',
  },
  {
    id: 'fitness',
    name: 'Sports & Fitness',
    description: 'Gym equipment and wear',
    icon: Dumbbell,
    color: 'from-red-500 to-orange-500',
    previewTheme: 'bold',
  },
  {
    id: 'computers',
    name: 'Computers & Accessories',
    description: 'Tech and peripherals',
    icon: Laptop,
    color: 'from-indigo-500 to-blue-500',
    previewTheme: 'tech',
  },
  {
    id: 'baby',
    name: 'Baby & Kids',
    description: 'Baby care and toys',
    icon: Baby,
    color: 'from-teal-400 to-cyan-400',
    previewTheme: 'soft',
  },
  {
    id: 'jewelry',
    name: 'Jewelry & Watches',
    description: 'Fine and fashion jewelry',
    icon: Gem,
    color: 'from-yellow-400 to-amber-500',
    previewTheme: 'luxury',
  },
  {
    id: 'automotive',
    name: 'Automotive',
    description: 'Car parts and accessories',
    icon: Car,
    color: 'from-slate-500 to-gray-600',
    previewTheme: 'bold',
  },
  {
    id: 'books',
    name: 'Books & Stationery',
    description: 'Books and office supplies',
    icon: BookOpen,
    color: 'from-amber-600 to-yellow-600',
    previewTheme: 'classic',
  },
  {
    id: 'music',
    name: 'Music & Instruments',
    description: 'Instruments and equipment',
    icon: Music,
    color: 'from-violet-600 to-purple-600',
    previewTheme: 'creative',
  },
  {
    id: 'photography',
    name: 'Photography',
    description: 'Cameras and equipment',
    icon: Camera,
    color: 'from-gray-700 to-slate-800',
    previewTheme: 'minimal',
  },
  {
    id: 'office',
    name: 'Office & Business',
    description: 'Office furniture and supplies',
    icon: Briefcase,
    color: 'from-blue-600 to-indigo-600',
    previewTheme: 'professional',
  },
  {
    id: 'health',
    name: 'Health & Wellness',
    description: 'Health products and supplements',
    icon: Heart,
    color: 'from-rose-400 to-pink-500',
    previewTheme: 'clean',
  },
];

// Theme Preview Component
function ThemePreview({ themeId, isSelected, onClick }: { themeId: string; isSelected: boolean; onClick: () => void }) {
  const theme = getThemeById(themeId);
  if (!theme) return null;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative p-4 rounded-xl border-2 transition-all text-left ${
        isSelected
          ? 'border-orange-500 ring-2 ring-orange-200 bg-orange-50 dark:bg-orange-900/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
      }`}
    >
      {/* Premium Badge */}
      {theme.is_premium && (
        <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
          <Crown className="w-3 h-3" />
          PRO
        </div>
      )}

      {/* Color Swatches */}
      <div className="flex gap-1 mb-3">
        <div 
          className="w-8 h-8 rounded-lg shadow-sm"
          style={{ backgroundColor: theme.colors.primary }}
          title="Primary"
        />
        <div 
          className="w-8 h-8 rounded-lg shadow-sm"
          style={{ backgroundColor: theme.colors.secondary }}
          title="Secondary"
        />
        <div 
          className="w-8 h-8 rounded-lg shadow-sm"
          style={{ backgroundColor: theme.colors.accent }}
          title="Accent"
        />
        <div 
          className="w-8 h-8 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600"
          style={{ backgroundColor: theme.colors.background }}
          title="Background"
        />
      </div>

      {/* Theme Info */}
      <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
        {theme.name}
      </h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
        {theme.description}
      </p>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </motion.button>
  );
}

export default function StoreTemplatesPage() {
  const { currentStore, updateStore } = useStoreStore();
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'popular' | 'new'>('all');

  const handleApplyTheme = async () => {
    if (!selectedTheme || !currentStore) return;

    const theme = getThemeById(selectedTheme);
    if (!theme) return;

    setIsApplying(true);

    try {
      // Update ONLY the theme - niches are not affected
      await updateStore(currentStore.id, {
        theme: selectedTheme,
        primary_color: theme.colors.primary,
        secondary_color: theme.colors.secondary,
      });

      toast.success(`Theme changed to ${theme.name}`);
      setSelectedTheme(null);
      setViewingTemplate(null);
    } catch (err) {
      toast.error('Failed to apply theme');
    } finally {
      setIsApplying(false);
    }
  };

  const filteredTemplates = templates.filter(template => {
    if (activeTab === 'popular') {
      return ['fashion', 'electronics', 'beauty', 'home'].includes(template.id);
    }
    if (activeTab === 'new') {
      return ['health', 'photography', 'music'].includes(template.id);
    }
    return true;
  });

  const currentTheme = currentStore?.theme ? getThemeById(currentStore.theme) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Store Themes</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Choose a theme that matches your brand. Your store can only have one active theme at a time.
        </p>
      </div>

      {/* Current Store Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-5 h-5" />
              <span className="font-medium text-orange-100">Your Store</span>
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">
              Niches: {(currentStore?.niches?.length ?? 0) > 0 
  ? currentStore!.niches!.map(n => NICHE_CATEGORIES[n]?.name || n).join(', ')
  : 'None selected'}
              </p>
              <p className="text-orange-100 text-sm">
                Active Theme: <span className="font-medium text-white">{currentTheme?.name || 'Default'}</span>
              </p>
            </div>
          </div>
          {currentTheme && (
            <div className="flex items-center gap-3 bg-white/20 rounded-lg p-3">
              <div 
                className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: currentTheme.colors.primary }}
              />
              <div>
                <p className="font-medium text-white">{currentTheme.name}</p>
                <p className="text-xs text-orange-100">Currently Active</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-blue-900">How Themes Work</p>
          <p className="text-sm text-blue-700 mt-1">
            Click on any template below to preview and select a theme. This will change the appearance 
            of your entire store. Your niches and products will not be affected.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b dark:border-gray-700">
        {[
          { key: 'all', label: 'All Themes' },
          { key: 'popular', label: 'Popular' },
          { key: 'new', label: 'New' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template, index) => {
          const Icon = template.icon;
          const isCurrentTheme = currentStore?.theme === template.previewTheme;

          return (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setViewingTemplate(template.id)}
              className="relative group cursor-pointer rounded-xl border-2 border-gray-200 dark:border-gray-600 hover:border-orange-300 p-6 transition-all hover:shadow-lg bg-white dark:bg-gray-800"
            >
              {/* Active Theme Badge */}
              {isCurrentTheme && (
                <div className="absolute top-4 right-4 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5 text-white" />
                </div>
              )}

              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center mb-4`}>
                <Icon className="w-7 h-7 text-white" />
              </div>

              {/* Content */}
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-2">
                {template.name}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                {template.description}
              </p>

              {/* Preview Theme */}
              <div className="flex items-center gap-2 text-sm text-orange-600 font-medium mt-3">
                <Palette className="w-4 h-4" />
                <span>Click to preview themes</span>
                <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Theme Preview Modal */}
      <AnimatePresence>
        {viewingTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setViewingTemplate(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              {(() => {
                const template = templates.find(t => t.id === viewingTemplate);
                if (!template) return null;
                const TemplateIcon = template.icon;

                return (
                  <>
                    {/* Modal Header */}
                    <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center`}>
                          <TemplateIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                            {template.name}
                          </h2>
                          <p className="text-gray-500 dark:text-gray-400 text-sm">
                            Select a theme for your store
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setViewingTemplate(null)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>

                    {/* Themes Grid */}
                    <div className="p-6 overflow-y-auto max-h-[60vh]">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {AVAILABLE_THEMES.map((theme) => (
                          <ThemePreview
                            key={theme.id}
                            themeId={theme.id}
                            isSelected={selectedTheme === theme.id}
                            onClick={() => setSelectedTheme(theme.id)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {selectedTheme 
                            ? `Selected: ${getThemeById(selectedTheme)?.name}`
                            : 'Click a theme to select it'
                          }
                        </p>
                        {currentStore?.theme && selectedTheme && currentStore.theme !== selectedTheme && (
                          <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                            Will replace current theme
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setViewingTemplate(null);
                            setSelectedTheme(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleApplyTheme}
                          disabled={!selectedTheme || isApplying || selectedTheme === currentStore?.theme}
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                          {isApplying ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              Applying...
                            </>
                          ) : selectedTheme === currentStore?.theme ? (
                            'Already Active'
                          ) : (
                            <>
                              Apply Theme
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
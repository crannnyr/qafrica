import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, X, Plus, AlertCircle,
  RefreshCw, Info, Truck, Loader2, Save, Tag,
  Image as ImageIcon, DollarSign, Package, Settings, BarChart2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore, useAuthStore } from '@/stores';
import { toast } from 'sonner';
import { supabase, productService } from '@/services/supabase';
import { getNicheCategories, getSubcategories } from '@/lib/nicheCategories';
import { compressImage, formatFileSize } from '@/lib/imageCompression';
import { processEmailQueue } from '@/services/email';
import CONFIG from '@/lib/config';
import type { ProductVariant } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VariantOption {
  name: string;
  rawInput: string;
  values: string[];
}

interface VariantCombination {
  id: string;
  options: Record<string, string>;
  price: number;
  stock: number;
  sku: string;
}

// ─── Steps config ─────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, name: 'Basics',    icon: Tag         },
  { id: 2, name: 'Images',    icon: ImageIcon   },
  { id: 3, name: 'Pricing',   icon: DollarSign  },
  { id: 4, name: 'Variants',  icon: Package     },
  { id: 5, name: 'Shipping',  icon: Truck       },
  { id: 6, name: 'SEO & Settings', icon: Settings },
];

// ─── Draft helpers ────────────────────────────────────────────────────────────

const getDraftKey = (userId: string) => `qafrica_product_draft_${userId}`;

// ─── Info Tooltip ──────────────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1 align-middle">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="text-gray-400 hover:text-orange-500 transition-colors"
        aria-label="More info"
      >
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </span>
  );
}

// ─── Step Progress Bar ─────────────────────────────────────────────────────────

function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-8">
      {/* Mobile: simple progress bar */}
      <div className="flex items-center justify-between mb-2 sm:hidden">
        <span className="text-sm font-medium text-gray-700">
          Step {current} of {total} — {STEPS[current - 1].name}
        </span>
        <span className="text-sm text-gray-400">{Math.round((current / total) * 100)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full sm:hidden">
        <div
          className="h-2 bg-orange-500 rounded-full transition-all duration-300"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>

      {/* Desktop: step circles */}
      <div className="hidden sm:flex items-center">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isDone    = current > step.id;
          const isActive  = current === step.id;
          const isFuture  = current < step.id;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isDone   ? 'bg-orange-500 border-orange-500 text-white' :
                    isActive ? 'bg-white border-orange-500 text-orange-500' :
                               'bg-white border-gray-200 text-gray-400'
                  }`}
                >
                  {isDone ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <span
                  className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                    isActive ? 'text-orange-600' : isDone ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  {step.name}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-5 transition-all ${
                    current > step.id ? 'bg-orange-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Multi Image Upload (with compression) ────────────────────────────────────

function MultiImageUpload({
  value = [],
  onChange,
  maxImages = 5,
}: {
  value?: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
}) {
  const [uploading, setUploading] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState<string | null>(null);
  const { user } = useAuthStore();
  const safeValue = Array.isArray(value) ? value : [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - safeValue.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    if (filesToUpload.length === 0) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    setCompressionInfo(null);
    const uploadedUrls: string[] = [];
    let totalOriginal = 0;
    let totalCompressed = 0;

    for (const rawFile of filesToUpload) {
      if (rawFile.size > 15 * 1024 * 1024) {
        toast.error(`${rawFile.name} is too large (max 15MB before compression)`);
        continue;
      }

      const fileExt = rawFile.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
        toast.error(`${rawFile.name}: Invalid type`);
        continue;
      }

      // Compress before upload
      totalOriginal += rawFile.size;
      const file = await compressImage(rawFile);
      totalCompressed += file.size;

      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const outputExt = file.name.split('.').pop() || 'webp';
      const fileName  = `${timestamp}_${randomStr}.${outputExt}`;
      const filePath  = `${user?.id || 'anon'}/${fileName}`;

      try {
        const { error: uploadError } = await supabase.storage
          .from('products')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          toast.error(`Failed to upload ${rawFile.name}: ${uploadError.message}`);
          continue;
        }

        const { data } = supabase.storage.from('products').getPublicUrl(filePath);
        if (!data?.publicUrl?.startsWith('http')) {
          toast.error(`Upload succeeded but URL is invalid for ${rawFile.name}`);
          continue;
        }

        uploadedUrls.push(data.publicUrl.split('?')[0]);
      } catch (err: any) {
        toast.error(`Error uploading ${rawFile.name}`);
      }
    }

    if (uploadedUrls.length > 0) {
      onChange([...safeValue, ...uploadedUrls]);
      if (totalOriginal > totalCompressed) {
        const saving = Math.round((1 - totalCompressed / totalOriginal) * 100);
        setCompressionInfo(`${uploadedUrls.length} image(s) uploaded · ${saving}% smaller after compression`);
      } else {
        setCompressionInfo(`${uploadedUrls.length} image(s) uploaded`);
      }
    }

    setUploading(false);
    e.target.value = '';
  };

  const removeImage = async (index: number) => {
    const urlToRemove = safeValue[index];
    try {
      const urlObj   = new URL(urlToRemove);
      const parts    = urlObj.pathname.split('/');
      const bucketIdx = parts.indexOf('products');
      if (bucketIdx !== -1) {
        await supabase.storage.from('products').remove([parts.slice(bucketIdx + 1).join('/')]);
      }
    } catch {}
    onChange(safeValue.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
        {safeValue.map((url, index) => (
          <div
            key={`img-${index}`}
            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group border border-gray-200"
          >
            <img
              src={url}
              alt={`Product ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeImage(index)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600"
            >
              <X className="w-4 h-4" />
            </button>
            {index === 0 && (
              <span className="absolute bottom-2 left-2 px-2 py-1 bg-orange-500 text-white text-xs rounded font-medium shadow-sm">
                Main
              </span>
            )}
          </div>
        ))}

        {safeValue.length < maxImages && (
          <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-orange-500 hover:bg-orange-50 flex flex-col items-center justify-center cursor-pointer transition-colors">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            ) : (
              <>
                <Plus className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-500 mt-2">Add Image</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
              disabled={uploading}
            />
          </label>
        )}
      </div>

      {compressionInfo && (
        <p className="text-sm text-green-600 font-medium flex items-center gap-1">
          <Check className="w-4 h-4" />
          {compressionInfo}
        </p>
      )}

      <p className="text-sm text-gray-500">
        {safeValue.length} of {maxImages} images · First image is the main product image · Images are automatically compressed
      </p>
    </div>
  );
}

// ─── Variant Manager ───────────────────────────────────────────────────────────

function VariantManager({
  variants,
  onChange,
  basePrice,
}: {
  variants: VariantCombination[];
  onChange: (variants: VariantCombination[]) => void;
  basePrice: number;
}) {
  const [options, setOptions] = useState<VariantOption[]>([
    { name: 'Color', rawInput: '', values: [] },
    { name: 'Size',  rawInput: '', values: [] },
  ]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const addOption    = () => { setOptions([...options, { name: '', rawInput: '', values: [] }]); setHasGenerated(false); };
  const removeOption = (i: number) => { setOptions(options.filter((_, idx) => idx !== i)); setHasGenerated(false); };

  const updateOptionName  = (i: number, name: string) => { const n = [...options]; n[i] = { ...n[i], name }; setOptions(n); setHasGenerated(false); };
  const updateRawInput    = (i: number, raw: string)  => { const n = [...options]; n[i] = { ...n[i], rawInput: raw }; setOptions(n); setHasGenerated(false); };

  const generateCombinations = useCallback(() => {
    const parsed = options.map(o => ({
      ...o,
      values: o.rawInput.split(',').map(v => v.trim()).filter(Boolean),
    }));
    const valid = parsed.filter(o => o.name.trim() && o.values.length > 0);
    if (valid.length === 0) { toast.error('Enter at least one option name and values'); return; }
    const names = valid.map(o => o.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) { toast.error('Option names must be unique'); return; }
    setOptions(parsed);
    const combos: VariantCombination[] = [];
    const gen = (cur: Record<string, string>, idx: number) => {
      if (idx === valid.length) {
        const ex = variants.find(v => Object.keys(cur).every(k => v.options[k] === cur[k]));
        combos.push(ex ? { ...ex, options: { ...cur } } : { id: Math.random().toString(36).substr(2, 9), options: { ...cur }, price: basePrice, stock: 0, sku: '' });
        return;
      }
      for (const val of valid[idx].values) { cur[valid[idx].name] = val; gen(cur, idx + 1); delete cur[valid[idx].name]; }
    };
    gen({}, 0);
    onChange(combos);
    setHasGenerated(true);
    toast.success(`${combos.length} combination${combos.length !== 1 ? 's' : ''} generated`);
  }, [options, basePrice, variants, onChange]);

  const updateVariant = (id: string, field: keyof VariantCombination, value: any) =>
    onChange(variants.map(v => v.id === id ? { ...v, [field]: value } : v));

  const canGenerate = options.some(o => o.name.trim() && o.rawInput.trim());

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">How variants work</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700">
            <li>Name each option (e.g. <strong>Color</strong> or <strong>Size</strong>)</li>
            <li>Enter values separated by commas (e.g. <strong>Red, Blue, Green</strong>)</li>
            <li>Click <strong>Generate Combinations</strong></li>
            <li>Set price and stock per combination below</li>
          </ol>
        </div>
      </div>

      {options.map((opt, i) => (
        <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <input
              type="text"
              value={opt.name}
              onChange={e => updateOptionName(i, e.target.value)}
              placeholder="Option name (e.g. Color)"
              className="font-medium bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 w-48 text-sm"
            />
            <button type="button" onClick={() => removeOption(i)} className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50 transition-colors">Remove</button>
          </div>
          <input
            type="text"
            value={opt.rawInput}
            onChange={e => updateRawInput(i, e.target.value)}
            placeholder="e.g. Red, Blue, Green"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          />
          <p className="text-xs text-gray-400 mt-1">Separate each value with a comma.</p>
          {hasGenerated && opt.values.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {opt.values.map((val, vi) => (
                <span key={vi} className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium border border-orange-200">{val}</span>
              ))}
            </div>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" onClick={addOption} className="w-full border-dashed border-2 hover:border-orange-400 hover:bg-orange-50">
        <Plus className="w-4 h-4 mr-2" /> Add Another Option
      </Button>

      <Button
        type="button"
        onClick={generateCombinations}
        disabled={!canGenerate}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white disabled:bg-gray-200 disabled:text-gray-400 h-12"
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Generate Combinations
      </Button>

      {variants.length > 0 && (
        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Variant</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Price (₦)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Stock</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">SKU</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {variants.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(v.options).map(([k, val]) => (
                        <span key={k} className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">{k}: {val}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={v.price} onChange={e => updateVariant(v.id, 'price', parseFloat(e.target.value) || 0)}
                      className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" min="0" step="0.01" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="number" value={v.stock} onChange={e => updateVariant(v.id, 'stock', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" min="0" />
                  </td>
                  <td className="px-4 py-3">
                    <input type="text" value={v.sku} onChange={e => updateVariant(v.id, 'sku', e.target.value)}
                      placeholder="Optional" className="w-32 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => onChange(variants.filter(vv => vv.id !== v.id))}
                      className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50">
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t text-xs text-gray-500">
                <td className="px-4 py-3">{variants.length} combination{variants.length !== 1 ? 's' : ''}</td>
                <td colSpan={4} className="px-4 py-3 text-right">Total stock: {variants.reduce((s, v) => s + (v.stock || 0), 0)} units</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name:                '',
  description:         '',
  niche:               '',
  category:            '',
  subcategory:         '',
  cost_price:          '',
  selling_price:       '',
  compare_at_price:    '',
  dropship_price:      '',
  wholesale_price:     '',
  stock_quantity:      '',
  sku:                 '',
  barcode:             '',
  low_stock_threshold: '10',
  allowOtherSellers:   true,
  has_variants:        false,
  weight_kg:           '',
  hs_code:             '',
  product_type:        'parcel' as 'parcel' | 'document',
  weight:              '',
  dimensions:          { length: '', width: '', height: '' },
  seo_title:           '',
  seo_description:     '',
  is_active:           true,
};

export default function AddProductPage() {
  const navigate   = useNavigate();
  const { user }   = useAuthStore();
  const { currentStore } = useStoreStore();

  const [step, setStep]         = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages]     = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantCombination[]>([]);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [hasDraft, setHasDraft] = useState(false);

  const allowedNiches  = currentStore?.niches || [];
  const isTerminalMode = currentStore?.delivery_mode === 'terminal';
  const draftKey       = user?.id ? getDraftKey(user.id) : null;

  // ── Load draft on mount ────────────────────────────────────────────────────
  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const { formData: fd, images: imgs, step: s } = JSON.parse(saved);
        if (fd?.name || imgs?.length) {
          setHasDraft(true);
          setFormData({ ...EMPTY_FORM, ...fd });
          setImages(imgs || []);
          setStep(s || 1);
        }
      }
    } catch {}
  }, [draftKey]);

  // ── Auto-save draft on every change ───────────────────────────────────────
  useEffect(() => {
    if (!draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ formData, images, step }));
    } catch {}
  }, [formData, images, step, draftKey]);

  const clearDraft = () => {
    if (draftKey) localStorage.removeItem(draftKey);
    setHasDraft(false);
    setFormData({ ...EMPTY_FORM });
    setImages([]);
    setStep(1);
    setVariants([]);
  };

  // ── Redirect if no niches ─────────────────────────────────────────────────
  useEffect(() => {
    if (allowedNiches.length === 0) {
      toast.error('Please select a niche in your store settings first');
      navigate('/dashboard/niches');
    }
  }, [allowedNiches, navigate]);

  const set = (patch: Partial<typeof EMPTY_FORM>) =>
    setFormData(prev => ({ ...prev, ...patch }));

  const selectedNicheCategories = formData.niche ? getNicheCategories(formData.niche) : [];
  const selectedCategorySubcategories = formData.niche && formData.category
    ? getSubcategories(formData.niche, formData.category) : [];

  // ── Step validation ────────────────────────────────────────────────────────
  const validateStep = (s: number): boolean => {
    switch (s) {
      case 1:
        if (!formData.name.trim())  { toast.error('Product name is required'); return false; }
        if (!formData.niche)        { toast.error('Please select a niche'); return false; }
        if (!formData.category)     { toast.error('Please select a category'); return false; }
        if (!allowedNiches.includes(formData.niche)) {
          toast.error(`Your subscription doesn't include the "${formData.niche}" niche`);
          return false;
        }
        return true;
      case 2:
        return true; // images optional
      case 3:
        if (!formData.selling_price) { toast.error('Selling price is required'); return false; }
        const sp = parseFloat(formData.selling_price);
        const dp = parseFloat(formData.dropship_price) || 0;
        const wp = parseFloat(formData.wholesale_price) || 0;
        const cp = parseFloat(formData.compare_at_price) || 0;
        if (dp > 0 && dp >= sp) { toast.error('Dropship price must be lower than selling price'); return false; }
        if (wp > 0 && wp >= sp) { toast.error('Wholesale price must be lower than selling price'); return false; }
        if (cp > 0 && cp <= sp) { toast.error('Compare-at price should be higher than selling price (it\'s the original/crossed-out price)'); return false; }
        return true;
      case 4:
        if (formData.has_variants && variants.length === 0) {
          toast.error('Please generate at least one variant combination');
          return false;
        }
        return true;
      case 5:
        if (isTerminalMode && !formData.weight_kg) {
          toast.error('Weight is required for Terminal Africa delivery');
          return false;
        }
        if (formData.weight_kg && parseFloat(formData.weight_kg) <= 0) {
          toast.error('Weight must be greater than 0');
          return false;
        }
        if (formData.hs_code && !/^\d{4}(\d{2})?$/.test(formData.hs_code.trim())) {
          toast.error('HS Code must be exactly 4 or 6 digits');
          return false;
        }
        if (!formData.has_variants) {
          if (!formData.stock_quantity || parseInt(formData.stock_quantity) < 0) {
            toast.error('Please enter a valid stock quantity');
            return false;
          }
        }
        return true;
      case 6:
        return true;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep(s => Math.min(s + 1, STEPS.length));
  };

  const goBack = () => setStep(s => Math.max(s - 1, 1));

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Validate all steps
    for (let s = 1; s <= STEPS.length; s++) {
      if (!validateStep(s)) { setStep(s); return; }
    }
    if (!currentStore?.id || !user?.id) { toast.error('Store or user not found'); return; }

    setIsLoading(true);
    try {
      let totalStock = 0;
      if (formData.has_variants && variants.length > 0) {
        totalStock = variants.reduce((sum, v) => sum + (v.stock || 0), 0);
      } else {
        totalStock = parseInt(formData.stock_quantity) || 0;
      }

      const weightKg = formData.weight_kg ? parseFloat(formData.weight_kg) : null;

      const productData = {
        store_id:            currentStore.id,
        owner_id:            user.id,
        name:                formData.name.trim(),
        description:         formData.description,
        category:            formData.category,
        subcategory:         formData.subcategory || undefined,
        niche:               formData.niche,
        cost_price:          parseFloat(formData.cost_price) || 0,
        selling_price:       parseFloat(formData.selling_price),
        compare_at_price:    parseFloat(formData.compare_at_price) || null,
        dropship_price:      parseFloat(formData.dropship_price) || 0,
        wholesale_price:     parseFloat(formData.wholesale_price) || 0,
        stock_quantity:      totalStock,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        is_out_of_stock:     totalStock === 0,
        sku:                 formData.sku.trim() || undefined,
        barcode:             formData.barcode.trim() || undefined,
        images,
        is_importable:       formData.allowOtherSellers,
        has_variants:        formData.has_variants,
        variants:            formData.has_variants
          ? variants.map(v => ({ id: v.id, options: v.options, price: v.price, stock: v.stock, sku: v.sku }))
          : [],
        weight_kg:           weightKg,
        hs_code:             formData.hs_code.trim() || null,
        product_type:        formData.product_type,
        weight:              weightKg ?? undefined,
        dimensions:
  formData.dimensions.length || formData.dimensions.width || formData.dimensions.height
    ? {
        length: parseFloat(formData.dimensions.length) || 0,
        width:  parseFloat(formData.dimensions.width)  || 0,
        height: parseFloat(formData.dimensions.height) || 0,
      }
    : undefined,
    seo_title:       formData.seo_title.trim() || undefined,
    seo_description: formData.seo_description.trim() || undefined,
        is_active:       formData.is_active,
        views:           0,
        sales_count:     0,
        import_count:    0,
        tags:            [],
      };

      const { error } = await productService.createProduct(productData);
      if (error) throw error;

      // Clear draft on success
      if (draftKey) localStorage.removeItem(draftKey);

      // Trigger email queue (new product notification to niche importers)
      processEmailQueue().catch(() => {});

      toast.success('Product added successfully!');
      navigate('/dashboard/products');
    } catch (err) {
      console.error('[AddProduct] Error:', err);
      toast.error('Failed to add product. Please try again.');
    }
    setIsLoading(false);
  };

  // ── Render steps ──────────────────────────────────────────────────────────

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors";
  const labelClass = "block text-sm font-medium text-gray-700 mb-2";

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/dashboard/products')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Fill in the details across each section</p>
        </div>
        {formData.name && (
          <button
            type="button"
            onClick={() => { toast.success('Draft saved'); }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">Draft saved</span>
          </button>
        )}
      </div>

      {/* Draft recovery banner */}
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

      {/* Plan info */}
      {allowedNiches.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">
            Plan: {currentStore?.niches?.length ? 'Active' : 'Loading...'}
            </p>
            <p className="text-sm text-blue-700 mt-0.5">
              Niches available: {allowedNiches.map(n => CONFIG.NICHES.find((cn: any) => cn.id === n)?.name || n).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <StepBar current={step} total={STEPS.length} />

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.18 }}
        >

          {/* ── Step 1: Basics ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Basic Information</h2>

              <div>
                <label className={labelClass}>Product Name <span className="text-orange-500">*</span></label>
                <input type="text" value={formData.name} onChange={e => set({ name: e.target.value })}
                  className={inputClass} placeholder="Enter product name" />
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea value={formData.description} onChange={e => set({ description: e.target.value })}
                  className={`${inputClass} min-h-[120px]`} placeholder="Describe your product..." />
              </div>

              <div>
                <label className={labelClass}>
                  Niche <span className="text-orange-500">*</span>
                  <InfoTip text="The broad market your product belongs to." />
                </label>
                <select value={formData.niche} onChange={e => set({ niche: e.target.value, category: '', subcategory: '' })}
                  className={inputClass}>
                  <option value="">Select a niche...</option>
                  {allowedNiches.map(nicheId => {
                    const niche = CONFIG.NICHES.find((n: any) => n.id === nicheId);
                    return <option key={nicheId} value={nicheId}>{niche?.name || nicheId}</option>;
                  })}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Only your subscribed niches are shown.{' '}
                  <button type="button" onClick={() => navigate('/dashboard/subscription')} className="text-orange-500 hover:underline">
                    Upgrade for more
                  </button>
                </p>
              </div>

              {formData.niche && (
                <div>
                  <label className={labelClass}>Category <span className="text-orange-500">*</span></label>
                  <select value={formData.category} onChange={e => set({ category: e.target.value, subcategory: '' })}
                    className={inputClass}>
                    <option value="">Select a category...</option>
                    {selectedNicheCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
              )}

              {formData.category && selectedCategorySubcategories.length > 0 && (
                <div>
                  <label className={labelClass}>Subcategory <span className="text-gray-400 font-normal">— Optional</span></label>
                  <select value={formData.subcategory} onChange={e => set({ subcategory: e.target.value })}
                    className={inputClass}>
                    <option value="">Select a subcategory...</option>
                    {selectedCategorySubcategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Images ──────────────────────────────────────────── */}
          {step === 2 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Product Images</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Upload up to 5 images. The first image is shown as the main product photo.
                  Images are automatically compressed and optimised.
                </p>
              </div>
              <MultiImageUpload value={images} onChange={setImages} maxImages={5} />
            </div>
          )}

          {/* ── Step 3: Pricing ─────────────────────────────────────────── */}
          {step === 3 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Pricing</h2>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className={labelClass}>
                    Selling Price (₦) <span className="text-orange-500">*</span>
                    <InfoTip text="The price customers pay in your store." />
                  </label>
                  <input type="number" value={formData.selling_price} onChange={e => set({ selling_price: e.target.value })}
                    className={inputClass} placeholder="0.00" min="0" />
                </div>

                <div>
                  <label className={labelClass}>
                    Compare-at Price (₦)
                    <InfoTip text="The original or crossed-out price shown to customers. Must be higher than selling price. Use this to show a discount (e.g. Was ₦10,000 → Now ₦7,500)." />
                  </label>
                  <input type="number" value={formData.compare_at_price} onChange={e => set({ compare_at_price: e.target.value })}
                    className={inputClass} placeholder="0.00 (optional)" min="0" />
                </div>

                <div>
                  <label className={labelClass}>
                    Cost Price (₦)
                    <InfoTip text="What you paid for this product. Only used for profit calculations — customers never see it." />
                  </label>
                  <input type="number" value={formData.cost_price} onChange={e => set({ cost_price: e.target.value })}
                    className={inputClass} placeholder="0.00" min="0" />
                </div>

                <div>
                  <label className={labelClass}>
                    Dropship Price (₦)
                    <InfoTip text="What other sellers pay you when they sell this product. Must be lower than your selling price." />
                  </label>
                  <input type="number" value={formData.dropship_price} onChange={e => set({ dropship_price: e.target.value })}
                    className={inputClass} placeholder="0.00" min="0" />
                </div>

                <div>
                  <label className={labelClass}>
                    Wholesale Price (₦)
                    <InfoTip text="Discounted price for customers buying in bulk. Leave blank if you don't offer bulk discounts." />
                  </label>
                  <input type="number" value={formData.wholesale_price} onChange={e => set({ wholesale_price: e.target.value })}
                    className={inputClass} placeholder="0.00" min="0" />
                </div>
              </div>

              {/* Price preview */}
              {formData.selling_price && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-2">How it looks to customers</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-bold text-orange-500">₦{parseFloat(formData.selling_price || '0').toLocaleString()}</span>
                    {formData.compare_at_price && parseFloat(formData.compare_at_price) > parseFloat(formData.selling_price) && (
                      <span className="text-lg text-gray-400 line-through">₦{parseFloat(formData.compare_at_price).toLocaleString()}</span>
                    )}
                    {formData.compare_at_price && parseFloat(formData.compare_at_price) > parseFloat(formData.selling_price) && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                        {Math.round((1 - parseFloat(formData.selling_price) / parseFloat(formData.compare_at_price)) * 100)}% OFF
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Variants ────────────────────────────────────────── */}
          {step === 4 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-1">
                    Product Variants
                    <InfoTip text="Enable if your product comes in different options like size or colour." />
                  </h2>
                  <p className="text-sm text-gray-500">Add size, colour, or other options</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.has_variants}
                    onChange={e => { set({ has_variants: e.target.checked }); if (!e.target.checked) setVariants([]); }}
                    className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable Variants</span>
                </label>
              </div>

              {!formData.has_variants && (
                <div className="p-8 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Toggle variants on above if this product comes in different sizes, colours, or styles.</p>
                </div>
              )}

              {formData.has_variants && (
                <VariantManager
                  variants={variants}
                  onChange={setVariants}
                  basePrice={parseFloat(formData.selling_price) || 0}
                />
              )}
            </div>
          )}

          {/* ── Step 5: Shipping & Inventory ────────────────────────────── */}
          {step === 5 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Shipping & Inventory</h2>

              {isTerminalMode && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-start gap-3">
                  <Truck className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-indigo-800">
                    <strong>Terminal Africa delivery enabled.</strong> Weight is required for accurate carrier rates at checkout.
                  </p>
                </div>
              )}

              {/* Inventory */}
              <div className="grid sm:grid-cols-2 gap-6">
                {!formData.has_variants && (
                  <div>
                    <label className={labelClass}>
                      Stock Quantity <span className="text-orange-500">*</span>
                      <InfoTip text="How many units you currently have available." />
                    </label>
                    <input type="number" value={formData.stock_quantity} onChange={e => set({ stock_quantity: e.target.value })}
                      className={inputClass} placeholder="0" min="0" />
                  </div>
                )}

                <div>
                  <label className={labelClass}>
                    Low Stock Threshold
                    <InfoTip text="You'll get an alert when stock falls to or below this number." />
                  </label>
                  <input type="number" value={formData.low_stock_threshold} onChange={e => set({ low_stock_threshold: e.target.value })}
                    className={inputClass} placeholder="10" min="1" />
                </div>

                {!formData.has_variants && (
                  <div>
                    <label className={labelClass}>
                      SKU
                      <InfoTip text="Your internal stock keeping code for this product." />
                    </label>
                    <input type="text" value={formData.sku} onChange={e => set({ sku: e.target.value })}
                      className={inputClass} placeholder="e.g. PROD-001 (optional)" />
                  </div>
                )}

                <div>
                  <label className={labelClass}>
                    Barcode
                    <InfoTip text="EAN, UPC, or ISBN if your product has one. Used for scanning and inventory management." />
                  </label>
                  <input type="text" value={formData.barcode} onChange={e => set({ barcode: e.target.value })}
                    className={inputClass} placeholder="e.g. 8901234567890 (optional)" />
                </div>
              </div>

              {/* Shipping */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Shipping Details</h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>
                      Weight (kg)
                      {isTerminalMode ? <span className="text-orange-500"> *</span> : <span className="text-gray-400 font-normal"> — Optional</span>}
                      <InfoTip text="Product weight in kg. E.g. a pair of shoes ≈ 0.8 kg." />
                    </label>
                    <input type="number" step="0.01" min="0.01" value={formData.weight_kg}
                      onChange={e => set({ weight_kg: e.target.value, weight: e.target.value })}
                      className={`${inputClass} ${isTerminalMode && !formData.weight_kg ? 'border-orange-300 bg-orange-50' : ''}`}
                      placeholder="e.g. 0.8" required={isTerminalMode} />
                  </div>

                  <div>
                    <label className={labelClass}>
                      HS Code <span className="text-gray-400 font-normal">— Optional</span>
                      <InfoTip text="4 or 6 digit customs classification code. Required for international shipments." />
                    </label>
                    <input type="text" value={formData.hs_code}
                      onChange={e => set({ hs_code: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      className={`${inputClass} font-mono tracking-widest`} placeholder="e.g. 640399" maxLength={6} inputMode="numeric" />
                    {formData.hs_code && formData.hs_code.length !== 4 && formData.hs_code.length !== 6 && (
                      <p className="text-xs text-amber-600 mt-1">Must be 4 or 6 digits</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>
                      Product Type
                      <InfoTip text="Physical products are Parcel. Use Document only for printed papers." />
                    </label>
                    <select value={formData.product_type} onChange={e => set({ product_type: e.target.value as 'parcel' | 'document' })}
                      className={inputClass}>
                      <option value="parcel">Physical Product (Parcel)</option>
                      <option value="document">Document</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <label className={labelClass}>
                    Dimensions (cm) <span className="text-gray-400 font-normal">— Optional</span>
                    <InfoTip text="Length × Width × Height in cm. Used for volumetric weight calculation." />
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <input type="number" min="0" value={formData.dimensions.length}
                      onChange={e => set({ dimensions: { ...formData.dimensions, length: e.target.value } })}
                      className={inputClass} placeholder="Length" />
                    <input type="number" min="0" value={formData.dimensions.width}
                      onChange={e => set({ dimensions: { ...formData.dimensions, width: e.target.value } })}
                      className={inputClass} placeholder="Width" />
                    <input type="number" min="0" value={formData.dimensions.height}
                      onChange={e => set({ dimensions: { ...formData.dimensions, height: e.target.value } })}
                      className={inputClass} placeholder="Height" />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Length × Width × Height in cm</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 6: SEO & Settings ──────────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-6">
              {/* SEO */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <BarChart2 className="w-5 h-5" />
                    SEO
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Helps your product appear in Google search results. If left blank, product name and description are used automatically.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>
                    SEO Title <span className="text-gray-400 font-normal">— Optional</span>
                    <InfoTip text="The title shown in Google search results. Keep it under 60 characters. Default: your product name." />
                  </label>
                  <input type="text" value={formData.seo_title} onChange={e => set({ seo_title: e.target.value })}
                    className={inputClass} placeholder={formData.name || 'e.g. Red Silk Dress – Free Delivery Nigeria'} maxLength={60} />
                  <p className="text-xs text-gray-400 mt-1">{formData.seo_title.length}/60 characters</p>
                </div>

                <div>
                  <label className={labelClass}>
                    SEO Description <span className="text-gray-400 font-normal">— Optional</span>
                    <InfoTip text="The description shown under your link in Google. Keep it under 160 characters." />
                  </label>
                  <textarea value={formData.seo_description} onChange={e => set({ seo_description: e.target.value })}
                    className={`${inputClass} min-h-[80px]`}
                    placeholder="Brief, compelling description of this product for search engines..."
                    maxLength={160} />
                  <p className="text-xs text-gray-400 mt-1">{formData.seo_description.length}/160 characters</p>
                </div>

                {/* Preview */}
                {(formData.seo_title || formData.name) && (
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 mb-2 font-medium">Google search preview</p>
                    <p className="text-blue-600 text-base font-medium truncate">{formData.seo_title || formData.name}</p>
                    <p className="text-green-700 text-xs">qafrica.store/{currentStore?.slug}/...</p>
                    <p className="text-gray-600 text-sm mt-1 line-clamp-2">{formData.seo_description || formData.description || 'No description set.'}</p>
                  </div>
                )}
              </div>

              {/* Settings */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Settings</h2>

                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={formData.allowOtherSellers}
                    onChange={e => set({ allowOtherSellers: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-gray-900 block">
                      Allow other sellers to sell this product
                      <InfoTip text="Other store owners can import and list your product. You still fulfil all orders." />
                    </span>
                    <span className="text-sm text-gray-500">They promote it, you fulfil it, you both earn.</span>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <input type="checkbox" checked={formData.is_active}
                    onChange={e => set({ is_active: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 mt-0.5" />
                  <div>
                    <span className="font-medium text-gray-900 block">Product is active</span>
                    <span className="text-sm text-gray-500">Uncheck to save as a draft — customers won't see it until you activate it.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-4 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={step === 1 ? () => navigate('/dashboard/products') : goBack}
            className="flex items-center gap-2 px-5 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors hover:bg-gray-100 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>

          <div className="text-sm text-gray-400">
            {step} / {STEPS.length}
          </div>

          {step < STEPS.length ? (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex items-center gap-2 px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl h-12"
            >
              {isLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                : <><Check className="w-4 h-4" /> Add Product</>
              }
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
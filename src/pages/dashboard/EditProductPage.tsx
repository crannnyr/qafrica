import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader as Loader2, Check, X, Plus, Trash2, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore, useAuthStore } from '@/stores';
import { toast } from 'sonner';
import { productService, storageService } from '@/services/supabase';
import { compressImage, formatFileSize } from '@/lib/imageCompression';
import { getNicheCategories, getSubcategories } from '@/lib/nicheCategories';
import CONFIG from '@/lib/config';

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

// ─── Multi Image Upload ────────────────────────────────────────────────────────

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
  const { user } = useAuthStore();
  const safeValue = Array.isArray(value) ? value : [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const remainingSlots = maxImages - safeValue.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    if (filesToUpload.length === 0) { toast.error(`Maximum ${maxImages} images allowed`); return; }
    setUploading(true);
    const uploadedUrls: string[] = [];
for (const rawFile of filesToUpload) {
  const file = await compressImage(rawFile);
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} is too large (max 5MB)`); continue; }
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (!fileExt || !['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) { toast.error(`${file.name}: Invalid type`); continue; }
      try {
        const { url, error } = await storageService.uploadImage('products', file, user?.id || 'anon');
        if (error || !url || !url.startsWith('http')) { toast.error(`Failed to upload ${file.name}`); continue; }
        uploadedUrls.push(url.split('?')[0]);
      } catch { toast.error(`Error uploading ${file.name}`); }
    }
    if (uploadedUrls.length > 0) { onChange([...safeValue, ...uploadedUrls]); toast.success(`${uploadedUrls.length} image(s) uploaded`); }
    setUploading(false);
    e.target.value = '';
  };

  const removeImage = async (index: number) => {
    const urlToRemove = safeValue[index];
    try {
      const urlObj = new URL(urlToRemove);
      const pathParts = urlObj.pathname.split('/');
      const idx = pathParts.indexOf('products');
      if (idx !== -1) await storageService.deleteFile('products', pathParts.slice(idx + 1).join('/'));
    } catch {}
    onChange(safeValue.filter((_, i) => i !== index));
    toast.success('Image removed');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
        {safeValue.map((url, index) => (
          <div key={`img-${index}`} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group border border-gray-200">
            <img src={url} alt={`Product ${index + 1}`} className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzczNzM3MyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkJyb2tlbjwvdGV4dD48L3N2Zz4='; }} />
            <button type="button" onClick={() => removeImage(index)}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:bg-red-600">
              <X className="w-4 h-4" />
            </button>
            {index === 0 && <span className="absolute bottom-2 left-2 px-2 py-1 bg-orange-500 text-white text-xs rounded font-medium shadow-sm">Main</span>}
          </div>
        ))}
        {safeValue.length < maxImages && (
          <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-orange-500 hover:bg-orange-50 flex flex-col items-center justify-center cursor-pointer transition-colors">
            <Plus className="w-8 h-8 text-gray-400" />
            <span className="text-sm text-gray-500 mt-2">Add Image</span>
            <input type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" disabled={uploading} />
          </label>
        )}
      </div>
      {uploading && <div className="flex items-center gap-2 text-sm text-orange-600 font-medium"><Loader2 className="w-4 h-4 animate-spin" />Uploading...</div>}
      <p className="text-sm text-gray-500">{safeValue.length} of {maxImages} images • First image is the main product image</p>
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
  const [options, setOptions] = useState<VariantOption[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (initialised) return;
    if (variants.length > 0 && variants[0]?.options) {
      const reconstructed: VariantOption[] = Object.keys(variants[0].options).map(key => ({
        name: key,
        rawInput: [...new Set(variants.map(v => v.options[key]))].join(', '),
        values: [...new Set(variants.map(v => v.options[key]))],
      }));
      setOptions(reconstructed);
      setHasGenerated(true);
    } else {
      setOptions([
        { name: 'Color', rawInput: '', values: [] },
        { name: 'Size',  rawInput: '', values: [] },
      ]);
    }
    setInitialised(true);
  }, [variants, initialised]);

  const addOption = () => {
    setOptions([...options, { name: '', rawInput: '', values: [] }]);
    setHasGenerated(false);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
    setHasGenerated(false);
  };

  const updateOptionName = (index: number, name: string) => {
    const next = [...options];
    next[index] = { ...next[index], name };
    setOptions(next);
    setHasGenerated(false);
  };

  const updateRawInput = (index: number, raw: string) => {
    const next = [...options];
    next[index] = { ...next[index], rawInput: raw };
    setOptions(next);
    setHasGenerated(false);
  };

  const generateCombinations = () => {
    const parsedOptions = options.map(o => ({
      ...o,
      values: o.rawInput.split(',').map(v => v.trim()).filter(v => v.length > 0),
    }));

    const validOptions = parsedOptions.filter(o => o.name.trim() && o.values.length > 0);
    if (validOptions.length === 0) {
      toast.error('Please enter at least one option name and values before generating');
      return;
    }
    const names = validOptions.map(o => o.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      toast.error('Option names must be unique');
      return;
    }

    setOptions(parsedOptions.map(o => ({ ...o, values: o.values })));

    const newCombinations: VariantCombination[] = [];
    const generate = (current: Record<string, string>, index: number) => {
      if (index === validOptions.length) {
        const existing = variants.find(v =>
          Object.keys(current).every(key => v.options[key] === current[key])
        );
        newCombinations.push(
          existing
            ? { ...existing, options: { ...current } }
            : { id: Math.random().toString(36).substr(2, 9), options: { ...current }, price: basePrice, stock: 0, sku: '' }
        );
        return;
      }
      for (const value of validOptions[index].values) {
        current[validOptions[index].name] = value;
        generate(current, index + 1);
        delete current[validOptions[index].name];
      }
    };
    generate({}, 0);

    onChange(newCombinations);
    setHasGenerated(true);
    toast.success(`${newCombinations.length} variant combination${newCombinations.length !== 1 ? 's' : ''} generated`);
  };

  const updateVariant = (id: string, field: keyof VariantCombination, value: any) =>
    onChange(variants.map(v => v.id === id ? { ...v, [field]: value } : v));

  const deleteVariant = (id: string) => onChange(variants.filter(v => v.id !== id));

  const canGenerate = options.some(o => o.name.trim() && o.rawInput.trim());

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">How variants work</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700">
            <li>Give each option a name (e.g. <strong>Color</strong> or <strong>Size</strong>)</li>
            <li>Type the values separated by commas (e.g. <strong>Red, Blue, Green</strong>)</li>
            <li>Click <strong>Generate Combinations</strong> — all possible combinations are created</li>
            <li>Set the price and stock for each combination in the table below</li>
          </ol>
        </div>
      </div>

      <div className="space-y-4">
        {options.map((option, index) => (
          <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={option.name}
                  onChange={e => updateOptionName(index, e.target.value)}
                  placeholder="Option name (e.g. Color)"
                  className="font-medium bg-white border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-900 w-48 text-sm"
                />
                <InfoTip text="Give this option a descriptive name like 'Color', 'Size', or 'Material'." />
              </div>
              <button type="button" onClick={() => removeOption(index)}
                className="text-red-500 hover:text-red-700 text-sm px-2 py-1 rounded hover:bg-red-50 transition-colors">
                Remove
              </button>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                Values
                <InfoTip text="Type all the values for this option separated by commas. Example: Red, Blue, Green. The list won't update until you click Generate." />
              </label>
              <input
                type="text"
                value={option.rawInput}
                onChange={e => updateRawInput(index, e.target.value)}
                placeholder="e.g. Red, Blue, Green"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              />
              <p className="text-xs text-gray-400 mt-1">Separate each value with a comma. Click Generate when ready.</p>

              {hasGenerated && option.values.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {option.values.map((val, i) => (
                    <span key={i} className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium border border-orange-200">
                      {val}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addOption} className="w-full border-dashed border-2 hover:border-orange-400 hover:bg-orange-50">
          <Plus className="w-4 h-4 mr-2" />
          Add Another Option
        </Button>

        <div>
          <Button
            type="button"
            onClick={generateCombinations}
            disabled={!canGenerate}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed h-12"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Generate Combinations
          </Button>
          {!canGenerate && (
            <p className="text-xs text-gray-400 text-center mt-1">Enter at least one option name and its values above first</p>
          )}
        </div>
      </div>

      {variants.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-900 text-sm">Variant Combinations</h4>
            <InfoTip text="Each row is one specific combination. Set the selling price and how many units you have for that exact variant. SKU is optional." />
          </div>

          <div className="overflow-x-auto border rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Variant</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">
                    Price (₦)
                    <InfoTip text="Selling price for this specific variant." />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">
                    Stock
                    <InfoTip text="Units available for this exact variant." />
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">
                    SKU
                    <InfoTip text="Optional inventory code (e.g. SHIRT-RED-L)." />
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {variants.map(variant => (
                  <tr key={variant.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(variant.options).map(([key, val]) => (
                          <span key={key} className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                            {key}: {val}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" value={variant.price}
                        onChange={e => updateVariant(variant.id, 'price', parseFloat(e.target.value) || 0)}
                        className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        min="0" step="0.01" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="number" value={variant.stock}
                        onChange={e => updateVariant(variant.id, 'stock', parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                        min="0" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="text" value={variant.sku}
                        onChange={e => updateVariant(variant.id, 'sku', e.target.value)}
                        placeholder="Optional"
                        className="w-32 px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm" />
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => deleteVariant(variant.id)}
                        className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors" title="Remove variant">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500 flex justify-between">
              <span>{variants.length} combination{variants.length !== 1 ? 's' : ''}</span>
              <span>Total stock: {variants.reduce((sum, v) => sum + (v.stock || 0), 0)} units</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function EditProductPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentStore } = useStoreStore();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantCombination[]>([]);

  // Whether this store uses Terminal Africa delivery — drives weight requirement
  const isTerminalStore = currentStore?.delivery_mode === 'terminal';

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    niche: '',
    category: '',
    subcategory: '',
    cost_price: '',
    selling_price: '',
    dropship_price: '',
    wholesale_price: '',
    stock_quantity: '',
    low_stock_threshold: '10',
    allowOtherSellers: true,
    has_variants: false,
    // Legacy weight column — kept for backward compat, mirrored to weight_kg
    weight: '',
    // New per-product fields for Terminal Africa
    weight_kg: '',
    hs_code: '',
    product_type: 'parcel' as 'parcel' | 'document',
    dimensions: { length: '', width: '', height: '' },
    is_active: true,
  });

  // Fetch existing product data
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;
      try {
        const { data, error } = await productService.getProduct(productId);
        if (error) throw error;
        if (data) {
          // Resolve weight_kg: prefer the new column, fall back to legacy weight
          const resolvedWeightKg =
            (data as any).weight_kg != null
              ? String((data as any).weight_kg)
              : data.weight != null
              ? String(data.weight)
              : '';

          setFormData({
            name:                data.name || '',
            description:         data.description || '',
            niche:               data.niche || '',
            category:            data.category || '',
            subcategory:         data.subcategory || '',
            cost_price:          data.cost_price?.toString() || '',
            selling_price:       data.selling_price?.toString() || '',
            dropship_price:      data.dropship_price?.toString() || '',
            wholesale_price:     data.wholesale_price?.toString() || '',
            stock_quantity:      data.stock_quantity?.toString() || '',
            low_stock_threshold: data.low_stock_threshold?.toString() || '10',
            allowOtherSellers:   data.is_importable ?? true,
            has_variants:        data.has_variants || false,
            weight:              data.weight?.toString() || '',
            weight_kg:           resolvedWeightKg,
            hs_code:             (data as any).hs_code || '',
            product_type:        (data as any).product_type || 'parcel',
            dimensions:          data.dimensions || { length: '', width: '', height: '' },
            is_active:           data.is_active ?? true,
          });
          setImages(Array.isArray(data.images) ? data.images : []);
          if (data.variants && Array.isArray(data.variants)) {
            setVariants(data.variants);
          }
        }
      } catch (err) {
        console.error('[EditProduct] Fetch error:', err);
        toast.error('Failed to load product');
        navigate('/dashboard/products');
      }
      setIsFetching(false);
    };
    fetchProduct();
  }, [productId, navigate]);

  const allowedNiches = currentStore?.niches || [];
  const selectedNicheCategories = formData.niche ? getNicheCategories(formData.niche) : [];
  const selectedCategorySubcategories = formData.niche && formData.category
    ? getSubcategories(formData.niche, formData.category)
    : [];

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const validateForm = () => {
    if (!formData.name || !formData.selling_price) {
      toast.error('Please fill in all required fields');
      return false;
    }
    if (!formData.niche || !formData.category) {
      toast.error('Please select a niche and category');
      return false;
    }
    if (!allowedNiches.includes(formData.niche)) {
      toast.error(`This product's niche is not in your current subscription.`);
      return false;
    }
    const sp = parseFloat(formData.selling_price);
    const dp = parseFloat(formData.dropship_price) || 0;
    const wp = parseFloat(formData.wholesale_price) || 0;
    if (dp > 0 && dp >= sp) {
      toast.error('Dropship price must be lower than selling price');
      return false;
    }
    if (wp > 0 && wp >= sp) {
      toast.error('Wholesale price must be lower than selling price');
      return false;
    }
    // Weight is required when store uses Terminal Africa delivery
    if (isTerminalStore && !formData.weight_kg) {
      toast.error('Product weight is required for Terminal Africa delivery');
      return false;
    }
    if (formData.weight_kg && parseFloat(formData.weight_kg) <= 0) {
      toast.error('Weight must be greater than 0');
      return false;
    }
    // HS code format check: 4 or 6 digits if provided
    if (formData.hs_code && !/^\d{4}(\d{2})?$/.test(formData.hs_code.trim())) {
      toast.error('HS Code must be exactly 4 or 6 digits (numbers only)');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !productId) return;
    setIsLoading(true);
    try {
      const stockQty = parseInt(formData.stock_quantity) || 0;
      const totalVariantStock = formData.has_variants && variants.length > 0
        ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : stockQty;

      const weightKgParsed = formData.weight_kg ? parseFloat(formData.weight_kg) : null;

      const { error } = await productService.updateProduct(productId, {
        name:               formData.name,
        description:        formData.description,
        category:           formData.category,
        subcategory:        formData.subcategory || null,
        niche:              formData.niche,
        cost_price:         parseFloat(formData.cost_price) || 0,
        selling_price:      parseFloat(formData.selling_price),
        dropship_price:     parseFloat(formData.dropship_price) || 0,
        wholesale_price:    parseFloat(formData.wholesale_price) || 0,
        stock_quantity:     formData.has_variants ? totalVariantStock : stockQty,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        is_out_of_stock:    formData.has_variants ? totalVariantStock === 0 : stockQty === 0,
        images,
        is_importable:      formData.allowOtherSellers,
        has_variants:       formData.has_variants,
        variants:           formData.has_variants ? variants : [],
        // Keep legacy weight in sync with weight_kg for backward compat
        weight:             weightKgParsed,
        // New Terminal Africa fields
        weight_kg:          weightKgParsed,
        hs_code:            formData.hs_code.trim() || null,
        product_type:       formData.product_type,
        dimensions:         (formData.dimensions.length || formData.dimensions.width || formData.dimensions.height)
          ? {
              length: parseFloat(formData.dimensions.length) || 0,
              width:  parseFloat(formData.dimensions.width)  || 0,
              height: parseFloat(formData.dimensions.height) || 0,
            }
          : null,
        is_active:          formData.is_active,
      });

      if (error) throw error;
      toast.success('Product updated successfully!');
      navigate('/dashboard/products');
    } catch (err) {
      console.error('[EditProduct] Update error:', err);
      toast.error('Failed to update product');
    }
    setIsLoading(false);
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this product? This cannot be undone.')) return;
    try {
      const { error } = await productService.deleteProduct(productId!);
      if (error) throw error;
      toast.success('Product deleted');
      navigate('/dashboard/products');
    } catch {
      toast.error('Failed to delete product');
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard/products')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Product</h1>
            <p className="text-gray-500 mt-1">Update your product details</p>
          </div>
        </div>
        <button onClick={handleDelete} className="flex items-center gap-2 text-red-500 hover:text-red-700 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Delete Product</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">

        {/* Basic Information */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Basic Information</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-h-[120px] transition-colors"
              />
            </div>
          </div>
        </motion.div>

        {/* Category & Niche */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Category & Niche *
            <InfoTip text="Niche is the broad market your product belongs to. Category is the specific type within that niche." />
          </h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Niche <span className="text-orange-500">*</span>
              </label>
              <select
                value={formData.niche}
                onChange={e => setFormData({ ...formData, niche: e.target.value, category: '', subcategory: '' })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                required
              >
                <option value="">Select a niche...</option>
                {allowedNiches.map(nicheId => {
                  const niche = CONFIG.NICHES.find((n: any) => n.id === nicheId);
                  return <option key={nicheId} value={nicheId}>{niche?.name || nicheId}</option>;
                })}
              </select>
            </div>

            {formData.niche && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category <span className="text-orange-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value, subcategory: '' })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                  required
                >
                  <option value="">Select a category...</option>
                  {selectedNicheCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
            )}

            {formData.category && selectedCategorySubcategories.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subcategory (Optional)</label>
                <select
                  value={formData.subcategory}
                  onChange={e => setFormData({ ...formData, subcategory: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                >
                  <option value="">Select a subcategory...</option>
                  {selectedCategorySubcategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                </select>
              </div>
            )}
          </div>
        </motion.div>

        {/* Product Images */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Product Images</h2>
          <p className="text-sm text-gray-500 mb-6">Upload up to 5 images. The first image is shown as the main product photo.</p>
          <MultiImageUpload value={images} onChange={setImages} maxImages={5} />
        </motion.div>

        {/* Pricing */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Pricing</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cost Price (₦)
                <InfoTip text="What you personally paid to get this product. Used only for your profit calculations — customers never see this." />
              </label>
              <input
                type="number"
                value={formData.cost_price}
                onChange={e => setFormData({ ...formData, cost_price: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                placeholder="0.00"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selling Price (₦) <span className="text-orange-500">*</span>
                <InfoTip text="The price customers will pay when they buy this product from your store." />
              </label>
              <input
                type="number"
                value={formData.selling_price}
                onChange={e => setFormData({ ...formData, selling_price: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                placeholder="0.00"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dropship Price (₦)
                <InfoTip text="The price other sellers pay you when they sell this product from their own store. Must be lower than your selling price." />
              </label>
              <input
                type="number"
                value={formData.dropship_price}
                onChange={e => setFormData({ ...formData, dropship_price: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                placeholder="0.00"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wholesale Price (₦)
                <InfoTip text="A discounted price for customers buying in large quantities. Leave blank if you don't offer bulk discounts." />
              </label>
              <input
                type="number"
                value={formData.wholesale_price}
                onChange={e => setFormData({ ...formData, wholesale_price: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                placeholder="0.00"
                min="0"
              />
            </div>
          </div>
        </motion.div>

        {/* Variants */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-1">
                Product Variants
                <InfoTip text="Enable variants if your product comes in different options — like different sizes or colours. Each combination gets its own price and stock level." />
              </h2>
              <p className="text-sm text-gray-500">Add size, colour, or other options</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.has_variants}
                onChange={e => setFormData({ ...formData, has_variants: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Enable Variants</span>
            </label>
          </div>
          {formData.has_variants && (
            <div className="mt-6">
              <VariantManager
                variants={variants}
                onChange={setVariants}
                basePrice={parseFloat(formData.selling_price) || 0}
              />
            </div>
          )}
        </motion.div>

        {/* Inventory & Shipping */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Inventory & Shipping</h2>

          {/* Stock */}
          <div className="grid sm:grid-cols-2 gap-6 mb-6">
            {!formData.has_variants && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Quantity <span className="text-orange-500">*</span>
                  <InfoTip text="How many units of this product you currently have available to sell." />
                </label>
                <input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={e => setFormData({ ...formData, stock_quantity: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                  placeholder="0"
                  min="0"
                  required={!formData.has_variants}
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Low Stock Alert Threshold
                <InfoTip text="You'll receive a notification when your stock falls to or below this number." />
              </label>
              <input
                type="number"
                value={formData.low_stock_threshold}
                onChange={e => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                placeholder="10"
                min="1"
              />
            </div>
          </div>

          {/* Terminal Africa banner — shown when store uses terminal delivery */}
          {isTerminalStore && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-start gap-3">
              <Info className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800">
                Your store uses <strong>Terminal Africa</strong> delivery. Weight is required
                and dimensions are strongly recommended so customers get accurate carrier rates
                at checkout.
              </p>
            </div>
          )}

          {/* Weight & Dimensions */}
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Weight (kg)
                {isTerminalStore
                  ? <span className="text-orange-500"> *</span>
                  : <span className="text-gray-400 font-normal"> — Optional</span>
                }
                <InfoTip text="The weight of this product in kilograms. Required for Terminal Africa to calculate delivery rates. Example: a pair of shoes is roughly 0.8 kg." />
              </label>
              <input
                type="number"
                value={formData.weight_kg}
                onChange={e => setFormData({ ...formData, weight_kg: e.target.value, weight: e.target.value })}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors ${
                  isTerminalStore && !formData.weight_kg
                    ? 'border-orange-300 bg-orange-50'
                    : 'border-gray-200'
                }`}
                placeholder="e.g. 0.8"
                min="0.01"
                step="0.01"
                required={isTerminalStore}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dimensions (cm) <span className="text-gray-400 font-normal">— Optional</span>
                <InfoTip text="Length × Width × Height in centimetres. Used by Terminal Africa for volumetric weight calculation on larger items." />
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={formData.dimensions.length}
                  onChange={e => setFormData({ ...formData, dimensions: { ...formData.dimensions, length: e.target.value } })}
                  placeholder="L"
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                  min="0"
                />
                <input
                  type="number"
                  value={formData.dimensions.width}
                  onChange={e => setFormData({ ...formData, dimensions: { ...formData.dimensions, width: e.target.value } })}
                  placeholder="W"
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                  min="0"
                />
                <input
                  type="number"
                  value={formData.dimensions.height}
                  onChange={e => setFormData({ ...formData, dimensions: { ...formData.dimensions, height: e.target.value } })}
                  placeholder="H"
                  className="w-full px-3 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors"
                  min="0"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Length × Width × Height in cm</p>
            </div>
          </div>

          {/* HS Code + Product Type — always visible, context-relevant */}
          <div className="grid sm:grid-cols-2 gap-6 mt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HS Code <span className="text-gray-400 font-normal">— Optional</span>
                <InfoTip text="Harmonised System code for customs classification. 4 or 6 digits. Example: 6403 for footwear, 8471 for computers. Required for international shipping via Terminal Africa. Find yours at trade.gov/harmonized-system-tariff-codes" />
              </label>
              <input
                type="text"
                value={formData.hs_code}
                onChange={e => {
                  // Allow only digits, max 6 characters
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setFormData({ ...formData, hs_code: val });
                }}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-colors font-mono tracking-widest"
                placeholder="e.g. 640399"
                maxLength={6}
                inputMode="numeric"
              />
              {formData.hs_code && formData.hs_code.length !== 4 && formData.hs_code.length !== 6 && (
                <p className="text-xs text-amber-600 mt-1">HS Code must be 4 or 6 digits</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Type
                <InfoTip text="Physical products are 'Parcel'. Use 'Document' only for printed papers, certificates, or letters. This affects how Terminal Africa classifies your shipment." />
              </label>
              <select
                value={formData.product_type}
                onChange={e => setFormData({ ...formData, product_type: e.target.value as 'parcel' | 'document' })}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white transition-colors"
              >
                <option value="parcel">Physical Product (Parcel)</option>
                <option value="document">Document</option>
              </select>
            </div>
          </div>

          {/* Active toggle */}
          <div className="mt-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-gray-700 font-medium">Product is active and visible to customers</span>
            </label>
          </div>
        </motion.div>

        {/* Settings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Settings</h2>
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={formData.allowOtherSellers}
              onChange={e => setFormData({ ...formData, allowOtherSellers: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 mt-0.5"
            />
            <div>
              <span className="font-medium text-gray-900 block">
                Allow other sellers to help sell this product
                <InfoTip text="When enabled, other store owners can import this product into their own store. You still handle all fulfilment — they just promote it and earn a share of the dropship margin you set above." />
              </span>
              <span className="text-sm text-gray-500">Other stores can import and list your product. You fulfil all orders.</span>
            </div>
          </label>
        </motion.div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4 sticky bottom-0 bg-gray-50/80 backdrop-blur-sm p-4 -mx-4 rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => navigate('/dashboard/products')}
            className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Cancel
          </button>
          <Button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 h-12"
            disabled={isLoading}
          >
            {isLoading
              ? <Loader2 className="w-5 h-5 animate-spin" />
              : <><Check className="w-5 h-5 mr-2" />Save Changes</>
            }
          </Button>
        </div>
      </form>
    </div>
  );
}
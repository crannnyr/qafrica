import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore, useAuthStore } from '@/stores';
import { toast } from 'sonner';
import { productService } from '@/services/supabase';
import { EMPTY_FORM } from '../AddProduct/constants';
import { Step1Basics } from '../AddProduct/components/steps/Step1Basics';
import { Step2Images } from '../AddProduct/components/steps/Step2Images';
import { Step3Pricing } from '../AddProduct/components/steps/Step3Pricing';
import { Step4Variants } from '../AddProduct/components/steps/Step4Variants';
import { Step5Shipping } from '../AddProduct/components/steps/Step5Shipping';
import { Step6SEO } from '../AddProduct/components/steps/Step6SEO';
import { useEditProductForm } from './hooks/useEditProductForm';
import type { VariantCombination } from '../AddProduct/types';

export default function EditProductPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentStore } = useStoreStore();

  const [isFetching, setIsFetching] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantCombination[]>([]);
  const [formData, setFormData] = useState({ ...EMPTY_FORM });

  const allowedNiches = currentStore?.niches || [];
  const isTerminalMode = currentStore?.delivery_mode === 'terminal';

  const set = (patch: Partial<typeof EMPTY_FORM>) =>
    setFormData(prev => ({ ...prev, ...patch }));

  // Load existing product
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;
      try {
        const { data, error } = await productService.getProduct(productId);
        if (error) throw error;
        if (data) {
          const resolvedWeightKg =
            (data as any).weight_kg != null ? String((data as any).weight_kg) :
            data.weight != null ? String(data.weight) : '';

          setFormData({
            ...EMPTY_FORM,
            name:                data.name || '',
            description:         data.description || '',
            niche:               data.niche || '',
            category:            data.category || '',
            subcategory:         data.subcategory || '',
            cost_price:          data.cost_price?.toString() || '',
            selling_price:       data.selling_price?.toString() || '',
            compare_at_price:    (data as any).compare_at_price?.toString() || '',
            dropship_price:      data.dropship_price?.toString() || '',
            wholesale_price:     data.wholesale_price?.toString() || '',
            stock_quantity:      data.stock_quantity?.toString() || '',
            sku:                 (data as any).sku || '',
            barcode:             (data as any).barcode || '',
            low_stock_threshold: data.low_stock_threshold?.toString() || '10',
            allowOtherSellers:   data.is_importable ?? true,
            has_variants:        data.has_variants || false,
            weight_kg:           resolvedWeightKg,
            weight:              data.weight?.toString() || '',
            hs_code:             (data as any).hs_code || '',
            product_type:        (data as any).product_type || 'parcel',
            dimensions:          data.dimensions || { length: '', width: '', height: '' },
            seo_title:           (data as any).seo_title || '',
            seo_description:     (data as any).seo_description || '',
            is_active:           data.is_active ?? true,
          });
          setImages(Array.isArray(data.images) ? data.images : []);
          if (Array.isArray(data.variants)) setVariants(data.variants);
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

  const { isLoading, handleSubmit, handleDelete } = useEditProductForm({
    productId, formData, images, variants, currentStore, navigate,
  });

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const stepProps = { formData, set, currentStore, allowedNiches };

  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard/products')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Edit Product</h1>
            <p className="text-xs text-gray-400 mt-0.5">Update your product details</p>
          </div>
        </div>
        <button onClick={() => handleDelete(variants)}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <Step1Basics {...stepProps} />
        <Step2Images images={images} onChange={setImages} />
        <Step3Pricing {...stepProps} />
        <Step4Variants formData={formData} set={set} variants={variants} setVariants={setVariants} />
        <Step5Shipping {...stepProps} isTerminalMode={isTerminalMode} />
        <Step6SEO {...stepProps} />
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 py-4 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <button type="button" onClick={() => navigate('/dashboard/products')}
            className="px-5 py-3 text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors hover:bg-gray-100 rounded-xl">
            Cancel
          </button>
          <Button type="button" onClick={() => handleSubmit(variants)} disabled={isLoading}
            className="flex items-center gap-2 px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl h-11">
            {isLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              : <><Check className="w-4 h-4" /> Save Changes</>
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
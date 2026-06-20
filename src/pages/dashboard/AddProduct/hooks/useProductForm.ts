import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { productService } from '@/services';
import { processEmailQueue } from '@/services/email';
import { STEPS } from '../constants';
import type { VariantCombination } from '../types';

interface UseProductFormProps {
  formData: any;
  images: string[];
  variants: VariantCombination[];
  step: number;
  setStep: (step: number) => void;
  currentStore: any;
  user: any;
  set: (patch: any) => void;
}

export function useProductForm({
  formData, images, variants, step, setStep, currentStore, user,
}: UseProductFormProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const isTerminalMode = currentStore?.delivery_mode === 'terminal';

  const validateStep = (s: number): boolean => {
    switch (s) {
      case 1:
        if (!formData.name.trim())  { toast.error('Product name is required'); return false; }
        if (!formData.niche)        { toast.error('Please select a niche'); return false; }
        if (!formData.category)     { toast.error('Please select a category'); return false; }
        if (!currentStore?.niches?.includes(formData.niche)) {
          toast.error(`Your subscription doesn't include the "${formData.niche}" niche`);
          return false;
        }
        return true;
      case 2:
        return true;
      case 3:
        if (!formData.selling_price) { toast.error('Selling price is required'); return false; }
        const sp = parseFloat(formData.selling_price);
        const dp = parseFloat(formData.dropship_price) || 0;
        const wp = parseFloat(formData.wholesale_price) || 0;
        const cp = parseFloat(formData.compare_at_price) || 0;
        if (dp > 0 && dp >= sp) { toast.error('Dropship price must be lower than selling price'); return false; }
        if (wp > 0 && wp >= sp) { toast.error('Wholesale price must be lower than selling price'); return false; }
        if (cp > 0 && cp <= sp) { toast.error('Compare-at price should be higher than selling price'); return false; }
        return true;
      case 4:
        if (formData.has_variants && variants.length === 0) {
          toast.error('Please generate at least one variant combination');
          return false;
        }
        return true;
      case 5:
        if (isTerminalMode && !formData.weight_kg) { toast.error('Weight is required for Terminal Africa delivery'); return false; }
        if (formData.weight_kg && parseFloat(formData.weight_kg) <= 0) { toast.error('Weight must be greater than 0'); return false; }
        if (formData.hs_code && !/^\d{4}(\d{2})?$/.test(formData.hs_code.trim())) { toast.error('HS Code must be exactly 4 or 6 digits'); return false; }
        if (!formData.has_variants && (!formData.stock_quantity || parseInt(formData.stock_quantity) < 0)) {
          toast.error('Please enter a valid stock quantity'); return false;
        }
        return true;
      case 6:
        return true;
      default:
        return true;
    }
  };

  const handleSubmit = async (variants: VariantCombination[]) => {
    for (let s = 1; s <= STEPS.length; s++) {
      if (!validateStep(s)) { setStep(s); return; }
    }
    if (!currentStore?.id || !user?.id) { toast.error('Store or user not found'); return; }

    setIsLoading(true);
    try {
      const totalStock = formData.has_variants && variants.length > 0
        ? variants.reduce((sum: number, v: VariantCombination) => sum + (v.stock || 0), 0)
        : parseInt(formData.stock_quantity) || 0;

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

      processEmailQueue().catch(() => {});
      toast.success('Product added successfully!');
      navigate('/dashboard/products');
    } catch (err) {
      console.error('[AddProduct] Error:', err);
      toast.error('Failed to add product. Please try again.');
    }
    setIsLoading(false);
  };

  return { isLoading, validateStep, handleSubmit };
}
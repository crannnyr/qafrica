import { useState } from 'react';
import { toast } from 'sonner';
import { productService } from '@/services/supabase';
import type { VariantCombination } from '../../AddProduct/types';

interface UseEditProductFormProps {
  productId: string | undefined;
  formData: any;
  images: string[];
  variants: VariantCombination[];
  currentStore: any;
  navigate: (path: string) => void;
}

export function useEditProductForm({
  productId, formData, images, currentStore, navigate,
}: UseEditProductFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isTerminalMode = currentStore?.delivery_mode === 'terminal';

  const validate = (): boolean => {
    if (!formData.name.trim())    { toast.error('Product name is required'); return false; }
    if (!formData.selling_price)  { toast.error('Selling price is required'); return false; }
    if (!formData.niche)          { toast.error('Please select a niche'); return false; }
    if (!formData.category)       { toast.error('Please select a category'); return false; }
    if (!currentStore?.niches?.includes(formData.niche)) {
      toast.error(`This product's niche is not in your current subscription`); return false;
    }
    const sp = parseFloat(formData.selling_price);
    const dp = parseFloat(formData.dropship_price) || 0;
    const wp = parseFloat(formData.wholesale_price) || 0;
    const cp = parseFloat(formData.compare_at_price) || 0;
    if (dp > 0 && dp >= sp) { toast.error('Dropship price must be lower than selling price'); return false; }
    if (wp > 0 && wp >= sp) { toast.error('Wholesale price must be lower than selling price'); return false; }
    if (cp > 0 && cp <= sp) { toast.error('Compare-at price must be higher than selling price'); return false; }
    if (isTerminalMode && !formData.weight_kg) { toast.error('Weight is required for Terminal Africa delivery'); return false; }
    if (formData.weight_kg && parseFloat(formData.weight_kg) <= 0) { toast.error('Weight must be greater than 0'); return false; }
    if (formData.hs_code && !/^\d{4}(\d{2})?$/.test(formData.hs_code.trim())) { toast.error('HS Code must be 4 or 6 digits'); return false; }
    return true;
  };

  const handleSubmit = async (variants: VariantCombination[]) => {
    if (!validate() || !productId) return;
    setIsLoading(true);

    try {
      const stockQty = parseInt(formData.stock_quantity) || 0;
      const totalStock = formData.has_variants && variants.length > 0
        ? variants.reduce((sum, v) => sum + (v.stock || 0), 0)
        : stockQty;

      const weightKg = formData.weight_kg ? parseFloat(formData.weight_kg) : null;

      const { error } = await productService.updateProduct(productId, {
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
        sku:                 formData.sku?.trim() || undefined,
        barcode:             formData.barcode?.trim() || undefined,
        images,
        is_importable:       formData.allowOtherSellers,
        has_variants:        formData.has_variants,
        variants:            formData.has_variants ? variants : [],
        weight:              weightKg ?? undefined,
        weight_kg:           weightKg,
        hs_code:             formData.hs_code?.trim() || null,
        product_type:        formData.product_type,
        dimensions:
          formData.dimensions.length || formData.dimensions.width || formData.dimensions.height
            ? {
                length: parseFloat(formData.dimensions.length) || 0,
                width:  parseFloat(formData.dimensions.width)  || 0,
                height: parseFloat(formData.dimensions.height) || 0,
              }
            : undefined,
        seo_title:       formData.seo_title?.trim() || undefined,
        seo_description: formData.seo_description?.trim() || undefined,
        is_active:       formData.is_active,
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

  const handleDelete = async (variants: VariantCombination[]) => {
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

  return { isLoading, handleSubmit, handleDelete };
}
import { supabase } from './supabase';
import type { Product, ImportCatalogItem } from '@/types';

export const productService = {
  async createProduct(productData: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();
    return { data, error };
  },

  async getProduct(productId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
    return { data, error };
  },

  async getStoreProducts(storeId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getProductsByNiche(niche: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('niche', niche)
      .eq('is_importable', true)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async updateProduct(productId: string, updates: Partial<Product>) {
    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)
      .select()
      .single();
    return { data, error };
  },

  async deleteProduct(productId: string) {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);
    return { error };
  },

  async getAllProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },
};

export const importCatalogService = {
  async importProduct(importData: Partial<ImportCatalogItem>) {
    const { data, error } = await supabase
      .from('import_catalog')
      .insert(importData)
      .select()
      .single();
    return { data, error };
  },

  async getStoreImports(storeId: string) {
    const { data, error } = await supabase
      .from('import_catalog')
      .select('*, original_product:products(*)')
      .eq('importer_store_id', storeId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getAvailableProducts(niche: string, excludeStoreId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('niche', niche)
      .eq('is_importable', true)
      .neq('store_id', excludeStoreId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getAvailableProductsByNiches(niches: string[], excludeStoreId: string) {
    if (niches.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('products')
      .select('*, store:stores(group_chat_url)')
      .in('niche', niches)
      .eq('is_importable', true)
      .neq('store_id', excludeStoreId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getAvailableProductsExcludingNiches(excludeNiches: string[], excludeStoreId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*, store:stores(group_chat_url)')
      .not('niche', 'in', `(${excludeNiches.join(',')})`)
      .eq('is_importable', true)
      .neq('store_id', excludeStoreId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async getAllAvailableProducts(excludeStoreId: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*, store:stores(group_chat_url)')
      .eq('is_importable', true)
      .neq('store_id', excludeStoreId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async updateImport(importId: string, updates: Partial<ImportCatalogItem>) {
    const { data, error } = await supabase
      .from('import_catalog')
      .update(updates)
      .eq('id', importId)
      .select()
      .single();
    return { data, error };
  },

  async deleteImport(importId: string) {
    const { error } = await supabase
      .from('import_catalog')
      .delete()
      .eq('id', importId);
    return { error };
  },
};
import { supabase } from './supabase';
import type { Review, ReviewSummary } from '@/types';

export const reviewService = {
  async createReview(reviewData: Partial<Review>) {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        ...reviewData,
        is_approved: false,
        helpful_count: 0,
        unhelpful_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    return { data, error };
  },

  async getProductReviews(productId: string, options?: {
    approvedOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('reviews')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (options?.approvedOnly !== false) query = query.eq('is_approved', true);
    if (options?.limit)  query = query.limit(options.limit);
    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

    const { data, error } = await query;
    return { data, error };
  },

  async getStoreReviews(storeId: string, options?: {
    approvedOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('reviews')
      .select('*, product:products(name, images)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false });

    if (options?.approvedOnly !== false) query = query.eq('is_approved', true);
    if (options?.limit)  query = query.limit(options.limit);
    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 10) - 1);

    const { data, error } = await query;
    return { data, error };
  },

  async getPendingReviews(storeId: string) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, product:products(name, images)')
      .eq('store_id', storeId)
      .eq('is_approved', false)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async approveReview(reviewId: string) {
    const { data, error } = await supabase
      .from('reviews')
      .update({ is_approved: true, updated_at: new Date().toISOString() })
      .eq('id', reviewId)
      .select()
      .single();
    return { data, error };
  },

  async rejectReview(reviewId: string) {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);
    return { error };
  },

  async respondToReview(reviewId: string, response: string) {
    const { data, error } = await supabase
      .from('reviews')
      .update({
        admin_response: response,
        admin_responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select()
      .single();
    return { data, error };
  },

  async markHelpful(reviewId: string) {
    const { data, error } = await supabase
      .rpc('increment_review_helpful', { review_id: reviewId });
    return { data, error };
  },

  async markUnhelpful(reviewId: string) {
    const { data, error } = await supabase
      .rpc('increment_review_unhelpful', { review_id: reviewId });
    return { data, error };
  },

  async getProductReviewSummary(productId: string): Promise<{ data: ReviewSummary | null; error: any }> {
    try {
      const { data, error } = await supabase
        .rpc('get_product_review_summary', { p_product_id: productId });
      if (error) throw error;
      return { data: data?.[0] || null, error: null };
    } catch (error) {
      return {
        data: {
          product_id: productId,
          average_rating: 0,
          total_reviews: 0,
          five_star: 0, four_star: 0, three_star: 0, two_star: 0, one_star: 0,
        },
        error,
      };
    }
  },

  async getStoreReviewStats(storeId: string) {
    try {
      const { data, error } = await supabase
        .rpc('get_store_review_stats', { p_store_id: storeId });
      if (error) throw error;
      return {
        data: data?.[0] || { total_reviews: 0, average_rating: 0, pending_reviews: 0 },
        error: null,
      };
    } catch (error) {
      return {
        data: { total_reviews: 0, average_rating: 0, pending_reviews: 0 },
        error,
      };
    }
  },

  async canCustomerReview(productId: string, customerEmail: string) {
    const { data, error } = await supabase
      .rpc('can_customer_review', {
        p_product_id: productId,
        p_customer_email: customerEmail,
      });
    return { canReview: data || false, error };
  },
};
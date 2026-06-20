// File: /src/components/Reviews.tsx

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ThumbsUp, ThumbsDown, MessageCircle, Check, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase, reviewService } from '@/services';
import { useCustomerAuthStore } from '@/stores'; // NEW: Import auth store
import { toast } from 'sonner';
import type { Review, ReviewSummary } from '@/types';

interface ReviewsProps {
  productId: string;
  storeId: string;
}

export default function Reviews({ productId, storeId }: ReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewCount, setReviewCount] = useState(0); // NEW: Track review count
  
  // NEW: Get customer auth state
  const { customer, isAuthenticated } = useCustomerAuthStore();
  
  const [newReview, setNewReview] = useState({
    rating: 5,
    title: '',
    content: '',
    customer_name: '',
    customer_email: '',
  });

  useEffect(() => {
    loadReviews();
  }, [productId]);

  // NEW: Auto-populate customer data when form opens
  useEffect(() => {
    if (showReviewForm && customer) {
      setNewReview(prev => ({
        ...prev,
        customer_name: customer.full_name,
        customer_email: customer.email,
      }));
    }
  }, [showReviewForm, customer]);

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      // Two parallel calls: approved for display, all (including pending) for counting
      const [{ data: reviewsData }, { data: allReviewsData }, { data: summaryData }] = await Promise.all([
        reviewService.getProductReviews(productId, { approvedOnly: true }),
        reviewService.getProductReviews(productId, { approvedOnly: false }),
        reviewService.getProductReviewSummary(productId),
      ]);

      setReviews(reviewsData || []);
      setSummary(summaryData);
      
      // Count customer's existing reviews from all reviews (including pending)
      if (customer) {
        const customerReviews = (allReviewsData || []).filter(r => 
          r.customer_email === customer.email || r.customer_id === customer.id
        );
        setReviewCount(customerReviews.length);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newReview.content.trim()) {
      toast.error('Please write a review');
      return;
    }

    // Check can_customer_review RPC before inserting
    try {
      const { data: canReview, error: rpcError } = await supabase.rpc('can_customer_review', {
        p_product_id: productId,
        p_customer_email: newReview.customer_email
      });

      if (rpcError) throw rpcError;

      if (!canReview) {
        toast.error('You have already submitted the maximum of 2 reviews for this product');
        return;
      }
    } catch (error: any) {
      toast.error('Failed to verify review eligibility');
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      const reviewData: any = {
        product_id: productId,
        store_id: storeId,
        ...newReview,
      };

      // Only set customer_id if session matches customer.id
      if (customer && sessionData.session?.user?.id === customer.id) {
        reviewData.customer_id = customer.id;
        reviewData.customer_avatar_url = customer.avatar_url;
      }

      const { error } = await reviewService.createReview(reviewData);

      if (error) throw error;

      toast.success('Review submitted! It will be visible after approval.');
      setShowReviewForm(false);
      setNewReview({
        rating: 5,
        title: '',
        content: '',
        customer_name: '',
        customer_email: '',
      });
      loadReviews(); // Refresh to show new review count
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit review');
    }
  };

  const handleMarkHelpful = async (reviewId: string) => {
    try {
      await reviewService.markHelpful(reviewId);
      setReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, helpful_count: r.helpful_count + 1 } : r
      ));
      toast.success('Thanks for your feedback');
    } catch (error) {
      console.error('Error marking helpful:', error);
      toast.error('Failed to record feedback');
    }
  };

  const handleMarkUnhelpful = async (reviewId: string) => {
    try {
      await reviewService.markUnhelpful(reviewId);
      setReviews(prev => prev.map(r =>
        r.id === reviewId ? { ...r, unhelpful_count: r.unhelpful_count + 1 } : r
      ));
      toast.success('Thanks for your feedback');
    } catch (error) {
      console.error('Error marking unhelpful:', error);
      toast.error('Failed to record feedback');
    }
  };

  const renderStars = (rating: number, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClass = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    }[size];

    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header with Summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Customer Reviews
          </h3>
          {summary && summary.total_reviews > 0 && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-2">
                {renderStars(Math.round(summary.average_rating))}
                <span className="font-medium text-gray-900 dark:text-white">
                  {summary.average_rating.toFixed(1)}
                </span>
              </div>
              <span className="text-gray-500 dark:text-gray-400">
                Based on {summary.total_reviews} review{summary.total_reviews !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        
        {/* Conditional button based on auth and review limit */}
        {!showReviewForm && (
          <div className="flex flex-col items-end gap-2">
            {!isAuthenticated ? (
              <Button
                onClick={() => window.location.href = '/customer/login'}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                Login to Review
              </Button>
            ) : reviewCount >= 2 ? (
              <div className="text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                You have submitted the maximum of 2 reviews
              </div>
            ) : (
              <Button
                onClick={() => setShowReviewForm(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Write a Review ({2 - reviewCount} remaining)
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Rating Breakdown */}
      {summary && summary.total_reviews > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6">
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = summary[`${['one', 'two', 'three', 'four', 'five'][rating - 1]}_star` as keyof ReviewSummary] as number || 0;
              const percentage = summary.total_reviews > 0
                ? (count / summary.total_reviews) * 100
                : 0;

              return (
                <div key={rating} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-12">
                    {rating} star{rating !== 1 ? 's' : ''}
                  </span>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review Form */}
      <AnimatePresence>
        {showReviewForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6"
          >
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
              Write Your Review {customer && `- ${customer.full_name}`}
            </h4>
            <form onSubmit={handleSubmitReview} className="space-y-4">
              {/* Rating Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setNewReview(prev => ({ ...prev, rating }))}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          rating <= newReview.rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'fill-gray-200 text-gray-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Email - Pre-filled and read-only if authenticated */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newReview.customer_name}
                    onChange={(e) => setNewReview(prev => ({ ...prev, customer_name: e.target.value }))}
                    readOnly={isAuthenticated}
                    className={`w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none ${
                      isAuthenticated ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Your Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newReview.customer_email}
                    onChange={(e) => setNewReview(prev => ({ ...prev, customer_email: e.target.value }))}
                    readOnly={isAuthenticated}
                    className={`w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none ${
                      isAuthenticated ? 'bg-gray-100 cursor-not-allowed' : ''
                    }`}
                    placeholder="john@example.com"
                  />
                </div>
              </div>

              {/* Review Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Review Title
                </label>
                <input
                  type="text"
                  value={newReview.title}
                  onChange={(e) => setNewReview(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Summarize your experience"
                />
              </div>

              {/* Review Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Your Review *
                </label>
                <textarea
                  required
                  rows={4}
                  value={newReview.content}
                  onChange={(e) => setNewReview(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none resize-none"
                  placeholder="Share your experience with this product..."
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Submit Review
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowReviewForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviews List with Customer Avatar */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No reviews yet
            </h4>
            <p className="text-gray-500 dark:text-gray-400">
              Be the first to review this product!
            </p>
          </div>
        ) : (
          reviews.map((review) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-b dark:border-gray-700 pb-6 last:border-0"
            >
              {/* Review Header with Avatar */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center overflow-hidden">
                    {review.customer_avatar_url ? (
                      <img src={review.customer_avatar_url} alt={review.customer_name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {review.customer_name}
                    </p>
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating, 'sm')}
                      {review.is_verified_purchase && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <Check className="w-3 h-3" />
                          Verified Purchase
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Review Content */}
              {review.title && (
                <h5 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {review.title}
                </h5>
              )}
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                {review.content}
              </p>

              {/* Review Images */}
              {review.images && review.images.length > 0 && (
                <div className="flex gap-2 mb-4">
                  {review.images.map((image, idx) => (
                    <img
                      key={idx}
                      src={image}
                      alt={`Review image ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                  ))}
                </div>
              )}

              {/* Admin Response */}
              {review.admin_response && (
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-200 mb-1">
                    Seller Response
                  </p>
                  <p className="text-sm text-orange-800 dark:text-orange-300">
                    {review.admin_response}
                  </p>
                </div>
              )}

              {/* Helpful Buttons */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleMarkHelpful(review.id)}
                  className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <ThumbsUp className="w-4 h-4" />
                  Helpful ({review.helpful_count})
                </button>
                <button
                  onClick={() => handleMarkUnhelpful(review.id)}
                  className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <ThumbsDown className="w-4 h-4" />
                  Not Helpful ({review.unhelpful_count})
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
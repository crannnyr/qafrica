import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Star, MessageSquare, Check, X, Reply,
  TrendingUp, Users, ThumbsUp, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreStore } from '@/stores';
import { reviewService } from '@/services';
import { toast } from 'sonner';
import type { Review } from '@/types';

interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  pendingReviews: number;
  responseRate: number;
}

export default function ReviewsPage() {
  const { currentStore } = useStoreStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({
    totalReviews: 0,
    averageRating: 0,
    pendingReviews: 0,
    responseRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  useEffect(() => {
    if (currentStore?.id) {
      loadReviews();
    }
  }, [currentStore]);

  // Dynamically calculate stats whenever the reviews array changes
  useEffect(() => {
    if (reviews.length >= 0) {
      const total = reviews.length;
      const pending = reviews.filter(r => !r.is_approved).length;
      const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
      const avgRating = total > 0 ? totalRating / total : 0;
      
      // Calculate response rate based on approved reviews (or all reviews that could be responded to)
      const responded = reviews.filter(r => r.admin_response).length;
      const responseRate = total > 0 ? (responded / total) * 100 : 0;

      setStats({
        totalReviews: total,
        averageRating: avgRating,
        pendingReviews: pending,
        responseRate: responseRate
      });
    }
  }, [reviews]);

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      // Load all reviews and pending reviews in parallel
      // We no longer rely on the backend stats function since we calculate dynamically
      const [
        { data: allReviews },
        { data: pendingData },
      ] = await Promise.all([
        reviewService.getStoreReviews(currentStore!.id, { approvedOnly: false }),
        reviewService.getPendingReviews(currentStore!.id),
      ]);

      setReviews(allReviews || []);
      setPendingReviews(pendingData || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (reviewId: string) => {
    try {
      const { error } = await reviewService.approveReview(reviewId);
      if (error) throw error;

      toast.success('Review approved');
      loadReviews();
    } catch (error) {
      toast.error('Failed to approve review');
    }
  };

  const handleReject = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      const { error } = await reviewService.rejectReview(reviewId);
      if (error) throw error;

      toast.success('Review deleted');
      loadReviews();
    } catch (error) {
      toast.error('Failed to delete review');
    }
  };

  const handleRespond = async (reviewId: string) => {
    if (!responseText.trim()) {
      toast.error('Please enter a response');
      return;
    }

    try {
      const { error } = await reviewService.respondToReview(reviewId, responseText);
      if (error) throw error;

      toast.success('Response added successfully');
      setRespondingTo(null);
      setResponseText('');
      loadReviews();
    } catch (error) {
      toast.error('Failed to add response');
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'fill-gray-200 text-gray-200'
            }`}
          />
        ))}
      </div>
    );
  };

  const displayedReviews = activeTab === 'pending' ? pendingReviews : reviews;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reviews Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage customer reviews and respond to feedback
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Reviews',
            value: stats.totalReviews,
            icon: MessageSquare,
            color: 'bg-blue-500',
          },
          {
            label: 'Average Rating',
            value: stats.averageRating.toFixed(1),
            icon: Star,
            color: 'bg-yellow-500',
          },
          {
            label: 'Pending Approval',
            value: stats.pendingReviews,
            icon: AlertCircle,
            color: 'bg-orange-500',
          },
          {
            label: 'Response Rate',
            value: `${stats.responseRate.toFixed(0)}%`,
            icon: TrendingUp,
            color: 'bg-green-500',
          },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b dark:border-gray-700">
        {[
          { key: 'all', label: 'All Reviews', count: reviews.length },
          { key: 'pending', label: 'Pending Approval', count: pendingReviews.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'all' | 'pending')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {displayedReviews.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-100 dark:border-gray-700">
            <MessageSquare className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {activeTab === 'pending' ? 'No pending reviews' : 'No reviews yet'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === 'pending'
                ? 'All reviews have been approved'
                : 'Reviews will appear here when customers leave feedback'}
            </p>
          </div>
        ) : (
          displayedReviews.map((review, index) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`bg-white dark:bg-gray-800 rounded-xl p-6 border ${
                review.is_approved
                  ? 'border-gray-100 dark:border-gray-700'
                  : 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10'
              }`}
            >
              {/* Review Header */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {review.customer_name}
                      </p>
                      {!review.is_approved && (
                        <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full">
                          Pending Approval
                        </span>
                      )}
                      {review.is_verified_purchase && (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Check className="w-3 h-3" />
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(review.rating)}
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.product && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Product: {review.product.name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!review.is_approved && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(review.id)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(review.id)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}
                  {review.is_approved && !review.admin_response && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setRespondingTo(review.id)}
                    >
                      <Reply className="w-4 h-4 mr-1" />
                      Respond
                    </Button>
                  )}
                </div>
              </div>

              {/* Review Content */}
              {review.title && (
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  {review.title}
                </h4>
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

              {/* Engagement Stats */}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <span className="flex items-center gap-1">
                  <ThumbsUp className="w-4 h-4" />
                  {review.helpful_count} found helpful
                </span>
              </div>

              {/* Admin Response */}
              {review.admin_response && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Your Response
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {review.admin_response}
                  </p>
                  {review.admin_responded_at && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Responded on {new Date(review.admin_responded_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Response Form */}
              {respondingTo === review.id && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Response
                  </label>
                  <textarea
                    rows={3}
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none resize-none mb-3"
                    placeholder="Thank the customer for their feedback..."
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRespond(review.id)}
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      Post Response
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRespondingTo(null);
                        setResponseText('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
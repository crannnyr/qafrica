import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores';
import { subscriptionService } from '@/services';
import type { Subscription } from '@/types';

interface SubscriptionStatus {
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysRemaining: number;
  subscription: Subscription | null;
  loading: boolean;
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const { user } = useAuthStore();
  const [status, setStatus] = useState<SubscriptionStatus>({
    isExpired: false,
    isExpiringSoon: false,
    daysRemaining: 0,
    subscription: null,
    loading: true,
  });

  useEffect(() => {
    checkSubscription();
  }, [user]);

  const checkSubscription = async () => {
    if (!user?.id) {
      setStatus(prev => ({ ...prev, loading: false }));
      return;
    }

    try {
      const { data, error } = await subscriptionService.getUserSubscription(user.id);
      
      if (error || !data) {
        setStatus({
          isExpired: true,
          isExpiringSoon: false,
          daysRemaining: 0,
          subscription: null,
          loading: false,
        });
        return;
      }

      const subscription = data as Subscription;
      const now = new Date();
      const expiresAt = new Date(subscription.expires_at);
      const diffTime = expiresAt.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      setStatus({
        isExpired: diffDays < 0,
        isExpiringSoon: diffDays >= 0 && diffDays <= 3,
        daysRemaining: diffDays > 0 ? diffDays : 0,
        subscription,
        loading: false,
      });
    } catch (err) {
      setStatus({
        isExpired: true,
        isExpiringSoon: false,
        daysRemaining: 0,
        subscription: null,
        loading: false,
      });
    }
  };

  return status;
}
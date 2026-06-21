// src/pages/dashboard/Jumia/JumiaPlanGate.tsx
// Wraps Jumia pages that require an active paid plan. Free-tier users see a clear
// upgrade prompt instead of the feature. Checks subscriptions.tier !== 'free' AND
// is_active AND not expired — not just is_active, since an expired row may not have
// been flipped to inactive yet by a background job.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Crown } from 'lucide-react';
import { supabase } from '@/services';
import { useAuthStore } from '@/stores';

export default function JumiaPlanGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [hasActivePlan, setHasActivePlan] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      setIsChecking(true);
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier, is_active, expires_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .neq('tier', 'free')
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      const stillValid = !!data && (!data.expires_at || new Date(data.expires_at) > new Date());
      if (!error) setHasActivePlan(stillValid);
      setIsChecking(false);
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  if (isChecking) {
    return <div className="p-12 text-center text-gray-400 text-sm">Checking your plan…</div>;
  }

  if (!hasActivePlan) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-6">
        <div className="w-16 h-16 bg-orange-50 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Lock className="w-8 h-8 text-orange-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Upgrade to Use Jumia</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          You're currently on the Free plan. Selling on Jumia is available to stores on an
          active paid plan. Upgrade to get started.
        </p>
        <Link
          to="/dashboard/subscription"
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold transition-colors"
        >
          <Crown className="w-4 h-4" /> View Plans
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}

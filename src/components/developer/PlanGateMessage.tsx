// src/components/developer/PlanGateMessage.tsx
// Shown when a feature requires a higher plan.
// Used by any page or component that needs to gate on plan level.

import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import type { DeveloperPlan } from '@/types/developer';

interface PlanGateMessageProps {
  requiredPlan: DeveloperPlan;
  featureName:  string;
  description?: string;
  compact?:     boolean;  // inline chip vs full card
}

const PLAN_LABELS: Record<DeveloperPlan, string> = {
  free:       'Free',
  starter:    'Starter',
  growth:     'Growth',
  scale:      'Scale',
  enterprise: 'Enterprise',
};

export function PlanGateMessage({
  requiredPlan,
  featureName,
  description,
  compact = false,
}: PlanGateMessageProps) {
  const navigate = useNavigate();

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium
        text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg">
        <Lock className="w-3 h-3" />
        {PLAN_LABELS[requiredPlan]} plan required
      </span>
    );
  }

  return (
    <div className="flex items-start gap-4 p-5 bg-amber-50 border border-amber-200 rounded-2xl">
      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
        <Lock className="w-5 h-5 text-amber-600" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-amber-900 text-sm">
          {featureName} requires the {PLAN_LABELS[requiredPlan]} plan
        </p>
        {description && (
          <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">{description}</p>
        )}
        <button
          onClick={() => navigate('/developer/dashboard/subscription')}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold
            text-amber-800 hover:text-amber-900 underline underline-offset-2 transition-colors"
        >
          Upgrade to {PLAN_LABELS[requiredPlan]} <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default PlanGateMessage;
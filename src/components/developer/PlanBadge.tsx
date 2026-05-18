// src/components/developer/PlanBadge.tsx
import type { DeveloperPlan } from '@/types/developer';

interface PlanBadgeProps {
  plan: DeveloperPlan;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

const PLAN_CONFIG: Record<
  DeveloperPlan,
  { label: string; cls: string; dot: string }
> = {
  free:       { label: 'Free',       cls: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400' },
  starter:    { label: 'Starter',    cls: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  growth:     { label: 'Growth',     cls: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  scale:      { label: 'Scale',      cls: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  enterprise: { label: 'Enterprise', cls: 'bg-gray-900 text-white',        dot: 'bg-white' },
};

export function PlanBadge({ plan, size = 'md', showIcon = false }: PlanBadgeProps) {
  const config = PLAN_CONFIG[plan] ?? PLAN_CONFIG.free;

  const textSize = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${textSize} ${config.cls}`}>
      {showIcon && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      )}
      {config.label}
    </span>
  );
}

export default PlanBadge;
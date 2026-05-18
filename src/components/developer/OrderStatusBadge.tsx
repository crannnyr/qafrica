// src/components/developer/OrderStatusBadge.tsx
import type { DeveloperOrderStatus } from '@/types/developer';

interface OrderStatusBadgeProps {
  status: DeveloperOrderStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<
  DeveloperOrderStatus,
  { label: string; cls: string; dot: string }
> = {
  pending:          { label: 'Pending',          cls: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  confirmed:        { label: 'Confirmed',         cls: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'   },
  processing:       { label: 'Processing',        cls: 'bg-indigo-100 text-indigo-700',dot: 'bg-indigo-500' },
  shipped:          { label: 'Shipped',           cls: 'bg-purple-100 text-purple-700',dot: 'bg-purple-500' },
  out_for_delivery: { label: 'Out for Delivery',  cls: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500' },
  delivered:        { label: 'Delivered',         cls: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  cancelled:        { label: 'Cancelled',         cls: 'bg-red-100 text-red-700',      dot: 'bg-red-500'    },
  refunded:         { label: 'Refunded',          cls: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400'   },
};

export function OrderStatusBadge({ status, size = 'md' }: OrderStatusBadgeProps) {
  const config  = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const padding = size === 'sm'
    ? 'text-xs px-2 py-0.5'
    : 'text-xs px-2.5 py-1';

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${padding} ${config.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
}

export default OrderStatusBadge;
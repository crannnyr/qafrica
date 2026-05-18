// src/components/developer/WebhookEventSelector.tsx
// Multi-select checkbox group for webhook event subscriptions.

import type { WebhookEvent } from '@/types/developer';

// Grouped for display
const EVENT_GROUPS: { label: string; events: WebhookEvent[] }[] = [
  {
    label: 'Orders',
    events: [
      'order.created',
      'order.confirmed',
      'order.processing',
      'order.shipped',
      'order.out_for_delivery',
      'order.delivered',
      'order.cancelled',
      'order.refunded',
    ],
  },
  {
    label: 'Products',
    events: [
      'product.stock_updated',
      'product.price_updated',
      'product.deactivated',
    ],
  },
  {
    label: 'Account',
    events: [
      'developer.plan_expiring',
    ],
  },
];

const EVENT_DESCRIPTIONS: Partial<Record<WebhookEvent, string>> = {
  'order.created':          'Fires when an order is created via POST /api-orders',
  'order.confirmed':        'Store owner has confirmed the order',
  'order.processing':       'Order is being packaged',
  'order.shipped':          'Tracking number assigned, order in transit',
  'order.out_for_delivery': 'Order is out for delivery',
  'order.delivered':        'Delivery confirmed',
  'order.cancelled':        'Order was cancelled',
  'order.refunded':         'Refund was processed',
  'product.stock_updated':  'Stock changed on a product you have imported',
  'product.price_updated':  'Dropship price changed by original product owner',
  'product.deactivated':    'A product you have imported was deactivated',
  'developer.plan_expiring':'Your plan is expiring in 3 days',
};

interface WebhookEventSelectorProps {
  selected:  WebhookEvent[];
  onChange:  (events: WebhookEvent[]) => void;
  disabled?: boolean;
}

export function WebhookEventSelector({
  selected,
  onChange,
  disabled = false,
}: WebhookEventSelectorProps) {
  const selectedSet = new Set(selected);

  function toggle(event: WebhookEvent) {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (next.has(event)) {
      next.delete(event);
    } else {
      next.add(event);
    }
    onChange(Array.from(next));
  }

  function toggleGroup(events: WebhookEvent[]) {
    if (disabled) return;
    const allSelected = events.every((e) => selectedSet.has(e));
    const next = new Set(selectedSet);
    events.forEach((e) => {
      if (allSelected) next.delete(e);
      else next.add(e);
    });
    onChange(Array.from(next));
  }

  function selectAll() {
    if (disabled) return;
    const all: WebhookEvent[] = EVENT_GROUPS.flatMap((g) => g.events);
    onChange(all);
  }

  function clearAll() {
    if (disabled) return;
    onChange([]);
  }

  return (
    <div className="space-y-4">
      {/* Select all / clear */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={selectAll}
          disabled={disabled}
          className="text-xs font-medium text-orange-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={disabled}
          className="text-xs font-medium text-gray-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear all
        </button>
        <span className="ml-auto text-xs text-gray-400">
          {selected.length} selected
        </span>
      </div>

      {EVENT_GROUPS.map((group) => {
        const groupSelected  = group.events.every((e) => selectedSet.has(e));
        const groupPartial   = !groupSelected && group.events.some((e) => selectedSet.has(e));

        return (
          <div key={group.label} className="border border-gray-100 rounded-xl overflow-hidden">
            {/* Group header */}
            <button
              type="button"
              onClick={() => toggleGroup(group.events)}
              disabled={disabled}
              className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50
                hover:bg-gray-100 transition-colors disabled:cursor-not-allowed"
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                groupSelected
                  ? 'bg-orange-500 border-orange-500'
                  : groupPartial
                  ? 'bg-orange-100 border-orange-400'
                  : 'border-gray-300'
              }`}>
                {groupSelected && (
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                    <path d="M3.5 7.5L1.5 5.5l-.7.7 2.7 2.8 5.7-5.7-.7-.7z" />
                  </svg>
                )}
                {groupPartial && !groupSelected && (
                  <span className="w-2 h-0.5 bg-orange-500 block" />
                )}
              </div>
              <span className="text-sm font-semibold text-gray-800">{group.label}</span>
              <span className="ml-auto text-xs text-gray-400">
                {group.events.filter((e) => selectedSet.has(e)).length}/{group.events.length}
              </span>
            </button>

            {/* Events */}
            <div className="divide-y divide-gray-50">
              {group.events.map((event) => {
                const isSelected = selectedSet.has(event);
                return (
                  <label
                    key={event}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer
                      hover:bg-gray-50 transition-colors
                      ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(event)}
                      disabled={disabled}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-orange-500
                        focus:ring-orange-500 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <div className="flex-1 min-w-0">
                      <code className="text-xs font-mono font-semibold text-gray-800">
                        {event}
                      </code>
                      {EVENT_DESCRIPTIONS[event] && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {EVENT_DESCRIPTIONS[event]}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default WebhookEventSelector;
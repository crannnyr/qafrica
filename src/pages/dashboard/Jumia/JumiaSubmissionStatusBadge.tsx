// src/pages/dashboard/Jumia/JumiaSubmissionStatusBadge.tsx
// Single source of truth for status → label/color, used on the overview page,
// the items list, the detail/tracker page, and the admin submissions list.
// Keeping this in one place means a status can never render differently in two spots.

import type { JumiaSubmission } from '@/stores/jumiaStore';

type Status = JumiaSubmission['status'];

const STATUS_CONFIG: Record<Status, { label: string; className: string }> = {
  pending_payment:    { label: 'Awaiting Payment',     className: 'bg-gray-100 text-gray-700' },
  awaiting_schedule:  { label: 'Awaiting Schedule',     className: 'bg-yellow-100 text-yellow-800' },
  awaiting_dropoff:   { label: 'Ready for Drop-off',    className: 'bg-blue-100 text-blue-800' },
  dropped_off:        { label: 'Dropped Off',           className: 'bg-indigo-100 text-indigo-800' },
  received_by_jumia:  { label: 'Received by Jumia',     className: 'bg-purple-100 text-purple-800' },
  live:                { label: 'Live on Jumia',         className: 'bg-green-100 text-green-800' },
  out_of_stock:        { label: 'Out of Stock',          className: 'bg-orange-100 text-orange-800' },
  paused:              { label: 'Paused',                className: 'bg-gray-100 text-gray-700' },
  rejected:            { label: 'Rejected',              className: 'bg-red-100 text-red-800' },
};

export default function JumiaSubmissionStatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase whitespace-nowrap ${config.className}`}>
      {config.label}
    </span>
  );
}

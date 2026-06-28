// src/pages/dashboard/Jumia/JumiaDropoffTaskCard.tsx
// Shows a single drop-off task with a live countdown timer.
// Used in both the urgent banner and the tasks tab.

import { useEffect, useState } from 'react';
import { Clock, MapPin, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { JumiaDropoffTask } from '@/stores/jumiaStore';

function useCountdown(deadline: string | null) {
  const [remaining, setRemaining] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); setIsExpired(true); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
      setIsUrgent(diff < 6 * 3600000); // urgent if < 6 hours left
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  return { remaining, isUrgent, isExpired };
}

interface Props {
  task: JumiaDropoffTask;
  submissionName: string;
}

const STATUS_CONFIG = {
  pending_notification: { label: 'Pending', color: 'bg-gray-100 text-gray-600' },
  notified:             { label: 'Action Required', color: 'bg-orange-100 text-orange-700' },
  dropped_off:          { label: 'Completed', color: 'bg-green-100 text-green-700' },
  missed:               { label: 'Missed', color: 'bg-red-100 text-red-700' },
};

export default function JumiaDropoffTaskCard({ task, submissionName }: Props) {
  const { remaining, isUrgent, isExpired } = useCountdown(
    task.status === 'notified' ? task.deadline_at : null
  );

  const config = STATUS_CONFIG[task.status];

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      task.status === 'notified' && isUrgent
        ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/30'
        : task.status === 'notified'
        ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-900/30'
        : task.status === 'dropped_off'
        ? 'border-green-100 bg-white dark:bg-gray-800 dark:border-gray-700'
        : 'border-gray-100 bg-white dark:bg-gray-800 dark:border-gray-700'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{submissionName}</p>
          {task.variant_label && (
            <p className="text-xs text-gray-500">{task.variant_label}</p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">{task.units} unit{task.units !== 1 ? 's' : ''}</p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase whitespace-nowrap ${config.color}`}>
          {config.label}
        </span>
      </div>

      {task.status === 'notified' && (
        <div className={`flex items-center gap-2 ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-bold">
            {isExpired ? 'Time expired' : `${remaining} remaining`}
          </span>
          {isUrgent && !isExpired && (
            <AlertTriangle className="w-4 h-4 text-red-500" />
          )}
        </div>
      )}

      {task.status === 'notified' && (
        <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
          <MapPin className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
          <span>Go to your chosen VDO location. Check your notification email for the address and instructions.</span>
        </div>
      )}

      {task.status === 'dropped_off' && (
        <div className="flex items-center gap-2 text-green-600 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4" />
          Dropped off {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : ''}
        </div>
      )}

      {task.status === 'missed' && (
        <div className="flex items-center gap-2 text-red-600 text-xs font-medium">
          <XCircle className="w-4 h-4" />
          Strike {task.strike_number} — drop-off missed
        </div>
      )}
    </div>
  );
}

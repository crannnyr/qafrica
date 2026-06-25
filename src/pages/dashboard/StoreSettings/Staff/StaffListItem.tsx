import { useState } from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import type { StoreStaff } from '@/types';
import { PERMISSIONS, type PermissionKey } from './permissions';

interface Props {
  staff: StoreStaff;
  isMutating: boolean;
  onRemove: (id: string) => void;
  onResend: (id: string) => void;
  onTogglePermission: (id: string, permission: PermissionKey, value: boolean) => void;
}

const STATUS_BADGE: Record<StoreStaff['status'], string> = {
  active:    'bg-green-100 text-green-700',
  pending:   'bg-yellow-100 text-yellow-700',
  suspended: 'bg-red-100 text-red-700',
  removed:   'bg-gray-100 text-gray-500',
};

export default function StaffListItem({ staff, isMutating, onRemove, onResend, onTogglePermission }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-violet-700 font-bold text-sm">
              {(staff.full_name ?? staff.email).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 text-sm truncate">{staff.full_name ?? '—'}</p>
            <p className="text-xs text-gray-500 truncate">{staff.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[staff.status] ?? STATUS_BADGE.pending}`}>
            {staff.status}
          </span>
          {staff.status === 'pending' && (
            <button
              onClick={() => onResend(staff.id)}
              disabled={isMutating}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium px-2 py-1 rounded-lg hover:bg-orange-50 disabled:opacity-50"
            >
              Resend
            </button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            Permissions
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onRemove(staff.id)}
            disabled={isMutating}
            className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {isMutating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remove'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50/60 space-y-3">
          {PERMISSIONS.map(perm => {
            const checked = Boolean(staff[perm.key as keyof StoreStaff]);
            return (
              <div key={perm.key} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">{perm.label}</p>
                  <p className="text-xs text-gray-500">{perm.description}</p>
                </div>
                <button
                  onClick={() => onTogglePermission(staff.id, perm.key, !checked)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-orange-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

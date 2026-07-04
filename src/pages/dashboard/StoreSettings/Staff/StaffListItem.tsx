import { useState, useRef, useEffect } from 'react';
import { Loader2, ChevronDown, ChevronUp, MoreVertical, RotateCw, Trash2 } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const grantedCount = PERMISSIONS.filter(p => staff[p.key]).length;

  // Close the overflow menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setConfirmingRemove(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleRemoveClick = () => {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }
    onRemove(staff.id);
    setConfirmingRemove(false);
    setMenuOpen(false);
  };

  const handleResendClick = () => {
    onResend(staff.id);
    setMenuOpen(false);
  };

  return (
    <div className="border border-gray-100 rounded-xl hover:border-gray-200 transition-colors">
      <div className="flex items-center justify-between gap-3 p-4">
        {/* Identity block */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-violet-700 font-bold text-sm">
              {(staff.full_name ?? staff.email).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-gray-900 text-sm truncate">{staff.full_name ?? '—'}</p>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${STATUS_BADGE[staff.status] ?? STATUS_BADGE.pending}`}>
                {staff.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate">{staff.email}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-gray-600 hover:text-gray-800 font-medium px-2.5 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1 whitespace-nowrap"
          >
            {grantedCount} perm{grantedCount === 1 ? '' : 's'}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              disabled={isMutating}
              aria-label="More actions"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
            </button>

            {menuOpen && !isMutating && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-10">
                {staff.status === 'pending' && (
                  <button
                    onClick={handleResendClick}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Resend invite
                  </button>
                )}
                <button
                  onClick={handleRemoveClick}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    confirmingRemove
                      ? 'bg-red-50 text-red-700 font-medium'
                      : 'text-red-500 hover:bg-red-50'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {confirmingRemove ? 'Click again to confirm' : 'Remove staff'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50/60 space-y-3">
          {PERMISSIONS.map(perm => {
            const checked = staff[perm.key];
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
                  <span className={`absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Setup guide step 1: nudge store owners to confirm their email until they do.
// Hidden on the Settings page itself and for staff; can be dismissed for this session.
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MailWarning, X } from 'lucide-react';
import { useAuthStore } from '@/stores';

const KEY = 'qafrica_confirm_email_dismissed';

export default function ConfirmEmailBanner() {
  const { user } = useAuthStore();
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  if (!user || user.email_verified || user.role === 'staff' || hidden || pathname.startsWith('/dashboard/settings')) return null;
  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900">
      <div className="px-4 lg:px-6 py-2.5 flex items-center gap-3 text-sm">
        <MailWarning className="w-4 h-4 shrink-0" />
        <p className="flex-1 min-w-0">
          <span className="font-semibold">Confirm your email</span>
          <span className="hidden sm:inline"> so order and payout emails reach you.</span>
        </p>
        <Link to="/dashboard/settings?tab=account" className="shrink-0 rounded-lg bg-amber-900 text-white px-3 py-1.5 text-xs font-semibold">Confirm now</Link>
        <button type="button" aria-label="Hide for now" className="p-1 rounded hover:bg-amber-100" onClick={() => {
          try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
          setHidden(true);
        }}><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

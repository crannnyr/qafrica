import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface Props {
  canInvite: boolean;
  staffLimit: number;
  onInvite: (email: string) => Promise<boolean>;
}

export default function StaffInviteForm({ canInvite, staffLimit, onInvite }: Props) {
  const [email, setEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const handleInvite = async () => {
    if (!email.trim()) { toast.error('Enter an email address'); return; }
    if (!email.includes('@')) { toast.error('Enter a valid email'); return; }
    if (!canInvite) { toast.error('Staff limit reached for your plan'); return; }

    setIsInviting(true);
    const success = await onInvite(email.trim());
    if (success) setEmail('');
    setIsInviting(false);
  };

  return (
    <>
      <div className="flex gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleInvite()}
          placeholder="staff@email.com"
          disabled={!canInvite}
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-orange-500 outline-none bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <Button
          onClick={handleInvite}
          disabled={isInviting || !canInvite || !email.trim()}
          className="bg-orange-500 hover:bg-orange-600 text-white px-5"
        >
          {isInviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Invite'}
        </Button>
      </div>

      {!canInvite && staffLimit > 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-100 mt-3">
          Staff limit reached ({staffLimit}/{staffLimit}). Remove a staff member to invite someone new.
        </p>
      )}
    </>
  );
}

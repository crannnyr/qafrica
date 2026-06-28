// src/pages/admin/Jumia/AdminJumiaActionPanel.tsx
// Combined status-action + sale-logging panel, per spec: one form, not two separate sections.
// Each action that changes user-visible state offers ITS OWN matching email template —
// admin can send or skip per action, never a generic notify-button.

import { useState } from 'react';
import { CheckCircle2, Mail, AlertTriangle, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useJumiaStore, type JumiaSubmission } from '@/stores/jumiaStore';
import { useAuthStore } from '@/stores';
import { sendEmail } from '@/services/email';
import { jumiaEmailTemplates } from '@/services/jumiaEmailTemplates';
const APP_URL = typeof window !== 'undefined' ? window.location.origin : '';

interface Props {
  submission: JumiaSubmission;
  onUpdated: () => void;
}

export default function AdminJumiaActionPanel({ submission, onUpdated }: Props) {
  const { user: admin } = useAuthStore();
  const { updateSubmissionStatus, recordSale, createDropoffTask, markTaskDroppedOff, markTaskMissed } = useJumiaStore();

  const [isWorking, setIsWorking] = useState(false);
  const [scheduleNote, setScheduleNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [variantLabel, setVariantLabel] = useState(() => {
    const first = submission.variants?.[0];
    if (!first) return '';
    return first.colour && first.size ? `${first.colour} / ${first.size}` : first.colour ?? first.size ?? '';
  });
  const [unitsSold, setUnitsSold] = useState('');
  const [salePrice, setSalePrice] = useState(String(submission.selling_price));
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [isSendingDropoffNotif, setIsSendingDropoffNotif] = useState(false);

  const ownerName = submission.owner?.full_name || 'there';
  const ownerEmail = submission.owner?.email;

  const runStatusUpdate = async (updates: Partial<JumiaSubmission>, successMsg: string, emailFn?: () => Promise<void>) => {
    setIsWorking(true);
    const result = await updateSubmissionStatus(submission.id, updates);
    if (!result.success) {
      toast.error(result.error || 'Update failed');
      setIsWorking(false);
      return;
    }
    toast.success(successMsg);
    if (emailFn) {
      await emailFn().catch(() => toast.error('Status updated, but the email failed to send'));
    }
    onUpdated();
    setIsWorking(false);
  };

  const handleSchedule = () => runStatusUpdate(
    { status: 'awaiting_dropoff', scheduled_for: new Date().toISOString(), status_note: scheduleNote || null },
    'Schedule confirmed',
  );

  const handleMarkDroppedOff = () => runStatusUpdate({ status: 'dropped_off' }, 'Marked as dropped off');
  const handleMarkReceived = () => runStatusUpdate({ status: 'received_by_jumia', received_by_jumia_at: new Date().toISOString() }, 'Marked as received by Jumia');

  const handleMarkLive = () => runStatusUpdate(
    { status: 'live', live_at: new Date().toISOString() },
    'Item marked live',
    async () => {
      if (!ownerEmail) return;
      const t = jumiaEmailTemplates.nowLive({ name: ownerName, productName: submission.name, appUrl: APP_URL });
      await sendEmail({ to: ownerEmail, subject: t.subject, html: t.body });
    },
  );

  const handleMarkOutOfStock = () => runStatusUpdate(
    { status: 'out_of_stock' },
    'Marked out of stock',
    async () => {
      if (!ownerEmail) return;
      const t = jumiaEmailTemplates.outOfStock({ name: ownerName, productName: submission.name, appUrl: APP_URL });
      await sendEmail({ to: ownerEmail, subject: t.subject, html: t.body });
    },
  );

  const handleReject = () => {
    if (!rejectReason.trim()) { toast.error('Enter a rejection reason'); return; }
    runStatusUpdate(
      { status: 'rejected', status_note: rejectReason },
      'Submission rejected',
      async () => {
        if (!ownerEmail) return;
        const t = jumiaEmailTemplates.rejected({ name: ownerName, productName: submission.name, reason: rejectReason, appUrl: APP_URL });
        await sendEmail({ to: ownerEmail, subject: t.subject, html: t.body });
      },
    );
  };

  const handleLogSale = async () => {
    const units = Number(unitsSold);
    const price = Number(salePrice);
    if (!units || units <= 0) { toast.error('Enter a valid number of units sold'); return; }
    if (!price || price <= 0) { toast.error('Enter a valid sale price'); return; }
    if (submission.variant_type !== 'none' && !variantLabel) { toast.error('Select a variant'); return; }

    setIsWorking(true);
    const result = await recordSale({
      submission_id: submission.id,
      variant_label: submission.variant_type !== 'none' ? variantLabel : null,
      units_sold: units,
      unit_price: price,
      admin_id: admin!.id,
    });
    if (!result.success) {
      toast.error(result.error || 'Could not log sale');
      setIsWorking(false);
      return;
    }
    toast.success(`Logged ${units} unit(s) sold — wallet credited`);
    setUnitsSold('');
    if (result.saleId) setLastSaleId(result.saleId);

    if (ownerEmail) {
      const remaining = submission.variant_type !== 'none'
        ? (submission.variants.find((v) => {
            const lbl = v.colour && v.size ? `${v.colour} / ${v.size}` : v.colour ?? v.size ?? '';
            return lbl === variantLabel;
          })?.quantity_remaining ?? 0) - units
        : submission.quantity_remaining - units;
      const t = jumiaEmailTemplates.saleUpdate({
        name: ownerName, productName: submission.name,
        variantLabel: submission.variant_type !== 'none' ? variantLabel : undefined,
        unitsSold: units, remaining: Math.max(0, remaining), appUrl: APP_URL,
      });
      await sendEmail({ to: ownerEmail, subject: t.subject, html: t.body }).catch(() => toast.error('Sale logged, but the email failed to send'));
    }
    onUpdated();
    setIsWorking(false);
  };

  const handleSendDropoffNotification = async () => {
    if (!lastSaleId) { toast.error('Log a sale first before sending a drop-off notification'); return; }
    if (!ownerEmail) { toast.error('No email address for this user'); return; }
    setIsSendingDropoffNotif(true);

    const result = await createDropoffTask({
      submission_id: submission.id,
      sale_id: lastSaleId,
      owner_id: submission.owner_id,
      units: Number(unitsSold) || 1,
      variant_label: submission.variant_type !== 'none' ? variantLabel : null,
    });

    if (!result.success || !result.task) {
      toast.error(result.error || 'Could not create drop-off task');
      setIsSendingDropoffNotif(false);
      return;
    }

    const t = jumiaEmailTemplates.dropoffNotification({
      name: ownerName,
      productName: submission.name,
      variantLabel: submission.variant_type !== 'none' ? variantLabel : undefined,
      units: result.task.units,
      strikeCount: result.strikeCount ?? 0,
      deadlineHours: 24,
      location: result.location
        ? { name: result.location.name, address: result.location.address }
        : { name: 'Your chosen VDO location', address: 'Check your original confirmation for the address.' },
      appUrl: window.location.origin,
    });

    await sendEmail({ to: ownerEmail, subject: t.subject, html: t.body })
      .catch(() => toast.error('Task created but email failed to send'));

    toast.success('Drop-off notification sent — user has 24 hours');
    setLastSaleId(null);
    setIsSendingDropoffNotif(false);
    onUpdated();
  };

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Actions</h2>

      {submission.status === 'awaiting_schedule' && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">Schedule note for user</label>
          <textarea
            value={scheduleNote}
            onChange={(e) => setScheduleNote(e.target.value)}
            rows={2}
            placeholder={submission.fulfillment_method === 'self_dropoff'
              ? 'e.g. Come to the Ikeja location tomorrow between 10am–2pm'
              : 'e.g. Our agent will arrive Tuesday between 11am–1pm'}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
          />
          <button onClick={handleSchedule} disabled={isWorking}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-60">
            <MapPin className="w-4 h-4" /> Confirm Schedule
          </button>
        </div>
      )}

      {submission.status === 'awaiting_dropoff' && (
        <button onClick={handleMarkDroppedOff} disabled={isWorking}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 disabled:opacity-60">
          <CheckCircle2 className="w-4 h-4" /> Mark Dropped Off
        </button>
      )}

      {submission.status === 'dropped_off' && (
        <button onClick={handleMarkReceived} disabled={isWorking}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-60">
          <CheckCircle2 className="w-4 h-4" /> Mark Received by Jumia
        </button>
      )}

      {submission.status === 'received_by_jumia' && (
        <button onClick={handleMarkLive} disabled={isWorking}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-60">
          <Mail className="w-4 h-4" /> Mark Live & Email User
        </button>
      )}

      {['live', 'out_of_stock'].includes(submission.status) && (
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-bold text-gray-700">Log a Sale</h3>
          {submission.variant_type !== 'none' && (
            <select value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
              {submission.variants.map((v) => {
                const lbl = v.colour && v.size ? `${v.colour} / ${v.size}` : v.colour ?? v.size ?? '';
                return (
                  <option key={lbl} value={lbl} disabled={v.quantity_remaining === 0}>
                    {lbl} ({v.quantity_remaining} left)
                  </option>
                );
              })}
            </select>
          )}
          <div className="flex gap-2">
            <input type="number" value={unitsSold} onChange={(e) => setUnitsSold(e.target.value)}
              placeholder="Units sold" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)}
              placeholder="Sale price (₦)" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </div>
          <button onClick={handleLogSale} disabled={isWorking}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60">
            {isWorking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Log Sale & Email User
          </button>

          {/* Drop-off notification — only for self-dropoff submissions */}
          {submission.fulfillment_method === 'self_dropoff' && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">
                {lastSaleId
                  ? 'Sale logged. Now notify the seller to drop off within 24 hours.'
                  : 'Log a sale above first, then send the drop-off notification.'}
              </p>
              <button
                onClick={handleSendDropoffNotification}
                disabled={isSendingDropoffNotif || !lastSaleId}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {isSendingDropoffNotif
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Mail className="w-4 h-4" />}
                Send Drop-off Notification (24hr deadline)
              </button>
              {submission.strike_count > 0 && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">
                  ⚠ This seller has {submission.strike_count} strike{submission.strike_count > 1 ? 's' : ''} — 3 = auto-rejection
                </p>
              )}
            </div>
          )}

          {submission.status !== 'out_of_stock' && (
            <button onClick={handleMarkOutOfStock} disabled={isWorking}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 disabled:opacity-60">
              <AlertTriangle className="w-4 h-4" /> Mark Out of Stock & Email User
            </button>
          )}
        </div>
      )}

      {!['live', 'out_of_stock', 'rejected', 'paused'].includes(submission.status) && (
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-bold text-red-600">Reject Submission</h3>
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2}
            placeholder="Reason Jumia/admin rejected this item"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none" />
          <button onClick={handleReject} disabled={isWorking}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-60">
            Reject & Email User
          </button>
        </div>
      )}
    </div>
  );
}

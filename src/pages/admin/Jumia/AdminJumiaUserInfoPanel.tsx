// src/pages/admin/Jumia/AdminJumiaUserInfoPanel.tsx
// Read-only summary of the submission owner and item, shown alongside the action panel.

import { User, Mail, Phone, Tag, Package2 } from 'lucide-react';
import type { JumiaSubmission } from '@/stores/jumiaStore';

export default function AdminJumiaUserInfoPanel({ submission }: { submission: JumiaSubmission }) {
  const hasVariants = submission.variant_type !== 'none';

  const totalRemaining = hasVariants
    ? submission.variants.reduce((sum, v) => sum + v.quantity_remaining, 0)
    : submission.quantity_remaining;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">
      <div>
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Submitted By</h2>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-orange-500" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{submission.owner?.full_name || '—'}</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 text-sm text-gray-600">
          {submission.owner?.email && (
            <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" /> {submission.owner.email}</p>
          )}
          {submission.owner?.phone && (
            <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" /> {submission.owner.phone}</p>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Item</h2>
        {submission.images?.[0] && (
          <img src={submission.images[0]} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />
        )}
        <p className="font-semibold text-gray-900">{submission.name}</p>
        <div className="mt-2 space-y-1.5 text-sm text-gray-600">
          <p className="flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-gray-400" /> {submission.category}</p>
          <p className="flex items-center gap-2"><Package2 className="w-3.5 h-3.5 text-gray-400" /> ₦{Number(submission.selling_price).toLocaleString()} per unit</p>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Stock</h2>
        {hasVariants ? (
          <div className="space-y-1.5">
            {submission.variants.map((v) => (
              <div key={v.label} className="flex justify-between text-sm">
                <span className="text-gray-600">{v.label}</span>
                <span className={`font-semibold ${v.quantity_remaining === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                  {v.quantity_remaining} / {v.quantity_sent}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm">
            <span className={`font-semibold ${totalRemaining === 0 ? 'text-red-500' : 'text-gray-900'}`}>
              {submission.quantity_remaining}
            </span>
            <span className="text-gray-500"> / {submission.quantity_sent} remaining</span>
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Fulfillment</h2>
        <p className="text-sm text-gray-600 capitalize">{submission.fulfillment_method.replace('_', ' ')}</p>
        <p className="text-xs text-gray-400 mt-1">
          Submission fee: {submission.submission_fee_paid ? 'Paid' : 'Unpaid'}
          {submission.fulfillment_method === 'agent_pickup' && (
            <> · Agent fee: {submission.agent_fee_paid ? 'Paid' : 'Unpaid'}</>
          )}
        </p>
      </div>
    </div>
  );
}

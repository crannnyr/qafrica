// src/pages/dashboard/Wallet/emailTemplates.ts

import { sendEmail } from '@/services/email';

// ── OTP email ─────────────────────────────────────────────────────────────────

export const sendBankChangeOtp = async (
  email: string,
  otp: string,
  name: string,
) => {
  return sendEmail({
    to: email,
    subject: 'QAFRICA — Confirm your withdrawal account change',
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="background:#F97316;border-radius:12px;padding:12px 18px;display:inline-block;">
            <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
          </div>
        </td></tr>
        <tr><td style="background:#fff;border-radius:16px;padding:36px 32px;box-shadow:0 4px 20px rgba(0,0,0,0.07);">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;">Withdrawal Account Change</p>
          <p style="margin:0 0 24px;font-size:14px;color:#6B7280;">
            Hi ${name}, someone requested a change to your withdrawal bank account.
            Use the code below to confirm.
          </p>
          <div style="background:#FFF7ED;border:2px dashed #F97316;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#F97316;text-transform:uppercase;letter-spacing:1px;">Your OTP Code</p>
            <p style="margin:0;font-size:36px;font-weight:800;color:#111827;letter-spacing:8px;">${otp}</p>
            <p style="margin:8px 0 0;font-size:12px;color:#9CA3AF;">Expires in 15 minutes</p>
          </div>
          <div style="background:#FEF2F2;border-left:3px solid #EF4444;border-radius:0 8px 8px 0;padding:12px 16px;">
            <p style="margin:0;font-size:13px;color:#991B1B;">
              If you didn't request this change, contact us immediately on
              <a href="https://wa.me/447404707531" style="color:#F97316;">WhatsApp</a>.
            </p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  });
};

// ── Withdrawal email ───────────────────────────────────────────────────────────

export const withdrawalEmailHtml = ({
  name, amount, bank_name, account_number, account_name, status, reason,
}: {
  name: string;
  amount: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  status: 'submitted' | 'paid' | 'rejected';
  reason?: string;
}) => {
  const statusConfig = {
    submitted: {
      color:   '#F97316',
      label:   'Request Received',
      message: 'Your withdrawal request has been received and will be processed within 34 hours.',
    },
    paid: {
      color:   '#10B981',
      label:   'Payment Sent',
      message: 'Your withdrawal has been processed and sent to your bank account.',
    },
    rejected: {
      color:   '#EF4444',
      label:   'Request Rejected',
      message: reason || 'Your withdrawal request was rejected. Your funds have been returned to your wallet.',
    },
  }[status];

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td align="center" style="padding-bottom:24px;">
          <div style="background:#F97316;border-radius:12px;padding:12px 18px;display:inline-block;">
            <span style="color:#fff;font-size:20px;font-weight:800;">QAFRICA</span>
          </div>
        </td></tr>
        <tr><td style="background:#fff;border-radius:16px;padding:36px 32px;box-shadow:0 4px 20px rgba(0,0,0,0.07);">
          <div style="background:${statusConfig.color}15;border-left:4px solid ${statusConfig.color};border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:24px;">
            <p style="margin:0;font-size:16px;font-weight:700;color:${statusConfig.color};">${statusConfig.label}</p>
          </div>
          <p style="margin:0 0 24px;font-size:14px;color:#6B7280;">Hi ${name}, ${statusConfig.message}</p>
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:16px;">
            <table width="100%" style="font-size:13px;">
              <tr>
                <td style="color:#6B7280;padding:4px 0;">Amount</td>
                <td style="text-align:right;font-weight:700;color:#111827;">₦${amount.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="color:#6B7280;padding:4px 0;">Bank</td>
                <td style="text-align:right;font-weight:600;color:#111827;">${bank_name}</td>
              </tr>
              <tr>
                <td style="color:#6B7280;padding:4px 0;">Account</td>
                <td style="text-align:right;font-weight:600;color:#111827;">
                  ••••${account_number.slice(-4)} · ${account_name}
                </td>
              </tr>
            </table>
          </div>
          <p style="margin:0;font-size:12px;color:#9CA3AF;">
            If you have questions, contact us on
            <a href="https://wa.me/447404707531" style="color:#F97316;">WhatsApp</a>.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:20px 0 0;">
          <p style="margin:0;font-size:12px;color:#D1D5DB;">© ${new Date().getFullYear()} QAFRICA</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

// ── OTP generator ─────────────────────────────────────────────────────────────

export const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();
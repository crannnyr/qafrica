// src/services/jumiaEmailTemplates.ts
// Follows the exact branded card structure used in emailTemplates.welcome / storeCreatedTemplate.
// Each function returns { subject, body } — pass straight into sendEmail({ to, subject, html: body }).

const wrapCard = (innerHtml: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>QAFRICA Jumia Update</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#F97316;border-radius:14px;padding:14px 20px;">
                    <span style="color:#fff;font-size:22px;font-weight:800;letter-spacing:1px;">QAFRICA</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:20px;padding:40px 36px;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
              ${innerHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 0 0;">
              <p style="margin:0 0 6px;font-size:13px;color:#9CA3AF;">
                Questions? Reply to this email or reach us on
                <a href="https://wa.me/447404707531" style="color:#F97316;text-decoration:none;">WhatsApp</a>
              </p>
              <p style="margin:0;font-size:12px;color:#D1D5DB;">
                © ${new Date().getFullYear()} QAFRICA. Building Africa's digital commerce, one store at a time.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const ctaButton = (href: string, label: string) => `
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <a href="${href}"
           style="display:inline-block;padding:14px 36px;background:#F97316;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">
          ${label} →
        </a>
      </td>
    </tr>
  </table>`;

export const jumiaEmailTemplates = {
  // Sent when admin marks a submission as live on Jumia
  nowLive: (params: { name: string; productName: string; appUrl: string }) => ({
    subject: `🎉 ${params.productName} is now live on Jumia`,
    body: wrapCard(`
      <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">Good news, ${params.name}! 🎉</p>
      <p style="margin:0 0 28px;font-size:16px;color:#6B7280;line-height:1.6;">
        Your item <strong style="color:#111827;">${params.productName}</strong> has been received,
        approved, and is now <strong style="color:#F97316;">live on Jumia</strong>. Customers can buy it right now.
      </p>
      <div style="height:2px;background:linear-gradient(to right,#F97316,#FED7AA);border-radius:2px;margin-bottom:28px;"></div>
      <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
        We'll keep you updated daily on sales. Track everything from your Jumia dashboard.
      </p>
      ${ctaButton(`${params.appUrl}/dashboard/jumia`, 'View My Jumia Dashboard')}
    `),
  }),

  // Sent when admin logs a sale (optional — admin chooses to send)
  saleUpdate: (params: { name: string; productName: string; variantLabel?: string; unitsSold: number; remaining: number; appUrl: string }) => ({
    subject: `📦 Jumia sold ${params.unitsSold} unit(s) of ${params.productName}`,
    body: wrapCard(`
      <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">You made a sale! 💰</p>
      <p style="margin:0 0 20px;font-size:16px;color:#6B7280;line-height:1.6;">
        Jumia sold <strong style="color:#F97316;">${params.unitsSold} unit(s)</strong> of
        <strong style="color:#111827;">${params.productName}${params.variantLabel ? ` (${params.variantLabel})` : ''}</strong> today.
      </p>
      <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:28px;">
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
          <strong style="color:#F97316;">Remaining stock:</strong> ${params.remaining} unit(s).
          ${params.remaining <= 0 ? 'This item is now out of stock — request a restock from your dashboard.' : ''}
        </p>
      </div>
      ${ctaButton(`${params.appUrl}/dashboard/jumia/wallet`, 'View Jumia Wallet')}
    `),
  }),

  // Sent when admin marks an item out of stock
  outOfStock: (params: { name: string; productName: string; appUrl: string }) => ({
    subject: `⚠️ ${params.productName} is out of stock on Jumia`,
    body: wrapCard(`
      <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">Time to restock, ${params.name}</p>
      <p style="margin:0 0 28px;font-size:16px;color:#6B7280;line-height:1.6;">
        <strong style="color:#111827;">${params.productName}</strong> has sold out on Jumia.
        Send us at least 10 more units of the same item to keep selling.
      </p>
      ${ctaButton(`${params.appUrl}/dashboard/jumia/add`, 'Request Restock')}
    `),
  }),

  // Sent when admin gives a drop-off/pickup schedule
  scheduleReady: (params: { name: string; productName: string; method: 'self_dropoff' | 'agent_pickup'; note: string; appUrl: string }) => ({
    subject: `📍 Drop-off details ready for ${params.productName}`,
    body: wrapCard(`
      <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">You're ready to send it in, ${params.name}</p>
      <p style="margin:0 0 20px;font-size:16px;color:#6B7280;line-height:1.6;">
        ${params.method === 'self_dropoff'
          ? 'Here are your drop-off details for'
          : 'Our agent will pick up'} <strong style="color:#111827;">${params.productName}</strong>.
      </p>
      <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:28px;">
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${params.note}</p>
      </div>
      ${ctaButton(`${params.appUrl}/dashboard/jumia`, 'View My Jumia Dashboard')}
    `),
  }),

  // Sent when admin rejects a submission
  rejected: (params: { name: string; productName: string; reason: string; appUrl: string }) => ({
    subject: `${params.productName} wasn't approved by Jumia`,
    body: wrapCard(`
      <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">Hi ${params.name},</p>
      <p style="margin:0 0 20px;font-size:16px;color:#6B7280;line-height:1.6;">
        Unfortunately <strong style="color:#111827;">${params.productName}</strong> wasn't approved by Jumia.
      </p>
      <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:28px;">
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;"><strong>Reason:</strong> ${params.reason}</p>
      </div>
      ${ctaButton(`${params.appUrl}/dashboard/jumia/add`, 'Submit Another Item')}
    `),
  }),

  // Sent when admin triggers a drop-off notification for a self-dropoff submission.
  // Auto-includes VDO location name, address, landmark, hours from the DB row.
  dropoffNotification: (params: {
    name: string;
    productName: string;
    variantLabel?: string;
    units: number;
    strikeCount: number;
    deadlineHours: number;
    location: { name: string; address: string };
    appUrl: string;
  }) => ({
    subject: `⚡ Action Required — Drop off ${params.productName} within ${params.deadlineHours} hours`,
    body: wrapCard(`
      <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">
        Time to drop it off, ${params.name}
      </p>
      <p style="margin:0 0 20px;font-size:16px;color:#6B7280;line-height:1.6;">
        A sale just came in for <strong style="color:#111827;">${params.productName}${params.variantLabel ? ` (${params.variantLabel})` : ''}</strong>.
        You need to drop off <strong style="color:#F97316;">${params.units} unit${params.units > 1 ? 's' : ''}</strong> at your Jumia VDO location within <strong style="color:#EF4444;">${params.deadlineHours} hours</strong>.
      </p>

      <div style="height:2px;background:linear-gradient(to right,#F97316,#FED7AA);border-radius:2px;margin-bottom:24px;"></div>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border-radius:12px;margin-bottom:20px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#F97316;text-transform:uppercase;letter-spacing:0.5px;">Your Drop-off Location</p>
          <p style="margin:0 0 6px;font-size:15px;font-weight:800;color:#111827;">${params.location.name}</p>
          <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">${params.location.address}</p>
        </td></tr>
      </table>

      <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:0 10px 10px 0;padding:14px 18px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;color:#991B1B;line-height:1.6;">
          <strong>⏰ Deadline: ${params.deadlineHours} hours from now.</strong>
          Missing this drop-off counts as <strong>Strike ${params.strikeCount + 1}</strong>.
          ${params.strikeCount + 1 >= 3
            ? 'This is your final strike — missing it will permanently remove this listing.'
            : `You currently have ${params.strikeCount} strike${params.strikeCount !== 1 ? 's' : ''}. 3 missed drop-offs and the listing is removed.`
          }
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;font-size:14px;color:#F97316;">1.</td>
            <td style="font-size:14px;color:#374151;line-height:1.5;">Ensure your item is <strong>properly sealed and packaged</strong> before going.</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #F3F4F6;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;font-size:14px;color:#F97316;">2.</td>
            <td style="font-size:14px;color:#374151;line-height:1.5;"><strong>Print and attach your shipping label</strong> to the outside of the package. Download it from your Jumia dashboard if needed.</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 0;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:28px;font-size:14px;color:#F97316;">3.</td>
            <td style="font-size:14px;color:#374151;line-height:1.5;">Head to the VDO location above during opening hours and drop off your package.</td>
          </tr></table>
        </td></tr>
      </table>

      ${ctaButton(`${params.appUrl}/dashboard/jumia`, 'View My Jumia Dashboard')}
    `),
  }),
};

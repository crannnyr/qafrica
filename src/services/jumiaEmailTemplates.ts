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

const divider = `<div style="height:2px;background:linear-gradient(to right,#F97316,#FED7AA);border-radius:2px;margin-bottom:28px;"></div>`;

// Numbered step row, matches storeCreatedTemplate's circular-badge step list
const stepRow = (icon: string, html: string, isLast = false) => `
  <tr>
    <td style="padding:12px 0;${isLast ? '' : 'border-bottom:1px solid #F3F4F6;'}">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="width:36px;height:36px;background:#FFF7ED;border-radius:50%;text-align:center;vertical-align:middle;font-size:16px;">${icon}</td>
          <td style="padding-left:14px;font-size:14px;color:#374151;line-height:1.5;">${html}</td>
        </tr>
      </table>
    </td>
  </tr>`;

// Orange-tinted stat box, used for highlighting a single key number (e.g. price, units, balance)
const statBox = (label: string, value: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border-radius:12px;margin-bottom:24px;">
    <tr><td style="padding:16px 20px;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#F97316;text-transform:uppercase;letter-spacing:0.5px;">${label}</p>
      <p style="margin:0;font-size:22px;font-weight:800;color:#111827;">${value}</p>
    </td></tr>
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
      ${divider}
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#111827;">🚀 What happens next</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${stepRow('👀', '<strong style="color:#111827;">Your listing goes live</strong> on Jumia\'s marketplace, visible to millions of shoppers')}
        ${stepRow('📦', '<strong style="color:#111827;">When it sells</strong>, we\'ll notify you and walk you through getting it dropped off or picked up')}
        ${stepRow('💰', '<strong style="color:#111827;">Your earnings land</strong> in your Jumia wallet, ready to withdraw once payout conditions are met', true)}
      </table>
      ${ctaButton(`${params.appUrl}/dashboard/jumia`, 'View My Jumia Dashboard')}
    `),
  }),

  // Sent when admin logs a sale (optional — admin chooses to send)
  saleUpdate: (params: { name: string; productName: string; variantLabel?: string; unitsSold: number; remaining: number; appUrl: string }) => ({
    subject: `📦 Jumia sold ${params.unitsSold} unit(s) of ${params.productName}`,
    body: wrapCard(`
      <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">You made a sale! 💰</p>
      <p style="margin:0 0 24px;font-size:16px;color:#6B7280;line-height:1.6;">
        Jumia sold units of
        <strong style="color:#111827;">${params.productName}${params.variantLabel ? ` (${params.variantLabel})` : ''}</strong> today.
      </p>
      ${divider}
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td width="50%" style="padding-right:8px;">
            ${statBox('Units Sold', `${params.unitsSold}`)}
          </td>
          <td width="50%" style="padding-left:8px;">
            ${statBox('Remaining Stock', `${params.remaining}`)}
          </td>
        </tr>
      </table>
      ${params.remaining <= 0 ? `
      <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:28px;">
        <p style="margin:0;font-size:14px;color:#991B1B;line-height:1.6;">
          <strong>This item is now out of stock.</strong> Request a restock from your dashboard to keep selling.
        </p>
      </div>` : `
      <p style="margin:0 0 28px;font-size:14px;color:#374151;line-height:1.6;">
        Your earnings from this sale have been credited to your Jumia wallet.
      </p>`}
      ${ctaButton(`${params.appUrl}/dashboard/jumia/wallet`, 'View Jumia Wallet')}
    `),
  }),

  // Sent when admin marks an item out of stock
  outOfStock: (params: { name: string; productName: string; appUrl: string }) => ({
    subject: `⚠️ ${params.productName} is out of stock on Jumia`,
    body: wrapCard(`
      <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">Time to restock, ${params.name}</p>
      <p style="margin:0 0 24px;font-size:16px;color:#6B7280;line-height:1.6;">
        <strong style="color:#111827;">${params.productName}</strong> has sold out on Jumia.
        Send us more units of the same item to keep selling and avoid losing momentum on this listing.
      </p>
      ${divider}
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#111827;">📋 How to restock</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${stepRow('1', '<strong style="color:#111827;">Request a restock</strong> from your Jumia dashboard — minimum 10 units of the same item')}
        ${stepRow('2', '<strong style="color:#111827;">Drop off or schedule pickup</strong> the same way you did for the original submission')}
        ${stepRow('3', '<strong style="color:#111827;">We\'ll notify you</strong> once it\'s back live on Jumia', true)}
      </table>
      ${ctaButton(`${params.appUrl}/dashboard/jumia/add`, 'Request Restock')}
    `),
  }),

  // Sent when admin gives a drop-off/pickup schedule
  scheduleReady: (params: { name: string; productName: string; method: 'self_dropoff' | 'agent_pickup'; note: string; appUrl: string }) => ({
    subject: `📍 Drop-off details ready for ${params.productName}`,
    body: wrapCard(`
      <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">You're ready to send it in, ${params.name}</p>
      <p style="margin:0 0 24px;font-size:16px;color:#6B7280;line-height:1.6;">
        ${params.method === 'self_dropoff'
          ? 'Here are your drop-off details for'
          : 'Our agent will pick up'} <strong style="color:#111827;">${params.productName}</strong>.
      </p>
      ${divider}
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF7ED;border-radius:12px;margin-bottom:24px;">
        <tr><td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#F97316;text-transform:uppercase;letter-spacing:0.5px;">
            ${params.method === 'self_dropoff' ? 'Drop-off Details' : 'Pickup Details'}
          </p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${params.note}</p>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#111827;">✅ Before you go</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${stepRow('1', '<strong style="color:#111827;">Package it securely</strong> — make sure the item is sealed and protected')}
        ${stepRow('2', '<strong style="color:#111827;">Attach your shipping label</strong>, downloadable from your Jumia dashboard')}
        ${stepRow('3', params.method === 'self_dropoff'
          ? '<strong style="color:#111827;">Head to your assigned location</strong> during opening hours'
          : '<strong style="color:#111827;">Be available</strong> at the pickup time and location confirmed above', true)}
      </table>
      ${ctaButton(`${params.appUrl}/dashboard/jumia`, 'View My Jumia Dashboard')}
    `),
  }),

  // Sent when admin rejects a submission
  rejected: (params: { name: string; productName: string; reason: string; appUrl: string }) => ({
    subject: `${params.productName} wasn't approved by Jumia`,
    body: wrapCard(`
      <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">Hi ${params.name},</p>
      <p style="margin:0 0 24px;font-size:16px;color:#6B7280;line-height:1.6;">
        Unfortunately <strong style="color:#111827;">${params.productName}</strong> wasn't approved by Jumia.
      </p>
      ${divider}
      <div style="background:#FEF2F2;border-left:4px solid #EF4444;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:28px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#EF4444;text-transform:uppercase;letter-spacing:0.5px;">Reason</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${params.reason}</p>
      </div>
      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#111827;">🔄 What you can do</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${stepRow('1', '<strong style="color:#111827;">Review the reason above</strong> and adjust your item or listing details accordingly')}
        ${stepRow('2', '<strong style="color:#111827;">Resubmit</strong> the corrected item from your Jumia dashboard', true)}
      </table>
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

      ${divider}

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

      <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#111827;">✅ Before you go</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        ${stepRow('1', 'Ensure your item is <strong style="color:#111827;">properly sealed and packaged</strong> before going.')}
        ${stepRow('2', '<strong style="color:#111827;">Print and attach your shipping label</strong> to the outside of the package. Download it from your Jumia dashboard if needed.')}
        ${stepRow('3', 'Head to the VDO location above during opening hours and drop off your package.', true)}
      </table>

      ${ctaButton(`${params.appUrl}/dashboard/jumia`, 'View My Jumia Dashboard')}
    `),
  }),
};

import { supabase } from './supabase';

// Email templates
export const emailTemplates = {
welcome: (name: string, appUrl?: string) => ({
    subject: '🛍️ Welcome to QAFRICA — Your Store Awaits',
    body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Welcome to QAFRICA</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

          <!-- Header -->
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

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:20px;padding:40px 36px;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

              <!-- Greeting -->
              <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">
                Hey ${name}! 👋
              </p>
              <p style="margin:0 0 28px;font-size:16px;color:#6B7280;line-height:1.6;">
                You've just joined one of Africa's most powerful e-commerce platforms.
                Your store is ready — let's make it work for you.
              </p>

              <!-- Divider -->
              <div style="height:2px;background:linear-gradient(to right,#F97316,#FED7AA);border-radius:2px;margin-bottom:28px;"></div>

              <!-- Dropshipping section -->
              <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111827;">
                💡 Here's something powerful you should know
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                QAFRICA isn't just a store builder — it's a <strong style="color:#F97316;">dropshipping engine</strong>.
                That means you can sell products you don't physically own or stock.
              </p>

              <!-- How it works steps -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background:#FFF7ED;border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="font-size:16px;">🛒</span>
                        </td>
                        <td style="padding-left:14px;font-size:14px;color:#374151;line-height:1.5;">
                          <strong style="color:#111827;">Browse our catalog</strong> and import products directly into your store with one click
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background:#FFF7ED;border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="font-size:16px;">💰</span>
                        </td>
                        <td style="padding-left:14px;font-size:14px;color:#374151;line-height:1.5;">
                          <strong style="color:#111827;">Set your own prices</strong> — the difference between your price and the supplier's price is your profit
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background:#FFF7ED;border-radius:50%;text-align:center;vertical-align:middle;">
                          <span style="font-size:16px;">🚚</span>
                        </td>
                        <td style="padding-left:14px;font-size:14px;color:#374151;line-height:1.5;">
                          <strong style="color:#111827;">Supplier ships directly</strong> to your customer — you never touch the product
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Why you need it -->
              <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:28px;">
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">
                  <strong style="color:#F97316;">Why this matters for you:</strong> You can run a full Nigerian e-commerce business with 
                  <strong>zero upfront inventory cost</strong>. No warehouse. No packaging. Just you, your store, and your customers.
                </p>
              </div>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${appUrl || 'https://qafrica.store'}/dashboard"
                       style="display:inline-block;padding:14px 36px;background:#F97316;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">
                      Set Up My Store →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
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
</html>`,
  }),

  orderConfirmation: (orderDetails: {
    orderId: string;
    customerName: string;
    storeName: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
    deliveryAddress: string;
  }) => ({
    subject: `Order Confirmation - #${orderDetails.orderId}`,
    body: `
      <h1>Thank you for your order, ${orderDetails.customerName}!</h1>
      <p>Your order from <strong>${orderDetails.storeName}</strong> has been received.</p>
      
      <h2>Order Details</h2>
      <p><strong>Order ID:</strong> #${orderDetails.orderId}</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Item</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #ddd;">Qty</th>
            <th style="padding: 12px; text-align: right; border: 1px solid #ddd;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${orderDetails.items.map(item => `
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd;">${item.name}</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #ddd;">${item.quantity}</td>
              <td style="padding: 12px; text-align: right; border: 1px solid #ddd;">₦${item.price.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="background: #f5f5f5; font-weight: bold;">
            <td colspan="2" style="padding: 12px; border: 1px solid #ddd;">Total</td>
            <td style="padding: 12px; text-align: right; border: 1px solid #ddd;">₦${orderDetails.total.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>
      
      <p><strong>Delivery Address:</strong><br>${orderDetails.deliveryAddress}</p>
      
      <p>We'll notify you when your order is shipped.</p>
    `,
  }),

  orderShipped: (orderDetails: {
    orderId: string;
    customerName: string;
    storeName: string;
    trackingNumber?: string;
  }) => ({
    subject: `Your Order Has Been Shipped - #${orderDetails.orderId}`,
    body: `
      <h1>Good news, ${orderDetails.customerName}!</h1>
      <p>Your order from <strong>${orderDetails.storeName}</strong> has been shipped.</p>
      
      <p><strong>Order ID:</strong> #${orderDetails.orderId}</p>
      ${orderDetails.trackingNumber ? `<p><strong>Tracking Number:</strong> ${orderDetails.trackingNumber}</p>` : ''}
      
      <p>You can expect delivery within 3-7 business days.</p>
      
      <p>Thank you for shopping with us!</p>
    `,
  }),

  orderDelivered: (orderDetails: {
    orderId: string;
    customerName: string;
    storeName: string;
  }) => ({
    subject: `Order Delivered - #${orderDetails.orderId}`,
    body: `
      <h1>Your order has been delivered!</h1>
      <p>Hi ${orderDetails.customerName},</p>
      <p>Your order from <strong>${orderDetails.storeName}</strong> (Order #${orderDetails.orderId}) has been delivered.</p>
      
      <p>We hope you love your purchase! If you have any issues, please contact the seller directly.</p>
      
      <p>Enjoy your items!</p>
    `,
  }),

  newOrder: (orderDetails: {
    orderId: string;
    storeName: string;
    customerName: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    total: number;
  }) => ({
    subject: `New Order Received - #${orderDetails.orderId}`,
    body: `
      <h1>New Order Alert!</h1>
      <p>You've received a new order for your store <strong>${orderDetails.storeName}</strong>.</p>
      
      <p><strong>Order ID:</strong> #${orderDetails.orderId}</p>
      <p><strong>Customer:</strong> ${orderDetails.customerName}</p>
      
      <h2>Items Ordered</h2>
      <ul>
        ${orderDetails.items.map(item => `
          <li>${item.name} x ${item.quantity} - ₦${item.price.toLocaleString()}</li>
        `).join('')}
      </ul>
      
      <p><strong>Total:</strong> ₦${orderDetails.total.toLocaleString()}</p>
      
      <a href="${window.location.origin}/dashboard/orders" style="display: inline-block; padding: 12px 24px; background: #F97316; color: white; text-decoration: none; border-radius: 8px;">View Order</a>
    `,
  }),

  lowStock: (productDetails: {
    productName: string;
    currentStock: number;
    threshold: number;
    storeName: string;
  }) => ({
    subject: `Low Stock Alert - ${productDetails.productName}`,
    body: `
      <h1>Low Stock Alert</h1>
      <p>The following product is running low on stock:</p>
      
      <p><strong>Product:</strong> ${productDetails.productName}</p>
      <p><strong>Store:</strong> ${productDetails.storeName}</p>
      <p><strong>Current Stock:</strong> ${productDetails.currentStock}</p>
      <p><strong>Threshold:</strong> ${productDetails.threshold}</p>
      
      <a href="${window.location.origin}/dashboard/products" style="display: inline-block; padding: 12px 24px; background: #F97316; color: white; text-decoration: none; border-radius: 8px;">Restock Now</a>
    `,
  }),

  passwordReset: (resetUrl: string) => ({
    subject: 'Password Reset Request',
    body: `
      <h1>Password Reset</h1>
      <p>You requested a password reset for your QAFRICA account.</p>
      <p>Click the button below to reset your password:</p>
      
      <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #F97316; color: white; text-decoration: none; border-radius: 8px;">Reset Password</a>
      
      <p style="margin-top: 20px; color: #666;">If you didn't request this, you can safely ignore this email.</p>
      <p style="color: #666;">This link will expire in 1 hour.</p>
    `,
  }),

  subscriptionExpiring: (details: {
    storeName: string;
    expiryDate: string;
  }) => ({
    subject: 'Your Subscription is Expiring Soon',
    body: `
      <h1>Subscription Expiring Soon</h1>
      <p>Your store <strong>${details.storeName}</strong> subscription will expire on <strong>${details.expiryDate}</strong>.</p>
      
      <p>Renew now to keep your store active and avoid any interruption to your business.</p>
      
      <a href="${window.location.origin}/dashboard/subscription" style="display: inline-block; padding: 12px 24px; background: #F97316; color: white; text-decoration: none; border-radius: 8px;">Renew Subscription</a>
    `,
  }),
};

// Send email using Supabase Edge Function (when implemented)
// For now, we'll use a mock implementation
export const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    // In production, this would call a Supabase Edge Function
    // that uses a service like SendGrid, Mailgun, or AWS SES
    
    // For now, log the email (in development)
    if (import.meta.env.DEV) {
      console.log('Email would be sent:', { to, subject, html });
    }
    
    // Call Supabase Edge Function when available
    const { error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html },
    });
    
    if (error) {
      console.error('Email send error:', error);
      // Don't fail the operation if email fails
      return { success: true };
    }
    
    return { success: true };
  } catch (err) {
    console.error('Email send error:', err);
    // Don't fail the operation if email fails
    return { success: true };
  }
};

// Send welcome email
export const sendWelcomeEmail = async (email: string, name: string) => {
  const template = emailTemplates.welcome(name);
  return sendEmail({ to: email, subject: template.subject, html: template.body });
};

// Send order confirmation to customer
export const sendOrderConfirmationEmail = async (email: string, orderDetails: Parameters<typeof emailTemplates.orderConfirmation>[0]) => {
  const template = emailTemplates.orderConfirmation(orderDetails);
  return sendEmail({ to: email, subject: template.subject, html: template.body });
};

// Send order shipped notification
export const sendOrderShippedEmail = async (email: string, orderDetails: Parameters<typeof emailTemplates.orderShipped>[0]) => {
  const template = emailTemplates.orderShipped(orderDetails);
  return sendEmail({ to: email, subject: template.subject, html: template.body });
};

// Send order delivered notification
export const sendOrderDeliveredEmail = async (email: string, orderDetails: Parameters<typeof emailTemplates.orderDelivered>[0]) => {
  const template = emailTemplates.orderDelivered(orderDetails);
  return sendEmail({ to: email, subject: template.subject, html: template.body });
};

// Send new order notification to seller
export const sendNewOrderEmail = async (email: string, orderDetails: Parameters<typeof emailTemplates.newOrder>[0]) => {
  const template = emailTemplates.newOrder(orderDetails);
  return sendEmail({ to: email, subject: template.subject, html: template.body });
};

// Send low stock alert
export const sendLowStockEmail = async (email: string, productDetails: Parameters<typeof emailTemplates.lowStock>[0]) => {
  const template = emailTemplates.lowStock(productDetails);
  return sendEmail({ to: email, subject: template.subject, html: template.body });
};

// Send password reset email
export const sendPasswordResetEmail = async (email: string, resetUrl: string) => {
  const template = emailTemplates.passwordReset(resetUrl);
  return sendEmail({ to: email, subject: template.subject, html: template.body });
};

// Send subscription expiring notification
export const sendSubscriptionExpiringEmail = async (email: string, details: Parameters<typeof emailTemplates.subscriptionExpiring>[0]) => {
  const template = emailTemplates.subscriptionExpiring(details);
  return sendEmail({ to: email, subject: template.subject, html: template.body });
};

// Store created email template
const storeCreatedTemplate = (name: string, storeName: string, storeSlug: string, appUrl: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${storeName} is live</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:'Segoe UI',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

          <!-- Header -->
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

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:20px;padding:40px 36px;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

              <p style="margin:0 0 8px;font-size:26px;font-weight:800;color:#111827;">
                🎉 ${storeName} is live, ${name}!
              </p>
              <p style="margin:0 0 28px;font-size:16px;color:#6B7280;line-height:1.6;">
                Your store is set up and ready to start selling. Here's how to grow it fast.
              </p>

              <div style="height:2px;background:linear-gradient(to right,#F97316,#FED7AA);border-radius:2px;margin-bottom:28px;"></div>

              <!-- Steps -->
              <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#111827;">🚀 Your next 3 moves</p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background:#FFF7ED;border-radius:50%;text-align:center;vertical-align:middle;font-size:16px;">1</td>
                        <td style="padding-left:14px;font-size:14px;color:#374151;line-height:1.5;">
                          <strong style="color:#111827;">Add your products</strong> — upload your own inventory or import from the QAFRICA catalog
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #F3F4F6;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background:#FFF7ED;border-radius:50%;text-align:center;vertical-align:middle;font-size:16px;">2</td>
                        <td style="padding-left:14px;font-size:14px;color:#374151;line-height:1.5;">
                          <strong style="color:#111827;">Share your store link</strong> — your store is live at
                          <a href="${appUrl}/store/${storeSlug}" style="color:#F97316;text-decoration:none;">qafrica.store/${storeSlug}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:36px;height:36px;background:#FFF7ED;border-radius:50%;text-align:center;vertical-align:middle;font-size:16px;">3</td>
                        <td style="padding-left:14px;font-size:14px;color:#374151;line-height:1.5;">
                          <strong style="color:#111827;">Set up delivery zones</strong> — define which states you ship to and your delivery fees
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${appUrl}/dashboard"
                       style="display:inline-block;padding:14px 36px;background:#F97316;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:0.3px;">
                      Go to My Dashboard →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
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

// Send store created email
export const sendStoreCreatedEmail = async (
  email: string,
  name: string,
  storeName: string,
  storeSlug: string,
) => {
  const appUrl = window.location.origin;
  return sendEmail({
    to: email,
    subject: `🎉 ${storeName} is live — here's how to grow it`,
    html: storeCreatedTemplate(name, storeName, storeSlug, appUrl),
  });
};
// Process the email queue — call this after any key event
export const processEmailQueue = async () => {
  try {
    await supabase.functions.invoke('send-email', {
      body: { action: 'process_queue' },
    });
  } catch (err) {
    console.error('[Email] Queue process error:', err);
  }
};

// Call after order is placed
export const triggerOrderEmails = async () => processEmailQueue();

// Call after product price update
export const triggerPriceChangeEmails = async () => processEmailQueue();

// Call after stock update
export const triggerStockEmails = async () => processEmailQueue();
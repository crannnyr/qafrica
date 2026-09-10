-- Batch 4 (Timed Out Orders / Restore): tracking columns for restored
-- orders, and a reminder cadence for customers whose restored order is
-- missing shipping method / delivery info (china_import_failed_orders never
-- preserved that data, since the original order carried it, not the
-- snapshot — see order-reminders' 24h expiry, which only copies
-- code/customer_name/user_id/items/total_ngn/delivery_type/payment_method).

alter table public.china_import_orders
  add column restored_at timestamptz,
  add column restored_from_failed_order_id uuid,
  add column shipping_info_reminder_count integer not null default 0,
  add column last_shipping_info_reminder_at timestamptz;

comment on column public.china_import_orders.restored_at is 'Set when this order was recreated via admin Restore from a timed-out (china_import_failed_orders) record. Such orders are missing shipping_method and delivery_address/pickup_station — the customer is reminded to set them until both are present.';

alter table public.china_import_failed_orders
  add column restored_at timestamptz,
  add column restored_order_id uuid;

comment on column public.china_import_failed_orders.restored_order_id is 'The new china_import_orders.id created when an admin restored this timed-out order. NULL until restored.';

-- Seed templates (editable afterward from the admin Message Templates screen)
insert into public.import_message_templates (key, label, description, subject, body_html, available_placeholders) values
(
  'order_restored_apology',
  'Order restored (apology)',
  'Sent once, immediately, when an admin restores a timed-out order after spotting the payment late.',
  'Sorry about that — your order {{order_code}} is back and paid ✅',
  '<h2 style="color:#111827;margin:0 0 8px;">We found your payment — sorry for the delay 🙏</h2>
   <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
     Hi {{customer_name}}, your order <strong>{{order_code}}</strong> had timed out in our system before we
     could confirm your payment, but we''ve since found it and restored your order — it''s now marked paid.
   </p>
   <p style="color:#6B7280;margin:0 0 20px;line-height:1.6;">
     One thing we do need from you: since the order timed out, we lost your shipping method and delivery
     details. Please log in to your dashboard and set these so we can keep your order moving.
   </p>
   <a href="{{dashboard_link}}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
     Set my delivery details →
   </a>
   <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">Order code: {{order_code}}</p>',
  ARRAY['customer_name', 'order_code', 'dashboard_link']
),
(
  'shipping_info_needed',
  'Reminder: set shipping info (restored orders)',
  'Sent hourly for the first 24h after a restore, then once daily at 6pm, until the customer sets shipping method + delivery details.',
  'Action needed: set delivery details for order {{order_code}}',
  '<h2 style="color:#111827;margin:0 0 8px;">Quick thing before we can ship this 📦</h2>
   <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
     Hi {{customer_name}}, your order <strong>{{order_code}}</strong> is paid, but we still need your
     shipping method and delivery details to move it along.
   </p>
   <a href="{{dashboard_link}}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
     Set my delivery details →
   </a>
   <p style="color:#6B7280;margin:16px 0 0;line-height:1.6;font-size:13px;">
     Any trouble? Message us on WhatsApp and we''ll sort it out together.
   </p>
   <a href="https://chat.whatsapp.com/DggRK0IeD94F0vyszfhfPW" style="color:#F97316;font-size:13px;font-weight:700;text-decoration:none;">
     Talk to us on WhatsApp →
   </a>
   <p style="color:#9CA3AF;font-size:12px;margin-top:24px;">Order code: {{order_code}}</p>',
  ARRAY['customer_name', 'order_code', 'dashboard_link']
);

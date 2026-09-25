-- Customer-facing China Import fulfillment notifications.
-- Reuses the existing import_message_templates + import_notification_queue
-- email pipeline. Notifications are idempotent per fulfillment event.

create table if not exists public.china_import_customer_notification_log (
  id uuid primary key default gen_random_uuid(),
  notification_key text not null unique,
  order_id uuid not null references public.china_import_orders(id) on delete cascade,
  shipment_id uuid references public.china_import_shipments(id) on delete cascade,
  notification_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_china_import_customer_notification_log_order
  on public.china_import_customer_notification_log(order_id);

alter table public.china_import_customer_notification_log enable row level security;

insert into public.import_message_templates
  (key, label, description, subject, body_html, available_placeholders)
values
(
  'fulfillment_partial_shipment',
  'Partial shipment update',
  'Sent when only part of a China Import order is shipped. Includes the items shipped and the items still remaining.',
  'Part of your order {{order_code}} has shipped 📦',
  '<h2 style="color:#111827;margin:0 0 8px;">Part of your order has shipped</h2>
   <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
     Hi {{customer_name}}, part of order <strong>{{order_code}}</strong> has now been shipped.
   </p>
   <div style="background:#F0FDF4;border-left:4px solid #16A34A;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:16px;">
     <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#166534;">Shipped</p>
     {{shipped_items_html}}
   </div>
   <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:16px;">
     <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#9A3412;">Still remaining</p>
     {{remaining_items_html}}
   </div>
   <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
     Shipment: <strong>{{shipment_code}}</strong><br/>
     Tracking: {{tracking_number}}
   </p>
   <a href="{{tracking_link}}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">
     Track shipment →
   </a>',
  array['customer_name','order_code','shipped_items_html','remaining_items_html','shipment_code','tracking_number','tracking_link']
),
(
  'fulfillment_partial_delivery',
  'Partial delivery update',
  'Sent when a China Import shipment is delivered but other order items are still outstanding.',
  'An update on your order {{order_code}}',
  '<h2 style="color:#111827;margin:0 0 8px;">Part of your order has been delivered</h2>
   <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
     Hi {{customer_name}}, some items from order <strong>{{order_code}}</strong> have been delivered.
   </p>
   <div style="background:#F0FDF4;border-left:4px solid #16A34A;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:16px;">
     <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#166534;">Delivered</p>
     {{delivered_items_html}}
   </div>
   <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;">
     <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#9A3412;">Still outstanding</p>
     {{remaining_items_html}}
   </div>',
  array['customer_name','order_code','delivered_items_html','remaining_items_html']
),
(
  'fulfillment_order_complete',
  'China Import order complete',
  'Sent once when every item in a China Import order has been delivered.',
  'Your order {{order_code}} is now complete 🎉',
  '<h2 style="color:#111827;margin:0 0 8px;">Your order is now complete</h2>
   <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
     Hi {{customer_name}}, all items from order <strong>{{order_code}}</strong> have now been delivered.
   </p>
   <div style="background:#F0FDF4;border-left:4px solid #16A34A;border-radius:0 10px 10px 0;padding:16px 20px;">
     <p style="margin:0;color:#166534;font-size:14px;line-height:1.6;">
       Thank you for using QAFRICA Import.
     </p>
   </div>',
  array['customer_name','order_code']
)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  subject = excluded.subject,
  body_html = excluded.body_html,
  available_placeholders = excluded.available_placeholders,
  updated_at = now();

-- Batch 4c: templates for admin-initiated per-item overrides in the
-- "by customer" closed-batch view and the general order view — shipping
-- method reassignment and variant (size/color) changes, both editable
-- afterward from MessageTemplatesEditor.

insert into public.import_message_templates (key, label, description, subject, body_html, available_placeholders)
values (
  'item_shipping_reassigned',
  'Item shipping reassigned',
  'Sent when admin changes the shipping method for one item on an order (flight/sea, per-item override).',
  'Your {{item_name}} is now shipping by {{new_method_label}}',
  '<h2 style="color:#111827;margin:0 0 8px;">A quick update on one item in your order</h2>
   <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
     Hi {{customer_name}}, we''ve moved <strong>{{item_name}}</strong> from order <strong>{{order_code}}</strong> to <strong>{{new_method_label}}</strong> due to flight/cost constraints. The rest of your order is proceeding as normal.
   </p>
   <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;">
     <p style="margin:0;font-size:14px;color:#374151;">
       New estimated arrival window: <strong>{{arrival_window}}</strong> from ship date.
     </p>
   </div>',
  array['customer_name', 'order_code', 'item_name', 'new_method_label', 'arrival_window']
);

insert into public.import_message_templates (key, label, description, subject, body_html, available_placeholders)
values (
  'item_variant_changed',
  'Item variant changed',
  'Sent when admin changes the variant (e.g. size/color) of one item on an order, per a customer request.',
  'We updated the variant on your {{item_name}} — order {{order_code}}',
  '<h2 style="color:#111827;margin:0 0 8px;">A quick update on your order</h2>
   <p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">
     Hi {{customer_name}}, as requested we''ve changed <strong>{{item_name}}</strong> on order <strong>{{order_code}}</strong>
     from <strong>{{old_variant}}</strong> to <strong>{{new_variant}}</strong>.
   </p>
   <div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:16px 20px;">
     <p style="margin:0;font-size:14px;color:#374151;">
       Updated price for this item: <strong>{{new_price}}</strong>.
     </p>
   </div>',
  array['customer_name', 'order_code', 'item_name', 'old_variant', 'new_variant', 'new_price']
);

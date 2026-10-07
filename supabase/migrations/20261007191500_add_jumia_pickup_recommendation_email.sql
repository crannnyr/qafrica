-- Customer email template for recommending Jumia pickup on eligible existing orders.
insert into public.import_message_templates
  (key, label, description, subject, body_html, available_placeholders)
values (
  'pickup_station_recommendation',
  'Jumia pickup station recommendation',
  'Sent to customers with a paid, active, home-delivery China Import order, including orders that have already shipped, explaining how to switch the order to a nearby Jumia pickup station.',
  'You can still switch your QAFRICA order to a Jumia pickup station 📦',
  '<h2 style="color:#111827;margin:0 0 8px;">A simpler way to receive your order</h2>
<p style="color:#6B7280;margin:0 0 16px;line-height:1.6;">Hi {{customer_name}}, if you have an eligible QAFRICA order that was set for home delivery, you can still switch it to a Jumia pickup station near you.</p>
<p style="color:#6B7280;margin:0 0 12px;line-height:1.6;"><strong style="color:#111827;">How to change it:</strong></p>
<ol style="color:#6B7280;margin:0 0 20px;padding-left:20px;line-height:1.8;">
<li>Open your QAFRICA dashboard.</li>
<li>Look for the <strong style="color:#111827;">Jumia pickup</strong> recommendation under your eligible order.</li>
<li>Tap <strong style="color:#111827;">Switch to pickup</strong>.</li>
<li>Choose a Jumia pickup station near your city or state.</li>
<li>Tap the station you want. Your order amount and items stay the same; only the delivery destination changes.</li>
</ol>
<div style="background:#FFF7ED;border-left:4px solid #F97316;border-radius:0 10px 10px 0;padding:14px 16px;margin-bottom:20px;"><p style="margin:0;color:#374151;font-size:13px;line-height:1.6;">Choose a station that is convenient for you to reach. Even if your order has already shipped, you can still switch it to a Jumia pickup station as long as the order is still active. Completed, delivered, cancelled, or closed orders cannot be changed.</p></div>
<a href="https://qafrica.store/importations/dashboard" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;font-weight:700;">Open my order dashboard →</a>',
  array['customer_name']
)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  subject = excluded.subject,
  body_html = excluded.body_html,
  available_placeholders = excluded.available_placeholders,
  updated_at = now();

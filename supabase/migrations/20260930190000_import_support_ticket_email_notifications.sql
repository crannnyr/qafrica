-- Email customers when an import support ticket is created or reaches a
-- customer-visible terminal/waiting state. Messages are queued through the
-- existing email_queue/process-email-queue pipeline.
create or replace function public.queue_import_support_ticket_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient text;
  recipient_name text;
  event_label text;
  subject_line text;
  ticket_code text;
  safe_name text;
  safe_subject text;
  safe_description text;
  safe_status text;
begin
  if tg_op = 'INSERT' then
    event_label := 'created';
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status and new.status in ('waiting_customer','resolved','closed') then
    event_label := new.status;
  else
    return new;
  end if;

  select c.email, c.full_name
    into recipient, recipient_name
  from public.customers c
  where c.id = new.customer_id;

  if recipient is null or recipient !~ '^[^[:space:]@,;]+@[^[:space:]@,;.]+(\.[^[:space:]@,;.]+)+$' then
    return new;
  end if;

  ticket_code := 'QAF-' || lpad(new.ticket_number::text, 6, '0');
  safe_name := replace(replace(replace(coalesce(nullif(recipient_name, ''), 'there'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  safe_subject := replace(replace(replace(coalesce(new.subject, 'Support request'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  safe_description := replace(replace(replace(coalesce(new.description, 'No additional description was provided.'), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');
  safe_status := replace(replace(replace(initcap(replace(event_label, '_', ' ')), '&', '&amp;'), '<', '&lt;'), '>', '&gt;');

  subject_line := 'QAFRICA support ticket ' || ticket_code || ' — ' || event_label;

  insert into public.email_queue (
    to_email,
    to_name,
    template_name,
    template_data,
    status,
    scheduled_for,
    email_type,
    priority,
    is_manually_triggered,
    subject,
    html_body
  ) values (
    recipient,
    recipient_name,
    'generic',
    '{}'::jsonb,
    'pending',
    now(),
    'support_ticket',
    3,
    false,
    subject_line,
    '<!doctype html><html><body style="margin:0;padding:32px;background:#f9fafb;font-family:Arial,sans-serif;color:#111827"><div style="max-width:600px;margin:auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e5e7eb"><div style="font-size:22px;font-weight:800;color:#f97316;margin-bottom:24px">QAFRICA</div><p style="font-size:18px;font-weight:700">Hi ' || safe_name || ',</p><p>Your support ticket <strong>' || ticket_code || '</strong> has been <strong>' || safe_status || '</strong>.</p><div style="background:#f9fafb;border-radius:12px;padding:16px;margin:20px 0"><p style="margin:0 0 8px;font-weight:700">' || safe_subject || '</p><p style="margin:0;color:#4b5563;white-space:pre-wrap">' || safe_description || '</p></div><p style="color:#6b7280;font-size:13px">Keep this ticket number if you need to contact QAFRICA support about this request.</p></div></body></html>'
  );

  return new;
end;
$$;

drop trigger if exists trg_import_support_ticket_email_insert on public.import_support_tickets;
create trigger trg_import_support_ticket_email_insert
after insert on public.import_support_tickets
for each row execute function public.queue_import_support_ticket_email();

drop trigger if exists trg_import_support_ticket_email_status on public.import_support_tickets;
create trigger trg_import_support_ticket_email_status
after update of status on public.import_support_tickets
for each row execute function public.queue_import_support_ticket_email();

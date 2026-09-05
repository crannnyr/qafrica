-- Email hardening, part 1: schema
-- Landing zone for Resend webhook events. This is what makes bounce rate a
-- live measurement instead of something we read off a dashboard once a week,
-- and it is what the auto-ramp steers on.
create table if not exists email_delivery_events (
  id            uuid primary key default gen_random_uuid(),
  resend_id     text,
  event_type    text not null,
  email         text not null,
  domain        text generated always as (lower(split_part(email, '@', 2))) stored,
  subject       text,
  bounce_type   text,
  bounce_reason text,
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists idx_ede_occurred   on email_delivery_events (occurred_at desc);
create index if not exists idx_ede_domain_occ on email_delivery_events (domain, occurred_at desc);
create index if not exists idx_ede_type_occ   on email_delivery_events (event_type, occurred_at desc);
-- Resend can retry a webhook; the same event must not be counted twice or the
-- bounce rate the ramp steers on is wrong.
create unique index if not exists idx_ede_dedupe
  on email_delivery_events (resend_id, event_type) where resend_id is not null;

alter table email_delivery_events enable row level security;

-- Transactional mail (password resets, bills, order confirmations) must never
-- be dropped because a marketing send used up the day's budget.
alter table email_type_settings
  add column if not exists is_transactional boolean not null default false;

-- One global ceiling, so no single bug or admin action can ever emit 11,682
-- messages in a day again.
create table if not exists email_global_settings (
  id                 int primary key default 1,
  daily_ceiling      int  not null default 2000,
  sent_today         int  not null default 0,
  last_reset_at      timestamptz not null default now(),
  auto_ramp_enabled  boolean not null default true,
  ramp_last_run_at   timestamptz,
  updated_at         timestamptz not null default now(),
  constraint email_global_settings_singleton check (id = 1)
);

alter table email_global_settings enable row level security;

insert into email_global_settings (id) values (1) on conflict (id) do nothing;

-- Types that send-email's detectEmailType() can produce but which had no row
-- here. An unknown type returned can_send=true with NO limit at all -- an
-- uncapped hole straight through the rate limiter.
insert into email_type_settings (email_type, display_name, description, daily_limit, priority, is_transactional)
values
  ('generic',            'Generic / uncategorised', 'Anything detectEmailType could not classify', 500, 5, false),
  ('bill_due',           'Bill due',                'Consolidation, shipping and clearance bills', 500, 1, true),
  ('question_answered',  'Product question answered','Reply to a customer product question',       300, 3, false),
  ('order_to_review',    'Order ready for review',  'Shipping fee confirmed, order to review',     500, 3, false),
  ('email_verification', 'Email confirmation code', 'Six-digit code to confirm an address',        500, 1, true)
on conflict (email_type) do nothing;

-- Mark the lanes. Transactional mail is mail the customer is actively waiting
-- for; everything else can wait for capacity.
update email_type_settings
set is_transactional = true, priority = 1
where email_type in (
  'password_reset', 'email_verification', 'bill_due',
  'order_confirmed', 'order_placed', 'order_shipped', 'order_delivered',
  'escrow_released', 'withdrawal_approved', 'withdrawal_rejected'
);

-- Welcome is the single highest-volume type and is not urgent: a new customer
-- can receive it ten minutes later without noticing. Raising the daily limit
-- from 200 lets a surge drain rather than pile up, while the domain throttle
-- and global ceiling still hold the actual rate down.
update email_type_settings
set daily_limit = 1500, priority = 6, is_transactional = false
where email_type = 'welcome';

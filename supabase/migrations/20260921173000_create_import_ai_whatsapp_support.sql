create table if not exists public.import_ai_whatsapp_links (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  whatsapp_wa_id text unique,
  whatsapp_phone text,
  linked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists import_ai_whatsapp_links_customer_idx
  on public.import_ai_whatsapp_links(customer_id, created_at desc);
create index if not exists import_ai_whatsapp_links_code_idx
  on public.import_ai_whatsapp_links(code_hash);

create table if not exists public.import_ai_whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  wa_id text not null unique,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'ai'
    check (status in ('ai','human_requested','human_assigned','human_active','returned_to_ai','closed')),
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists import_ai_whatsapp_conversations_customer_idx
  on public.import_ai_whatsapp_conversations(customer_id, updated_at desc);

create table if not exists public.import_ai_whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.import_ai_whatsapp_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  sender_type text not null check (sender_type in ('customer','ai','human','system')),
  body text not null,
  whatsapp_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists import_ai_whatsapp_messages_conversation_idx
  on public.import_ai_whatsapp_messages(conversation_id, created_at);

alter table public.import_ai_whatsapp_links enable row level security;
alter table public.import_ai_whatsapp_conversations enable row level security;
alter table public.import_ai_whatsapp_messages enable row level security;
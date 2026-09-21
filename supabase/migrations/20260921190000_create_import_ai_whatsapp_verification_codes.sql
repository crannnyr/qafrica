create table if not exists public.import_ai_whatsapp_verification_codes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.import_ai_whatsapp_conversations(id) on delete cascade,
  email text not null,
  customer_id uuid references public.customers(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_ai_whatsapp_verification_codes_conversation
  on public.import_ai_whatsapp_verification_codes(conversation_id, created_at desc);

create index if not exists idx_import_ai_whatsapp_verification_codes_email
  on public.import_ai_whatsapp_verification_codes(lower(email), created_at desc);

alter table public.import_ai_whatsapp_verification_codes enable row level security;
revoke all on public.import_ai_whatsapp_verification_codes from anon, authenticated;

create index if not exists idx_import_ai_whatsapp_conversations_status_updated
  on public.import_ai_whatsapp_conversations(status, updated_at desc);
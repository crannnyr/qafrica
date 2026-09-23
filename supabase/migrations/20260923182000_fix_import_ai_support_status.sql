-- Normalize AI support conversation lifecycle statuses.
-- Older conversations used "closed"; the support UI now uses "resolved".
ALTER TABLE public.import_ai_whatsapp_conversations
  DROP CONSTRAINT IF EXISTS import_ai_whatsapp_conversations_status_check;

UPDATE public.import_ai_whatsapp_conversations
SET status = 'resolved'
WHERE status = 'closed';

ALTER TABLE public.import_ai_whatsapp_conversations
  ADD CONSTRAINT import_ai_whatsapp_conversations_status_check
  CHECK (status = ANY (ARRAY[
    'ai'::text,
    'human_requested'::text,
    'human_assigned'::text,
    'human_active'::text,
    'returned_to_ai'::text,
    'resolved'::text
  ]));

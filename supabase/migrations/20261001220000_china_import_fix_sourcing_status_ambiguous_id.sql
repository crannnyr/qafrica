-- China import only: qualify the allocation id inside the status RPC.
-- The previous function returned a column named `id`, which made an
-- unqualified `where id = ...` ambiguous in PL/pgSQL.

create or replace function public.china_import_set_sourcing_allocation_status(
  p_allocation_id uuid,
  p_batch_key text,
  p_status text
)
returns table(id uuid,status text)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if p_status not in ('uncommitted','committed','purchased') then
    raise exception 'Invalid sourcing status';
  end if;

  update public.import_sourcing_allocations as a
  set status=p_status,
      updated_at=now()
  where a.id=p_allocation_id
    and a.batch_key=p_batch_key
    and a.status<>'cancelled';

  if not found then
    raise exception 'Sourcing allocation not found';
  end if;

  return query
  select a.id,a.status
  from public.import_sourcing_allocations as a
  where a.id=p_allocation_id;
end;
$$;

revoke all on function public.china_import_set_sourcing_allocation_status(uuid,text,text) from public;

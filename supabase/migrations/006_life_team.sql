-- Life Team profession slots. Apply after 005_reviews_and_requests.sql.
-- Commit only. Do not run this against the hosted database from the app.
-- A member chooses their own #1 and up to two backups. Rank is never for sale.

alter table public.professionals
  add column if not exists life_role text;

comment on column public.professionals.life_role is
  'Life Team label, such as Plumber or Personal trainer. The member chooses who fills a slot. It cannot be bought.';

grant update (life_role) on public.professionals to authenticated;

create table if not exists public.life_team_slots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  profession text not null,
  custom boolean not null default false,
  created_at timestamptz not null default now(),
  unique (owner_id, profession)
);

create table if not exists public.life_team_picks (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.life_team_slots (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  created_at timestamptz not null default now(),
  unique (slot_id, rank),
  unique (slot_id, professional_id)
);

comment on column public.life_team_picks.rank is
  '1 is the member''s #1. 2 and 3 are backups. Only the slot owner can set this. It cannot be paid for.';

create table if not exists public.life_team_asks (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.life_team_slots (id) on delete cascade,
  asker_id uuid not null references public.profiles (id) on delete cascade,
  profession text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.life_team_replies (
  id uuid primary key default gen_random_uuid(),
  ask_id uuid not null references public.life_team_asks (id) on delete cascade,
  replier_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (ask_id, replier_id)
);

create index if not exists life_team_slots_owner_idx on public.life_team_slots (owner_id);
create index if not exists life_team_picks_professional_idx on public.life_team_picks (professional_id);

alter table public.life_team_slots enable row level security;
alter table public.life_team_picks enable row level security;
alter table public.life_team_asks enable row level security;
alter table public.life_team_replies enable row level security;

drop policy if exists life_team_slots_select on public.life_team_slots;
create policy life_team_slots_select on public.life_team_slots
for select to authenticated
using (
  owner_id = auth.uid()
  or public.connection_status(owner_id, auth.uid()) = 'accepted'
  or public.is_admin()
);

drop policy if exists life_team_slots_insert on public.life_team_slots;
create policy life_team_slots_insert on public.life_team_slots
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists life_team_slots_delete on public.life_team_slots;
create policy life_team_slots_delete on public.life_team_slots
for delete to authenticated
using (owner_id = auth.uid() and custom = true);

drop policy if exists life_team_picks_select on public.life_team_picks;
create policy life_team_picks_select on public.life_team_picks
for select to authenticated
using (
  exists (
    select 1 from public.life_team_slots s
    where s.id = life_team_picks.slot_id
      and (
        s.owner_id = auth.uid()
        or public.connection_status(s.owner_id, auth.uid()) = 'accepted'
        or public.is_admin()
      )
  )
);

drop policy if exists life_team_picks_write on public.life_team_picks;
create policy life_team_picks_insert on public.life_team_picks
for insert to authenticated
with check (
  exists (
    select 1 from public.life_team_slots s
    where s.id = life_team_picks.slot_id and s.owner_id = auth.uid()
  )
);

drop policy if exists life_team_picks_update on public.life_team_picks;
create policy life_team_picks_update on public.life_team_picks
for update to authenticated
using (
  exists (
    select 1 from public.life_team_slots s
    where s.id = life_team_picks.slot_id and s.owner_id = auth.uid()
  )
);

drop policy if exists life_team_picks_delete on public.life_team_picks;
create policy life_team_picks_delete on public.life_team_picks
for delete to authenticated
using (
  exists (
    select 1 from public.life_team_slots s
    where s.id = life_team_picks.slot_id and s.owner_id = auth.uid()
  )
);

drop policy if exists life_team_asks_select on public.life_team_asks;
create policy life_team_asks_select on public.life_team_asks
for select to authenticated
using (
  asker_id = auth.uid()
  or public.connection_status(asker_id, auth.uid()) = 'accepted'
);

drop policy if exists life_team_asks_insert on public.life_team_asks;
create policy life_team_asks_insert on public.life_team_asks
for insert to authenticated
with check (asker_id = auth.uid() and status = 'open');

drop policy if exists life_team_replies_select on public.life_team_replies;
create policy life_team_replies_select on public.life_team_replies
for select to authenticated
using (
  replier_id = auth.uid()
  or exists (
    select 1 from public.life_team_asks a
    where a.id = life_team_replies.ask_id and a.asker_id = auth.uid()
  )
);

drop policy if exists life_team_replies_insert on public.life_team_replies;
create policy life_team_replies_insert on public.life_team_replies
for insert to authenticated
with check (
  replier_id = auth.uid()
  and exists (
    select 1 from public.life_team_asks a
    where a.id = life_team_replies.ask_id
      and a.status = 'open'
      and public.connection_status(a.asker_id, auth.uid()) = 'accepted'
  )
);

grant select, insert, delete on public.life_team_slots to authenticated;
grant select, insert, update, delete on public.life_team_picks to authenticated;
grant select, insert on public.life_team_asks to authenticated;
grant select, insert on public.life_team_replies to authenticated;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'notifications'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%life_team%'
       or (
         nsp.nspname = 'public'
         and rel.relname = 'notifications'
         and con.contype = 'c'
         and pg_get_constraintdef(con.oid) ilike '%service_request_update%'
       )
  loop
    execute format('alter table public.notifications drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'connection_request',
    'connection_accepted',
    'recommendation_shared',
    'introduction_request',
    'introduction_accepted',
    'introduction_declined',
    'message',
    'invitation_accepted',
    'reference_request',
    'service_request',
    'service_request_update',
    'application_update',
    'report_resolved',
    'life_team_ask',
    'life_team_reply'
  ));

create or replace function public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_reference_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_type not in (
    'connection_request', 'connection_accepted', 'recommendation_shared',
    'introduction_request', 'introduction_accepted', 'introduction_declined',
    'message', 'invitation_accepted', 'reference_request',
    'service_request', 'service_request_update', 'application_update', 'report_resolved',
    'life_team_ask', 'life_team_reply'
  ) then
    raise exception 'Invalid notification type';
  end if;
  if not public.can_notify(p_recipient_id) then
    raise exception 'Not authorized to notify this person';
  end if;
  insert into public.notifications (recipient_id, type, title, body, reference_id)
  values (p_recipient_id, p_type, left(coalesce(p_title, ''), 180), left(coalesce(p_body, ''), 500), p_reference_id)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.create_notification(uuid, text, text, text, uuid) from public;
grant execute on function public.create_notification(uuid, text, text, text, uuid) to authenticated;

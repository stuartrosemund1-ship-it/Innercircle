-- Reviews, quote requests, richer profiles, and notification preferences.
-- Apply after 004_admin_and_legal.sql. Commit only. Do not run this against
-- the hosted database from the app.

alter table public.profiles
  add column if not exists notification_preferences jsonb not null default jsonb_build_object(
    'requests', true,
    'introductions', true,
    'references', true,
    'applications', true,
    'reports', true
  );

alter table public.professionals
  add column if not exists qualifications text[] not null default '{}',
  add column if not exists portfolio jsonb not null default '[]'::jsonb,
  add column if not exists typical_response_time text;

grant update (notification_preferences) on public.profiles to authenticated;
grant update (qualifications, portfolio, typical_response_time) on public.professionals to authenticated;

create table if not exists public.service_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  service_needed text not null,
  preferred_dates text not null,
  location text not null,
  budget numeric,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'proposed', 'completed', 'cancelled')),
  proposed_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_requests_professional_idx on public.service_requests (professional_id, status);
create index if not exists service_requests_member_idx on public.service_requests (member_id, status);

create table if not exists public.professional_reviews (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null,
  owner_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  unique (professional_id, author_id)
);

create index if not exists professional_reviews_professional_idx on public.professional_reviews (professional_id);

create or replace function public.member_can_review(member uuid, professional uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.service_requests r
    where r.member_id = member and r.professional_id = professional and r.status = 'completed'
  ) or exists (
    select 1 from public.introductions i
    where i.requester_id = member and i.professional_id = professional and i.status = 'accepted'
  );
$$;

revoke all on function public.member_can_review(uuid, uuid) from public;
grant execute on function public.member_can_review(uuid, uuid) to authenticated;

create or replace function public.protect_service_request()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  pro public.professionals;
  owns boolean;
begin
  select * into pro from public.professionals where id = new.professional_id;
  if not found then
    raise exception 'Professional not found';
  end if;
  owns := pro.created_by = auth.uid() or pro.owner_user_id = auth.uid();
  if new.budget is not null and (
    (pro.price_min is not null and new.budget < pro.price_min)
    or (pro.price_max is not null and new.budget > pro.price_max)
    or new.budget < 0
  ) then
    raise exception 'Budget must sit inside the published price range';
  end if;

  if tg_op = 'INSERT' then
    if new.member_id is distinct from auth.uid() then
      raise exception 'Not authorized';
    end if;
    if pro.application_status is distinct from 'approved' then
      raise exception 'You can only request a quote from an approved professional';
    end if;
    new.status := 'pending';
    new.proposed_time := null;
    new.updated_at := now();
    return new;
  end if;

  new.id := old.id;
  new.professional_id := old.professional_id;
  new.member_id := old.member_id;
  new.created_at := old.created_at;
  new.updated_at := now();

  if owns and old.status = 'pending' and new.status in ('accepted', 'declined', 'proposed') then
    if new.status = 'proposed' and coalesce(trim(new.proposed_time), '') = '' then
      raise exception 'Propose a time';
    end if;
    return new;
  end if;
  if owns and old.status in ('accepted', 'proposed') and new.status = 'completed' then
    return new;
  end if;
  if new.member_id = auth.uid() and old.status = 'pending' and new.status = 'cancelled' then
    return new;
  end if;
  if new.member_id = auth.uid() and old.status in ('accepted', 'proposed') and new.status = 'completed' then
    return new;
  end if;
  raise exception 'Not authorized to update this request';
end;
$$;

drop trigger if exists service_requests_protect on public.service_requests;
create trigger service_requests_protect
before insert or update on public.service_requests
for each row execute function public.protect_service_request();

create or replace function public.protect_professional_review()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  owns boolean;
begin
  select (p.created_by = auth.uid() or p.owner_user_id = auth.uid()) into owns
  from public.professionals p where p.id = new.professional_id;

  if tg_op = 'INSERT' then
    if new.author_id is distinct from auth.uid() then
      raise exception 'Not authorized';
    end if;
    if not public.member_can_review(new.author_id, new.professional_id) then
      raise exception 'A completed booking or accepted introduction is required before you can review';
    end if;
    new.owner_reply := null;
    new.replied_at := null;
    return new;
  end if;

  new.id := old.id;
  new.professional_id := old.professional_id;
  new.author_id := old.author_id;
  new.rating := old.rating;
  new.body := old.body;
  new.created_at := old.created_at;
  if not coalesce(owns, false) then
    raise exception 'Only the professional can reply';
  end if;
  if new.owner_reply is distinct from old.owner_reply then
    new.replied_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists professional_reviews_protect on public.professional_reviews;
create trigger professional_reviews_protect
before insert or update on public.professional_reviews
for each row execute function public.protect_professional_review();

alter table public.service_requests enable row level security;
alter table public.professional_reviews enable row level security;

drop policy if exists service_requests_select on public.service_requests;
create policy service_requests_select on public.service_requests
for select to authenticated
using (
  member_id = auth.uid()
  or exists (
    select 1 from public.professionals p
    where p.id = service_requests.professional_id
      and (p.created_by = auth.uid() or p.owner_user_id = auth.uid())
  )
  or public.is_admin()
);

drop policy if exists service_requests_insert on public.service_requests;
create policy service_requests_insert on public.service_requests
for insert to authenticated
with check (member_id = auth.uid() and status = 'pending');

drop policy if exists service_requests_update on public.service_requests;
create policy service_requests_update on public.service_requests
for update to authenticated
using (
  member_id = auth.uid()
  or exists (
    select 1 from public.professionals p
    where p.id = service_requests.professional_id
      and (p.created_by = auth.uid() or p.owner_user_id = auth.uid())
  )
);

drop policy if exists professional_reviews_select on public.professional_reviews;
create policy professional_reviews_select on public.professional_reviews
for select to authenticated
using (true);

drop policy if exists professional_reviews_insert on public.professional_reviews;
create policy professional_reviews_insert on public.professional_reviews
for insert to authenticated
with check (author_id = auth.uid());

drop policy if exists professional_reviews_update on public.professional_reviews;
create policy professional_reviews_update on public.professional_reviews
for update to authenticated
using (
  exists (
    select 1 from public.professionals p
    where p.id = professional_reviews.professional_id
      and (p.created_by = auth.uid() or p.owner_user_id = auth.uid())
  )
);

grant select, insert, update on public.service_requests to authenticated;
grant select, insert, update on public.professional_reviews to authenticated;

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
      and pg_get_constraintdef(con.oid) ilike '%reference_request%'
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
    'report_resolved'
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
    'service_request', 'service_request_update', 'application_update', 'report_resolved'
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

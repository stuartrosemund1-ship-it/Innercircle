-- Stricter professional applications and public price ranges.
-- Apply after 002_professional_verified.sql. Do not run this against the
-- hosted project from the app. An admin applies it in the SQL editor.
--
-- Authenticated applicants may save a draft and submit it as pending.
-- They cannot set application_status to approved or rejected, and they
-- cannot set is_verified. Only service_role, postgres, or supabase_admin can.

alter table public.professionals
  add column if not exists years_experience integer,
  add column if not exists licence_number text,
  add column if not exists licence_issuer text,
  add column if not exists service_area text,
  add column if not exists photo_id_path text,
  add column if not exists insurance_doc_path text,
  add column if not exists qualification_doc_path text,
  add column if not exists conduct_accepted_at timestamptz,
  add column if not exists application_status text not null default 'draft',
  add column if not exists application_rejection_reason text,
  add column if not exists application_submitted_at timestamptz,
  add column if not exists application_reviewed_at timestamptz,
  add column if not exists price_min numeric,
  add column if not exists price_max numeric,
  add column if not exists currency text not null default 'GBP',
  add column if not exists pricing_unit text,
  add column if not exists pricing_notes text;

alter table public.professionals
  drop constraint if exists professionals_application_status_check;
alter table public.professionals
  add constraint professionals_application_status_check
  check (application_status in ('draft', 'pending', 'approved', 'rejected'));

alter table public.professionals
  drop constraint if exists professionals_years_experience_check;
alter table public.professionals
  add constraint professionals_years_experience_check
  check (years_experience is null or (years_experience >= 0 and years_experience <= 80));

alter table public.professionals
  drop constraint if exists professionals_currency_check;
alter table public.professionals
  add constraint professionals_currency_check
  check (currency in ('GBP', 'USD', 'EUR'));

alter table public.professionals
  drop constraint if exists professionals_pricing_unit_check;
alter table public.professionals
  add constraint professionals_pricing_unit_check
  check (pricing_unit is null or pricing_unit in ('per_hour', 'per_session', 'per_project', 'fixed'));

alter table public.professionals
  drop constraint if exists professionals_price_order_check;
alter table public.professionals
  add constraint professionals_price_order_check
  check (
    (price_min is null and price_max is null)
    or (price_min is not null and price_max is not null and price_min >= 0 and price_max >= price_min)
  );

comment on column public.professionals.application_status is
  'draft or pending may be set by the applicant. approved and rejected are admin-only.';
comment on column public.professionals.photo_id_path is
  'Storage path for photo ID. The app stores the path, not the file bytes.';
comment on column public.professionals.price_min is
  'Lower bound of the public price range. Required before an application can be submitted.';

create index if not exists professionals_application_status_idx
  on public.professionals (application_status);

-- Legacy verified rows were created before applications existed. Mark them
-- approved while the previous trigger is still in place, so this backfill
-- does not demand references that were never collected.
update public.professionals
set application_status = 'approved',
    application_reviewed_at = coalesce(verified_at, created_at)
where is_verified = true
  and application_status = 'draft';

create table if not exists public.professional_references (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  applicant_id uuid not null references public.profiles (id) on delete cascade,
  referee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'declined')),
  note text,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint professional_references_not_self check (applicant_id <> referee_id),
  unique (professional_id, referee_id)
);

create index if not exists professional_references_referee_idx
  on public.professional_references (referee_id, status);
create index if not exists professional_references_professional_idx
  on public.professional_references (professional_id);

comment on table public.professional_references is
  'Members asked to vouch for a professional application. The referee confirms or declines.';

create or replace function public.protect_professional()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  privileged boolean := current_user in ('service_role', 'postgres', 'supabase_admin')
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
  reference_count integer;
  confirmed_count integer;
  open_count integer;
begin
  if new.currency is null or new.currency = '' then
    new.currency := 'GBP';
  end if;
  if new.price_min is not null and new.price_max is not null and new.price_min > new.price_max then
    raise exception 'price_min cannot be greater than price_max';
  end if;

  if not privileged then
    if tg_op = 'INSERT' then
      new.verification_status := 'unverified';
      new.is_verified := false;
      new.verified_at := null;
      new.application_rejection_reason := null;
      new.application_reviewed_at := null;
      if new.application_status is distinct from 'draft' then
        new.application_status := 'draft';
      end if;
      new.application_submitted_at := null;
      if new.created_by is distinct from auth.uid() then
        raise exception 'Not authorized';
      end if;
      if new.owner_user_id is not null and new.owner_user_id <> auth.uid() then
        raise exception 'Not authorized';
      end if;
      return new;
    end if;

    new.id := old.id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.verification_status := old.verification_status;
    new.is_verified := old.is_verified;
    new.verified_at := old.verified_at;
    new.application_rejection_reason := old.application_rejection_reason;
    new.application_reviewed_at := old.application_reviewed_at;

    if old.application_status in ('approved', 'rejected') then
      new.application_status := old.application_status;
      new.application_submitted_at := old.application_submitted_at;
      return new;
    end if;

    if new.application_status in ('approved', 'rejected') then
      new.application_status := old.application_status;
    end if;

    if old.application_status = 'pending' then
      raise exception 'Application is pending review';
    end if;

    if old.application_status = 'draft' and new.application_status = 'pending' then
      if new.years_experience is null or new.years_experience < 0 then
        raise exception 'Years of experience is required';
      end if;
      if coalesce(trim(new.licence_number), '') = '' or coalesce(trim(new.licence_issuer), '') = '' then
        raise exception 'Licence number and issuing body are required';
      end if;
      if coalesce(trim(new.service_area), '') = '' then
        raise exception 'Service area is required';
      end if;
      if coalesce(trim(new.photo_id_path), '') = '' then
        raise exception 'Photo ID is required';
      end if;
      if coalesce(trim(new.insurance_doc_path), '') = '' and coalesce(trim(new.qualification_doc_path), '') = '' then
        raise exception 'Proof of insurance or a qualification document is required';
      end if;
      if new.conduct_accepted_at is null then
        raise exception 'Code of conduct must be accepted';
      end if;
      if new.price_min is null or new.price_max is null or new.pricing_unit is null then
        raise exception 'A price range is required';
      end if;
      select count(*) into reference_count
      from public.professional_references r
      where r.professional_id = new.id;
      if reference_count < 1 or reference_count > 2 then
        raise exception 'Request 1 or 2 references before submitting';
      end if;
      new.application_submitted_at := now();
    else
      new.application_submitted_at := old.application_submitted_at;
    end if;
    return new;
  end if;

  if new.application_status = 'approved'
    and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.application_status is distinct from 'approved')) then
    if new.price_min is null or new.price_max is null or new.pricing_unit is null then
      raise exception 'A price range is required before approval';
    end if;
    select count(*) filter (where status = 'confirmed'),
           count(*) filter (where status = 'requested')
      into confirmed_count, open_count
    from public.professional_references
    where professional_id = new.id;
    if confirmed_count < 1 then
      raise exception 'At least one confirmed reference is required before approval';
    end if;
    if open_count > 0 then
      raise exception 'Outstanding reference requests must be confirmed before approval';
    end if;
    if new.application_reviewed_at is null then
      new.application_reviewed_at := now();
    end if;
  elsif new.application_status = 'rejected' then
    new.is_verified := false;
    new.verified_at := null;
    new.verification_status := 'unverified';
    if new.application_reviewed_at is null then
      new.application_reviewed_at := now();
    end if;
  end if;

  if new.application_status is distinct from 'approved' then
    new.is_verified := false;
    new.verified_at := null;
    if new.verification_status = 'verified' then
      new.verification_status := 'unverified';
    end if;
  elsif new.is_verified and new.verified_at is null then
    new.verified_at := case when tg_op = 'UPDATE' then coalesce(old.verified_at, now()) else now() end;
  elsif not coalesce(new.is_verified, false) then
    new.is_verified := false;
    new.verified_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.protect_professional_reference()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  privileged boolean := current_user in ('service_role', 'postgres', 'supabase_admin')
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
  existing_count integer;
  owns boolean;
begin
  if privileged then
    if tg_op = 'UPDATE' and new.status is distinct from old.status and new.responded_at is null then
      new.responded_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'requested';
    new.responded_at := null;
    if new.applicant_id is distinct from auth.uid() then
      raise exception 'Not authorized';
    end if;
    if new.applicant_id = new.referee_id then
      raise exception 'You cannot vouch for your own application';
    end if;
    select exists (
      select 1 from public.professionals p
      where p.id = new.professional_id
        and p.application_status = 'draft'
        and (p.created_by = auth.uid() or p.owner_user_id = auth.uid())
    ) into owns;
    if not owns then
      raise exception 'References can only be requested on your draft application';
    end if;
    if public.connection_status(new.applicant_id, new.referee_id) is distinct from 'accepted' then
      raise exception 'References must be accepted connections';
    end if;
    select count(*) into existing_count
    from public.professional_references r
    where r.professional_id = new.professional_id;
    if existing_count >= 2 then
      raise exception 'A professional can have at most 2 references';
    end if;
    return new;
  end if;

  new.id := old.id;
  new.professional_id := old.professional_id;
  new.applicant_id := old.applicant_id;
  new.referee_id := old.referee_id;
  new.created_at := old.created_at;
  if old.referee_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;
  if old.status is distinct from 'requested' then
    new.status := old.status;
    new.responded_at := old.responded_at;
    new.note := old.note;
    return new;
  end if;
  if new.status not in ('confirmed', 'declined') then
    new.status := old.status;
  else
    new.responded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists professional_references_protect on public.professional_references;
create trigger professional_references_protect
before insert or update on public.professional_references
for each row execute function public.protect_professional_reference();

alter table public.professional_references enable row level security;

drop policy if exists professional_references_select on public.professional_references;
create policy professional_references_select on public.professional_references
for select to authenticated
using (
  applicant_id = auth.uid()
  or referee_id = auth.uid()
);

drop policy if exists professional_references_insert on public.professional_references;
create policy professional_references_insert on public.professional_references
for insert to authenticated
with check (
  applicant_id = auth.uid()
  and status = 'requested'
);

drop policy if exists professional_references_update on public.professional_references;
create policy professional_references_update on public.professional_references
for update to authenticated
using (referee_id = auth.uid() and status = 'requested')
with check (referee_id = auth.uid() and status in ('confirmed', 'declined'));

drop policy if exists professionals_select_referee on public.professionals;
create policy professionals_select_referee on public.professionals
for select to authenticated
using (
  exists (
    select 1 from public.professional_references r
    where r.professional_id = professionals.id
      and r.referee_id = auth.uid()
  )
);

revoke insert, update on public.professionals from authenticated;

grant insert (
  owner_user_id,
  created_by,
  name,
  category,
  bio,
  location,
  experience,
  availability,
  avatar_url,
  verification_status,
  years_experience,
  licence_number,
  licence_issuer,
  service_area,
  photo_id_path,
  insurance_doc_path,
  qualification_doc_path,
  conduct_accepted_at,
  application_status,
  price_min,
  price_max,
  currency,
  pricing_unit,
  pricing_notes
) on public.professionals to authenticated;

grant update (
  owner_user_id,
  name,
  category,
  bio,
  location,
  experience,
  availability,
  avatar_url,
  years_experience,
  licence_number,
  licence_issuer,
  service_area,
  photo_id_path,
  insurance_doc_path,
  qualification_doc_path,
  conduct_accepted_at,
  application_status,
  price_min,
  price_max,
  currency,
  pricing_unit,
  pricing_notes
) on public.professionals to authenticated;

grant select, insert, update on public.professional_references to authenticated;

revoke update on public.professional_references from authenticated;
grant update (status, note, responded_at) on public.professional_references to authenticated;

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
      and pg_get_constraintdef(con.oid) ilike '%connection_request%'
  loop
    execute format('alter table public.notifications drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.notifications
  drop constraint if exists notifications_type_check;
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
    'reference_request'
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
    'message', 'invitation_accepted', 'reference_request'
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

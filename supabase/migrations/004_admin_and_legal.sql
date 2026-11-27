-- Admin role, application review RPCs, reports, and account-deletion cleanup.
-- Apply after 003_professional_application.sql. Do not run this against the
-- hosted project from the app. An admin applies it in the SQL editor.
--
-- Users cannot grant themselves is_admin. Only service_role, postgres, or
-- supabase_admin can. Review actions go through SECURITY DEFINER functions
-- that check profiles.is_admin, so normal clients still cannot write
-- application_status or is_verified directly.

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists terms_accepted_at timestamptz;

comment on column public.profiles.is_admin is
  'Set only by service_role, postgres, or supabase_admin. Client updates cannot change it.';
comment on column public.profiles.terms_accepted_at is
  'When the member agreed to the Terms of Use and Privacy Policy.';

create or replace function public.protect_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  privileged boolean := current_user in ('service_role', 'postgres', 'supabase_admin')
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
begin
  new.email := lower(trim(new.email));
  if new.full_name is null or length(trim(new.full_name)) = 0 then
    new.full_name := 'New member';
  else
    new.full_name := trim(new.full_name);
  end if;
  if not privileged and tg_op = 'INSERT' then
    new.is_admin := false;
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.email := old.email;
    new.created_at := old.created_at;
    if not privileged then
      new.is_admin := old.is_admin;
      if old.terms_accepted_at is not null then
        new.terms_accepted_at := old.terms_accepted_at;
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke update on public.profiles from authenticated;
grant update (
  full_name,
  avatar_url,
  bio,
  city,
  interests,
  privacy,
  onboarding_completed,
  terms_accepted_at
) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, terms_accepted_at)
  values (
    new.id,
    lower(coalesce(new.email, new.id::text || '@users.lifecircle.invalid')),
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'New member'),
    nullif(new.raw_user_meta_data->>'terms_accepted_at', '')::timestamptz
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.is_admin from public.profiles p where p.id = auth.uid()
  ), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_decide_application(
  p_professional_id uuid,
  p_decision text,
  p_reason text default null
) returns public.professionals
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.professionals;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;
  if p_decision = 'rejected' and coalesce(trim(p_reason), '') = '' then
    raise exception 'A rejection reason is required';
  end if;
  update public.professionals
  set application_status = p_decision,
      application_rejection_reason = case when p_decision = 'rejected' then trim(p_reason) else null end
  where id = p_professional_id
  returning * into saved;
  if not found then
    raise exception 'Application not found';
  end if;
  return saved;
end;
$$;

create or replace function public.admin_set_verified(
  p_professional_id uuid,
  p_verified boolean
) returns public.professionals
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.professionals;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  update public.professionals
  set is_verified = coalesce(p_verified, false)
  where id = p_professional_id
  returning * into saved;
  if not found then
    raise exception 'Application not found';
  end if;
  return saved;
end;
$$;

revoke all on function public.admin_decide_application(uuid, text, text) from public;
revoke all on function public.admin_set_verified(uuid, boolean) from public;
grant execute on function public.admin_decide_application(uuid, text, text) to authenticated;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

-- Admins can read every application, its references, and member names.
drop policy if exists professionals_select_admin on public.professionals;
create policy professionals_select_admin on public.professionals
for select to authenticated
using (public.is_admin());

drop policy if exists professional_references_select_admin on public.professional_references;
create policy professional_references_select_admin on public.professional_references
for select to authenticated
using (public.is_admin());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
for select to authenticated
using (public.is_admin());

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('person', 'professional')),
  target_profile_id uuid references public.profiles (id) on delete set null,
  target_professional_id uuid references public.professionals (id) on delete set null,
  reason text not null check (reason in (
    'harassment',
    'spam_or_scam',
    'false_credentials',
    'inappropriate_content',
    'safety',
    'other'
  )),
  details text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  constraint reports_target_check check (
    (target_type = 'person' and target_profile_id is not null)
    or (target_type = 'professional' and target_professional_id is not null)
  )
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_reporter_idx on public.reports (reporter_id);

comment on table public.reports is
  'Members report a person or professional. Reporters see their own rows. Admins see all.';

create or replace function public.protect_report()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  privileged boolean := current_user in ('service_role', 'postgres', 'supabase_admin')
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
begin
  if privileged then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'open';
    new.resolution_note := null;
    new.resolved_at := null;
    new.resolved_by := null;
    if new.reporter_id is distinct from auth.uid() then
      raise exception 'Not authorized';
    end if;
    if new.target_type = 'person' and new.target_profile_id = auth.uid() then
      raise exception 'You cannot report yourself';
    end if;
    return new;
  end if;
  raise exception 'Not authorized';
end;
$$;

drop trigger if exists reports_protect on public.reports;
create trigger reports_protect
before insert or update on public.reports
for each row execute function public.protect_report();

alter table public.reports enable row level security;

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
for select to authenticated
using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
for insert to authenticated
with check (reporter_id = auth.uid() and status = 'open');

grant select, insert on public.reports to authenticated;

create or replace function public.admin_resolve_report(
  p_report_id uuid,
  p_status text,
  p_note text default null
) returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.reports;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'Status must be resolved or dismissed';
  end if;
  update public.reports
  set status = p_status,
      resolution_note = nullif(trim(coalesce(p_note, '')), ''),
      resolved_at = now(),
      resolved_by = auth.uid()
  where id = p_report_id
    and status = 'open'
  returning * into saved;
  if not found then
    raise exception 'Open report not found';
  end if;
  return saved;
end;
$$;

revoke all on function public.admin_resolve_report(uuid, text, text) from public;
grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;

-- Account deletion removes the member's own content, then the auth user.
-- Profile foreign keys cascade the rest.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  delete from public.reports where reporter_id = uid;
  delete from public.professionals
  where created_by = uid or owner_user_id = uid;
  delete from public.messages where sender_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;

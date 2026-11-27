-- Completed-job gallery. Apply after 006_life_team.sql.
-- Commit only. Do not run this against the hosted database from the app.
-- Images and mp4 files live in the job-media bucket. A linked job stays
-- private until the customer approves it.

create table if not exists public.job_media (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professionals (id) on delete cascade,
  service_request_id uuid references public.service_requests (id) on delete set null,
  review_id uuid references public.professional_reviews (id) on delete set null,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'summary')),
  template text not null check (template in ('before_after', 'progress', 'case_summary', 'portfolio')),
  title text not null,
  location_area text,
  job_date date,
  summary_text text,
  media_path text,
  before_path text,
  duration_seconds integer,
  consent_status text not null default 'pending' check (consent_status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  constraint job_media_video_length check (duration_seconds is null or (duration_seconds > 0 and duration_seconds <= 60)),
  constraint job_media_summary_has_text check (kind <> 'summary' or coalesce(trim(summary_text), '') <> '')
);

create index if not exists job_media_professional_idx on public.job_media (professional_id, consent_status);

comment on table public.job_media is
  'Public only when consent_status is approved. Verified job means it is tied to a completed booking and the customer agreed.';

alter table public.reports
  add column if not exists target_media_id uuid references public.job_media (id) on delete set null;

alter table public.reports drop constraint if exists reports_target_check;
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports
  drop constraint if exists reports_target_type_check1;

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
      and rel.relname = 'reports'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%professional%'
  loop
    execute format('alter table public.reports drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.reports
  add constraint reports_target_type_check check (target_type in ('person', 'professional', 'job_media'));

alter table public.reports
  add constraint reports_target_check check (
    (target_type = 'person' and target_profile_id is not null)
    or (target_type = 'professional' and target_professional_id is not null)
    or (target_type = 'job_media' and target_media_id is not null)
  );

create or replace function public.protect_job_media()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  pro public.professionals;
  req public.service_requests;
  owns boolean;
  customer boolean;
begin
  select * into pro from public.professionals where id = new.professional_id;
  if not found then
    raise exception 'Professional not found';
  end if;
  owns := pro.created_by = auth.uid() or pro.owner_user_id = auth.uid();
  customer := false;
  if new.service_request_id is not null then
    select * into req from public.service_requests where id = new.service_request_id;
    if not found or req.status is distinct from 'completed' or req.professional_id is distinct from new.professional_id then
      raise exception 'Media can only be linked to a completed job for this professional';
    end if;
    customer := req.member_id = auth.uid();
  end if;

  if tg_op = 'INSERT' then
    if new.uploaded_by is distinct from auth.uid() then
      raise exception 'Not authorized';
    end if;
    if new.kind = 'video' and (new.duration_seconds is null or new.duration_seconds > 60) then
      raise exception 'Videos must be mp4 and 60 seconds or shorter';
    end if;
    if new.kind = 'summary' then
      new.media_path := null;
      new.before_path := null;
    end if;
    if customer then
      new.consent_status := 'approved';
    elsif owns and new.service_request_id is null then
      new.consent_status := 'approved';
    elsif owns then
      new.consent_status := 'pending';
    else
      raise exception 'Not authorized';
    end if;
    return new;
  end if;

  new.id := old.id;
  new.professional_id := old.professional_id;
  new.service_request_id := old.service_request_id;
  new.uploaded_by := old.uploaded_by;
  new.created_at := old.created_at;
  if customer and old.consent_status = 'pending' and new.consent_status in ('approved', 'declined') then
    return new;
  end if;
  raise exception 'Not authorized';
end;
$$;

drop trigger if exists job_media_protect on public.job_media;
create trigger job_media_protect
before insert or update on public.job_media
for each row execute function public.protect_job_media();

alter table public.job_media enable row level security;

drop policy if exists job_media_select on public.job_media;
create policy job_media_select on public.job_media
for select to authenticated
using (
  consent_status = 'approved'
  or uploaded_by = auth.uid()
  or exists (
    select 1 from public.professionals p
    where p.id = job_media.professional_id
      and (p.created_by = auth.uid() or p.owner_user_id = auth.uid())
  )
  or exists (
    select 1 from public.service_requests r
    where r.id = job_media.service_request_id and r.member_id = auth.uid()
  )
  or public.is_admin()
);

drop policy if exists job_media_insert on public.job_media;
create policy job_media_insert on public.job_media
for insert to authenticated
with check (uploaded_by = auth.uid());

drop policy if exists job_media_update on public.job_media;
create policy job_media_update on public.job_media
for update to authenticated
using (
  exists (
    select 1 from public.service_requests r
    where r.id = job_media.service_request_id and r.member_id = auth.uid()
  )
);

grant select, insert, update on public.job_media to authenticated;

create or replace function public.admin_remove_job_media(p_media_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  delete from public.job_media where id = p_media_id;
end;
$$;

revoke all on function public.admin_remove_job_media(uuid) from public;
grant execute on function public.admin_remove_job_media(uuid) to authenticated;

-- Storage bucket. Skipped when this file is applied outside Supabase.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'job-media',
      'job-media',
      false,
      52428800,
      array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
    )
    on conflict (id) do update
      set file_size_limit = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
    execute 'drop policy if exists job_media_upload on storage.objects';
    execute 'drop policy if exists job_media_read on storage.objects';
    execute $policy$
      create policy job_media_upload on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'job-media'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
    $policy$;
    execute $policy$
      create policy job_media_read on storage.objects
      for select to authenticated
      using (bucket_id = 'job-media')
    $policy$;
  end if;
end $$;

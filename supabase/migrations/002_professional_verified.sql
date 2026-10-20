-- Verified professionals. Apply after 001_lifecircle_schema.sql.
-- Authenticated users can read the flag. Only service_role, postgres, or
-- supabase_admin can change is_verified or verified_at.

alter table public.professionals
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz;

comment on column public.professionals.is_verified is
  'Set by an admin or service_role. Client updates cannot change this column.';
comment on column public.professionals.verified_at is
  'When is_verified became true. Cleared when verification is removed.';

create or replace function public.protect_professional()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  privileged boolean := current_user in ('service_role', 'postgres', 'supabase_admin')
    or coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
begin
  if tg_op = 'INSERT' then
    if not privileged then
      new.verification_status := 'unverified';
      new.is_verified := false;
      new.verified_at := null;
      if new.created_by is distinct from auth.uid() then
        raise exception 'Not authorized';
      end if;
      if new.owner_user_id is not null and new.owner_user_id <> auth.uid() then
        raise exception 'Not authorized';
      end if;
      return new;
    end if;
    if new.is_verified and new.verified_at is null then
      new.verified_at := now();
    elsif not coalesce(new.is_verified, false) then
      new.is_verified := false;
      new.verified_at := null;
    end if;
    return new;
  end if;

  if privileged then
    if new.is_verified and new.verified_at is null then
      new.verified_at := coalesce(old.verified_at, now());
    elsif not new.is_verified then
      new.verified_at := null;
    end if;
    return new;
  end if;

  new.id := old.id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.verification_status := old.verification_status;
  new.is_verified := old.is_verified;
  new.verified_at := old.verified_at;
  return new;
end;
$$;

-- Table-level insert/update would include the new columns. Replace them with
-- column grants so a normal user cannot write is_verified or verified_at.
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
  verification_status
) on public.professionals to authenticated;

grant update (
  owner_user_id,
  name,
  category,
  bio,
  location,
  experience,
  availability,
  avatar_url
) on public.professionals to authenticated;

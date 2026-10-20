-- LifeCircle schema, row level security, and auth hooks.
-- Apply in the Supabase SQL editor, or with `supabase db reset` after `supabase init`.
-- Setup steps: docs/setup-needed.md

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  avatar_url text,
  bio text,
  city text,
  interests text[] not null default '{}',
  privacy jsonb not null default jsonb_build_object(
    'profileVisibility', 'connections',
    'showNameOnRecommendations', true,
    'acceptIntroductions', true,
    'showProfessionalRelationships', 'connections'
  ),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profiles_visibility_check check (
    privacy->>'profileVisibility' in ('connections', 'circle', 'private')
  ),
  constraint profiles_relationships_check check (
    privacy->>'showProfessionalRelationships' in ('connections', 'none')
  )
);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint connections_not_self check (requester_id <> recipient_id)
);

create unique index connections_pair_key on public.connections (
  least(requester_id, recipient_id),
  greatest(requester_id, recipient_id)
);
create index connections_requester_idx on public.connections (requester_id);
create index connections_recipient_idx on public.connections (recipient_id);

create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  name text not null,
  category text not null check (category in (
    'Personal Training and Fitness',
    'Health and Wellbeing',
    'Accountants and Financial Advisers',
    'Lawyers',
    'Electricians and Plumbers',
    'Home Maintenance',
    'Cleaners and Gardeners',
    'Hairdressers and Beauty',
    'Mechanics and Automotive',
    'Childcare and Family Services',
    'Pet Care',
    'Technology Support',
    'Other Services'
  )),
  bio text,
  location text,
  experience text,
  availability text,
  avatar_url text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified')),
  created_at timestamptz not null default now()
);

create index professionals_created_by_idx on public.professionals (created_by);

-- Contact details live apart from the public professional row so a recommendation
-- does not reveal email, phone, or website.
create table public.professional_contacts (
  professional_id uuid primary key references public.professionals (id) on delete cascade,
  contact_email text,
  contact_phone text,
  website text
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  recommender_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  note text,
  visibility text not null check (visibility in ('private', 'connections', 'circle')),
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  created_at timestamptz not null default now()
);

create unique index recommendations_active_pair_key
  on public.recommendations (recommender_id, professional_id)
  where status = 'active';
create index recommendations_professional_idx on public.recommendations (professional_id);

create table public.personal_trusts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  source_introduction_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, professional_id)
);

create table public.introductions (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  intermediary_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professionals (id) on delete cascade,
  message text,
  status text not null check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint introductions_not_self check (requester_id <> intermediary_id)
);

create index introductions_requester_idx on public.introductions (requester_id);
create index introductions_intermediary_idx on public.introductions (intermediary_id);

alter table public.personal_trusts
  add constraint personal_trusts_source_introduction_fkey
  foreign key (source_introduction_id) references public.introductions (id) on delete set null;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  introduction_id uuid references public.introductions (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invite_token_hash text not null unique,
  recipient_email text,
  status text not null check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index invitations_inviter_idx on public.invitations (inviter_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'connection_request',
    'connection_accepted',
    'recommendation_shared',
    'introduction_request',
    'introduction_accepted',
    'introduction_declined',
    'message',
    'invitation_accepted'
  )),
  title text not null,
  body text not null,
  reference_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers. security definer reads bypass RLS. Each helper refuses to answer
-- questions about relationships the caller is not part of.
-- ---------------------------------------------------------------------------

create or replace function public.connection_status(a uuid, b uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null or auth.uid() not in (a, b) then null
    else (
      select c.status
      from public.connections c
      where (c.requester_id = a and c.recipient_id = b)
         or (c.requester_id = b and c.recipient_id = a)
      limit 1
    )
  end;
$$;

create or replace function public.is_conversation_member(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members m
    where m.conversation_id = conv
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.shares_conversation(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members ma
    join public.conversation_members mb on ma.conversation_id = mb.conversation_id
    where ma.user_id = a and mb.user_id = b and a <> b
  );
$$;

create or replace function public.can_notify(recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and recipient is not null
    and recipient <> auth.uid()
    and (
      exists (
        select 1 from public.connections c
        where c.status in ('pending', 'accepted')
          and (
            (c.requester_id = auth.uid() and c.recipient_id = recipient)
            or (c.recipient_id = auth.uid() and c.requester_id = recipient)
          )
      )
      or exists (
        select 1 from public.introductions i
        where (i.requester_id = auth.uid() and i.intermediary_id = recipient)
           or (i.intermediary_id = auth.uid() and i.requester_id = recipient)
      )
      or public.shares_conversation(auth.uid(), recipient)
    );
$$;

-- ---------------------------------------------------------------------------
-- Profile + auth
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.email := lower(trim(new.email));
  if new.full_name is null or length(trim(new.full_name)) = 0 then
    new.full_name := 'New member';
  else
    new.full_name := trim(new.full_name);
  end if;
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.email := old.email;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger profiles_protect
before insert or update on public.profiles
for each row execute function public.protect_profile();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(coalesce(new.email, new.id::text || '@users.lifecircle.invalid')),
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'New member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Connections
-- ---------------------------------------------------------------------------

create or replace function public.enforce_connection_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.requester_id = new.recipient_id then
      raise exception 'Cannot connect to yourself.';
    end if;
    if new.status = 'pending' and new.requester_id = auth.uid() then
      return new;
    end if;
    if new.status = 'blocked' and new.requester_id = auth.uid() then
      return new;
    end if;
    if new.status = 'accepted'
       and new.recipient_id = auth.uid()
       and current_setting('lifecircle.invite_accept', true) = '1' then
      return new;
    end if;
    raise exception 'Not authorized';
  end if;

  if new.requester_id <> old.requester_id
     or new.recipient_id <> old.recipient_id
     or new.id <> old.id then
    raise exception 'Cannot change connection participants';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();

  if auth.uid() = old.recipient_id and old.status = 'pending' and new.status in ('accepted', 'declined') then
    return new;
  end if;
  if auth.uid() in (old.requester_id, old.recipient_id) and old.status <> 'blocked' and new.status = 'blocked' then
    return new;
  end if;
  if auth.uid() = old.requester_id and old.status = 'declined' and new.status = 'pending' then
    return new;
  end if;
  raise exception 'Not authorized to update this connection';
end;
$$;

create trigger connections_enforce
before insert or update on public.connections
for each row execute function public.enforce_connection_write();

-- ---------------------------------------------------------------------------
-- Professionals
-- ---------------------------------------------------------------------------

create or replace function public.protect_professional()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.verification_status := 'unverified';
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
  return new;
end;
$$;

create trigger professionals_protect
before insert or update on public.professionals
for each row execute function public.protect_professional();

-- ---------------------------------------------------------------------------
-- Recommendations + introductions
-- ---------------------------------------------------------------------------

create or replace function public.protect_recommendation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.recommender_id <> auth.uid() or new.status <> 'active' then
      raise exception 'Not authorized';
    end if;
    return new;
  end if;
  if new.recommender_id <> old.recommender_id
     or new.professional_id <> old.professional_id
     or new.id <> old.id
     or new.created_at <> old.created_at
     or new.note is distinct from old.note
     or new.visibility <> old.visibility then
    raise exception 'Not authorized';
  end if;
  if old.status <> 'active' or new.status <> 'withdrawn' then
    raise exception 'Recommendation can only be withdrawn';
  end if;
  return new;
end;
$$;

create trigger recommendations_protect
before insert or update on public.recommendations
for each row execute function public.protect_recommendation();

create or replace function public.enforce_introduction_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.requester_id <> auth.uid() or new.status <> 'pending' then
    raise exception 'Not authorized';
  end if;
  if public.connection_status(new.requester_id, new.intermediary_id) <> 'accepted' then
    raise exception 'You can only request introductions through people in your circle.';
  end if;
  if exists (
    select 1 from public.profiles p
    where p.id = new.intermediary_id
      and coalesce((p.privacy->>'acceptIntroductions')::boolean, true) = false
  ) then
    raise exception 'This person is not accepting introduction requests.';
  end if;
  if not exists (
    select 1 from public.recommendations r
    where r.recommender_id = new.intermediary_id
      and r.professional_id = new.professional_id
      and r.status = 'active'
  ) then
    raise exception 'That connection does not currently recommend this professional.';
  end if;
  return new;
end;
$$;

create trigger introductions_enforce
before insert on public.introductions
for each row execute function public.enforce_introduction_insert();

create or replace function public.respond_introduction(p_id uuid, p_accept boolean)
returns public.introductions
language plpgsql
security definer
set search_path = public
as $$
declare
  intro public.introductions;
  pro public.professionals;
  intermediary_name text;
  conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into intro from public.introductions where id = p_id for update;
  if not found then
    raise exception 'Introduction not found';
  end if;
  if intro.intermediary_id <> auth.uid() then
    raise exception 'Not authorized';
  end if;
  if intro.status <> 'pending' then
    raise exception 'Already responded';
  end if;

  update public.introductions
  set status = case when p_accept then 'accepted' else 'declined' end,
      responded_at = now()
  where id = p_id
  returning * into intro;

  select full_name into intermediary_name from public.profiles where id = intro.intermediary_id;
  select * into pro from public.professionals where id = intro.professional_id;

  if p_accept then
    insert into public.conversations (introduction_id) values (intro.id) returning id into conv_id;
    insert into public.conversation_members (conversation_id, user_id)
    values (conv_id, intro.requester_id), (conv_id, intro.intermediary_id);
    if pro.owner_user_id is not null
       and pro.owner_user_id <> intro.requester_id
       and pro.owner_user_id <> intro.intermediary_id then
      insert into public.conversation_members (conversation_id, user_id)
      values (conv_id, pro.owner_user_id);
    end if;
    insert into public.messages (conversation_id, sender_id, body)
    values (
      conv_id,
      intro.intermediary_id,
      format(
        'I''ve introduced you to %s. You can decide independently whether to add them to your circle.',
        coalesce(pro.name, 'this professional')
      )
    );
    insert into public.notifications (recipient_id, type, title, body, reference_id)
    values (
      intro.requester_id,
      'introduction_accepted',
      'Introduction accepted',
      format('%s introduced you to %s.', coalesce(intermediary_name, 'Someone'), coalesce(pro.name, 'a professional')),
      intro.id
    );
  else
    insert into public.notifications (recipient_id, type, title, body, reference_id)
    values (
      intro.requester_id,
      'introduction_declined',
      'Introduction declined',
      format('%s declined your introduction request.', coalesce(intermediary_name, 'Someone')),
      intro.id
    );
  end if;

  return intro;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------

create or replace function public.create_invitation(p_recipient_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  token text;
  row public.invitations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (inviter_id, invite_token_hash, recipient_email, status, expires_at)
  values (
    auth.uid(),
    encode(extensions.digest(token, 'sha256'), 'hex'),
    nullif(lower(trim(coalesce(p_recipient_email, ''))), ''),
    'pending',
    now() + interval '14 days'
  )
  returning * into row;
  return jsonb_build_object(
    'id', row.id,
    'inviter_id', row.inviter_id,
    'recipient_email', row.recipient_email,
    'status', row.status,
    'expires_at', row.expires_at,
    'created_at', row.created_at,
    'invite_token_plain', token
  );
end;
$$;

create or replace function public.invitation_json(inv public.invitations)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', inv.id,
    'inviter_id', inv.inviter_id,
    'recipient_email', inv.recipient_email,
    'status', inv.status,
    'expires_at', inv.expires_at,
    'created_at', inv.created_at
  );
$$;

create or replace function public.accept_invitation(token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inv public.invitations;
  existing public.connections;
  invitee_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if token is null or length(trim(token)) = 0 then
    raise exception 'Invitation not found';
  end if;

  select * into inv
  from public.invitations
  where invite_token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
  for update;
  if not found then
    raise exception 'Invitation not found';
  end if;
  if inv.inviter_id = auth.uid() then
    raise exception 'You cannot accept your own invitation';
  end if;
  if inv.status = 'accepted' then
    return public.invitation_json(inv);
  end if;
  if inv.status <> 'pending' then
    raise exception 'Invitation is no longer valid';
  end if;
  if inv.expires_at < now() then
    update public.invitations set status = 'expired' where id = inv.id;
    raise exception 'Invitation has expired';
  end if;

  update public.invitations set status = 'accepted' where id = inv.id returning * into inv;

  select * into existing
  from public.connections c
  where (c.requester_id = inv.inviter_id and c.recipient_id = auth.uid())
     or (c.requester_id = auth.uid() and c.recipient_id = inv.inviter_id)
  limit 1;

  if existing.id is not null and existing.status = 'blocked' then
    raise exception 'Unable to connect.';
  end if;
  if existing.id is not null and existing.status = 'pending' then
    update public.connections set status = 'accepted', updated_at = now() where id = existing.id;
  elsif existing.id is null or existing.status = 'declined' then
    if existing.id is not null then
      delete from public.connections where id = existing.id;
    end if;
    perform set_config('lifecircle.invite_accept', '1', true);
    insert into public.connections (requester_id, recipient_id, status)
    values (inv.inviter_id, auth.uid(), 'accepted');
  end if;

  select full_name into invitee_name from public.profiles where id = auth.uid();
  insert into public.notifications (recipient_id, type, title, body, reference_id)
  values (
    inv.inviter_id,
    'invitation_accepted',
    'Invitation accepted',
    format('%s joined via your invite.', coalesce(invitee_name, 'Someone')),
    inv.id
  );
  return public.invitation_json(inv);
end;
$$;

create or replace function public.lookup_profile_by_email(target_email text)
returns table (id uuid, email text, full_name text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.full_name, p.avatar_url
  from public.profiles p
  where auth.uid() is not null
    and target_email is not null
    and length(trim(target_email)) > 0
    and p.email = lower(trim(target_email))
    and p.id <> auth.uid()
  limit 1;
$$;

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
    'message', 'invitation_accepted'
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

create or replace function public.protect_notification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id
     or new.recipient_id <> old.recipient_id
     or new.type <> old.type
     or new.title <> old.title
     or new.body <> old.body
     or new.reference_id is distinct from old.reference_id
     or new.created_at <> old.created_at then
    raise exception 'Not authorized';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Not authorized';
  end if;
  return new;
end;
$$;

create trigger notifications_protect
before update on public.notifications
for each row execute function public.protect_notification();

-- ---------------------------------------------------------------------------
-- Grants and RLS
-- ---------------------------------------------------------------------------

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.connections to authenticated;
grant select, insert, update, delete on public.professionals to authenticated;
grant select, insert on public.professional_contacts to authenticated;
grant select, insert, update on public.recommendations to authenticated;
grant select, insert, delete on public.personal_trusts to authenticated;
grant select, insert on public.introductions to authenticated;
grant select on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;
grant select (id, inviter_id, recipient_email, status, expires_at, created_at) on public.invitations to authenticated;
grant select, update on public.notifications to authenticated;

revoke all on function public.connection_status(uuid, uuid) from public;
revoke all on function public.is_conversation_member(uuid) from public;
revoke all on function public.shares_conversation(uuid, uuid) from public;
revoke all on function public.can_notify(uuid) from public;
revoke all on function public.delete_own_account() from public;
revoke all on function public.respond_introduction(uuid, boolean) from public;
revoke all on function public.create_invitation(text) from public;
revoke all on function public.invitation_json(public.invitations) from public;
revoke all on function public.accept_invitation(text) from public;
revoke all on function public.lookup_profile_by_email(text) from public;
revoke all on function public.create_notification(uuid, text, text, text, uuid) from public;

grant execute on function public.connection_status(uuid, uuid) to authenticated;
grant execute on function public.is_conversation_member(uuid) to authenticated;
grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.respond_introduction(uuid, boolean) to authenticated;
grant execute on function public.create_invitation(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.lookup_profile_by_email(text) to authenticated;
grant execute on function public.create_notification(uuid, text, text, text, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.connections enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_contacts enable row level security;
alter table public.recommendations enable row level security;
alter table public.personal_trusts enable row level security;
alter table public.introductions enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.invitations enable row level security;
alter table public.notifications enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.connection_status(id, auth.uid()) in ('pending', 'accepted')
);

create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy connections_select on public.connections
for select to authenticated
using (auth.uid() in (requester_id, recipient_id));

create policy connections_insert on public.connections
for insert to authenticated
with check (
  requester_id = auth.uid()
  and requester_id <> recipient_id
  and status in ('pending', 'blocked')
);

create policy connections_update on public.connections
for update to authenticated
using (auth.uid() in (requester_id, recipient_id))
with check (auth.uid() in (requester_id, recipient_id));

create policy connections_delete on public.connections
for delete to authenticated
using (auth.uid() in (requester_id, recipient_id));

create policy professionals_select on public.professionals
for select to authenticated
using (
  created_by = auth.uid()
  or owner_user_id = auth.uid()
  or exists (
    select 1 from public.personal_trusts t
    where t.professional_id = professionals.id and t.user_id = auth.uid()
  )
  or exists (
    select 1 from public.recommendations r
    where r.professional_id = professionals.id
      and r.status = 'active'
      and (
        r.recommender_id = auth.uid()
        or (
          r.visibility in ('connections', 'circle')
          and public.connection_status(r.recommender_id, auth.uid()) = 'accepted'
        )
      )
  )
  or exists (
    select 1 from public.introductions i
    where i.professional_id = professionals.id
      and auth.uid() in (i.requester_id, i.intermediary_id)
  )
);

create policy professionals_insert on public.professionals
for insert to authenticated
with check (created_by = auth.uid() and verification_status = 'unverified');

create policy professionals_update on public.professionals
for update to authenticated
using (created_by = auth.uid() or owner_user_id = auth.uid())
with check (created_by = auth.uid() or owner_user_id = auth.uid());

create policy professionals_delete on public.professionals
for delete to authenticated
using (created_by = auth.uid());

create policy professional_contacts_select on public.professional_contacts
for select to authenticated
using (
  exists (
    select 1 from public.professionals p
    where p.id = professional_contacts.professional_id
      and (p.created_by = auth.uid() or p.owner_user_id = auth.uid())
  )
  or exists (
    select 1 from public.introductions i
    where i.professional_id = professional_contacts.professional_id
      and i.requester_id = auth.uid()
      and i.status = 'accepted'
  )
);

create policy professional_contacts_insert on public.professional_contacts
for insert to authenticated
with check (
  exists (
    select 1 from public.professionals p
    where p.id = professional_contacts.professional_id
      and p.created_by = auth.uid()
  )
);

create policy recommendations_select on public.recommendations
for select to authenticated
using (
  recommender_id = auth.uid()
  or (
    status = 'active'
    and visibility in ('connections', 'circle')
    and public.connection_status(recommender_id, auth.uid()) = 'accepted'
  )
);

create policy recommendations_insert on public.recommendations
for insert to authenticated
with check (recommender_id = auth.uid() and status = 'active');

create policy recommendations_update on public.recommendations
for update to authenticated
using (recommender_id = auth.uid())
with check (recommender_id = auth.uid());

create policy personal_trusts_all on public.personal_trusts
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy introductions_select on public.introductions
for select to authenticated
using (auth.uid() in (requester_id, intermediary_id));

create policy introductions_insert on public.introductions
for insert to authenticated
with check (requester_id = auth.uid() and status = 'pending');

create policy conversations_select on public.conversations
for select to authenticated
using (public.is_conversation_member(id));

create policy conversation_members_select on public.conversation_members
for select to authenticated
using (public.is_conversation_member(conversation_id));

create policy messages_select on public.messages
for select to authenticated
using (public.is_conversation_member(conversation_id));

create policy messages_insert on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

create policy invitations_select on public.invitations
for select to authenticated
using (inviter_id = auth.uid());

create policy notifications_select on public.notifications
for select to authenticated
using (recipient_id = auth.uid());

create policy notifications_update on public.notifications
for update to authenticated
using (recipient_id = auth.uid())
with check (recipient_id = auth.uid());

-- Realtime is optional. The publication exists on hosted and local Supabase.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'profiles', 'connections', 'professionals', 'recommendations', 'personal_trusts',
      'introductions', 'conversations', 'conversation_members', 'messages', 'notifications'
    ]
    loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- ============================================================
-- QR-ATT Supabase PostgreSQL Schema
-- ============================================================
--
-- This schema provides:
-- - Supabase Auth profiles
-- - Student / Teacher roles
-- - Attendance events
-- - Attendance records
-- - Row Level Security
--
-- This script is designed to be safe to run more than once.
-- ============================================================


-- ------------------------------------------------------------
-- 1. PROFILES
-- ------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'student'
    check (role in ('student', 'teacher')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


alter table public.profiles
enable row level security;


-- ------------------------------------------------------------
-- PROFILE POLICIES
-- ------------------------------------------------------------

drop policy if exists
  "Profiles are viewable by owner"
on public.profiles;

create policy
  "Profiles are viewable by owner"
on public.profiles
for select
using (
  auth.uid() = id
);


drop policy if exists
  "Users can insert their own profile"
on public.profiles;

create policy
  "Users can insert their own profile"
on public.profiles
for insert
with check (
  auth.uid() = id
);


drop policy if exists
  "Users can update their own profile"
on public.profiles;

create policy
  "Users can update their own profile"
on public.profiles
for update
using (
  auth.uid() = id
)
with check (
  auth.uid() = id
);


-- ------------------------------------------------------------
-- AUTOMATIC PROFILE CREATION
-- ------------------------------------------------------------
--
-- Supabase Auth stores the values supplied through:
--
-- options.data
--
-- inside:
--
-- auth.users.raw_user_meta_data
--
-- The trigger copies those values into public.profiles.
--
-- This is important because email-confirmed signup may return
-- no session. The role therefore MUST NOT depend on a client-side
-- profile update after signup.
-- ------------------------------------------------------------

create or replace function
public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_role text;
  selected_name text;
begin

  selected_name :=
    nullif(
      trim(
        coalesce(
          new.raw_user_meta_data ->> 'full_name',
          ''
        )
      ),
      ''
    );

  selected_role :=
    case
      when
        new.raw_user_meta_data ->> 'role'
        in ('student', 'teacher')
      then
        new.raw_user_meta_data ->> 'role'
      else
        'student'
    end;

  insert into public.profiles (
    id,
    email,
    full_name,
    role
  )
  values (
    new.id,
    coalesce(new.email, ''),
    selected_name,
    selected_role
  )
  on conflict (id)
  do update
  set
    email = excluded.email,
    full_name = coalesce(
      excluded.full_name,
      public.profiles.full_name
    ),
    role = excluded.role,
    updated_at = now();

  return new;
end;
$$;


drop trigger if exists
  on_auth_user_created
on auth.users;


create trigger
  on_auth_user_created
after insert
on auth.users
for each row
execute procedure
  public.handle_new_user();


-- ------------------------------------------------------------
-- BACKFILL EXISTING USERS
-- ------------------------------------------------------------
--
-- This also fixes accounts that were previously registered as
-- Teacher but were accidentally stored as Student because the
-- old trigger ignored raw_user_meta_data.role.
-- ------------------------------------------------------------

update public.profiles as p
set
  email = coalesce(
    u.email,
    p.email
  ),

  full_name = coalesce(
    nullif(
      trim(
        coalesce(
          u.raw_user_meta_data ->> 'full_name',
          ''
        )
      ),
      ''
    ),
    p.full_name
  ),

  role =
    case
      when
        u.raw_user_meta_data ->> 'role'
        in ('student', 'teacher')
      then
        u.raw_user_meta_data ->> 'role'
      else
        p.role
    end,

  updated_at = now()

from auth.users as u

where
  p.id = u.id;


-- ------------------------------------------------------------
-- 2. EVENTS
-- ------------------------------------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),

  event_code text not null unique,

  title text not null,

  start_time timestamptz,

  end_time timestamptz,

  created_by uuid
    references auth.users (id)
    on delete set null,

  created_at timestamptz
    not null
    default now()
);


alter table public.events
enable row level security;


-- ------------------------------------------------------------
-- EVENT POLICIES
-- ------------------------------------------------------------

drop policy if exists
  "Events are readable by any authenticated user"
on public.events;

create policy
  "Events are readable by any authenticated user"
on public.events
for select
using (
  auth.role() = 'authenticated'
);


drop policy if exists
  "Users can insert events"
on public.events;

create policy
  "Users can insert events"
on public.events
for insert
with check (
  auth.role() = 'authenticated'
  and
  (
    created_by is null
    or
    created_by = auth.uid()
  )
);


drop policy if exists
  "Users can update their own events"
on public.events;

create policy
  "Users can update their own events"
on public.events
for update
using (
  auth.uid() = created_by
)
with check (
  auth.uid() = created_by
);


-- ------------------------------------------------------------
-- 3. ATTENDANCE
-- ------------------------------------------------------------

create table if not exists public.attendance (
  id uuid
    primary key
    default gen_random_uuid(),

  student_id uuid
    not null
    references auth.users (id)
    on delete cascade,

  event_id uuid
    not null
    references public.events (id)
    on delete cascade,

  scanned_at timestamptz
    not null
    default now(),

  unique (
    student_id,
    event_id
  )
);


alter table public.attendance
enable row level security;


-- ------------------------------------------------------------
-- ATTENDANCE POLICIES
-- ------------------------------------------------------------

drop policy if exists
  "Students can view their own attendance"
on public.attendance;

create policy
  "Students can view their own attendance"
on public.attendance
for select
using (
  auth.uid() = student_id
);


drop policy if exists
  "Students can insert their own attendance"
on public.attendance;

create policy
  "Students can insert their own attendance"
on public.attendance
for insert
with check (
  auth.uid() = student_id
);


drop policy if exists
  "Teachers can view attendance for their events"
on public.attendance;

create policy
  "Teachers can view attendance for their events"
on public.attendance
for select
using (
  exists (
    select 1
    from public.events as e
    where
      e.id =
        attendance.event_id
      and
      e.created_by =
        auth.uid()
  )
);


-- ------------------------------------------------------------
-- TEACHERS CAN VIEW ATTENDEE PROFILES
-- ------------------------------------------------------------

drop policy if exists
  "Teachers can view profiles of their attendees"
on public.profiles;

create policy
  "Teachers can view profiles of their attendees"
on public.profiles
for select
using (
  exists (
    select 1
    from public.attendance as a
    join public.events as e
      on e.id = a.event_id
    where
      a.student_id =
        profiles.id
      and
      e.created_by =
        auth.uid()
  )
);


-- ============================================================
-- END
-- ============================================================
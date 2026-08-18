-- ============================================================================
-- TrainingsTracker – Supabase Datenbankschema
-- ============================================================================
-- Anleitung:
-- 1. Supabase-Projekt anlegen (https://supabase.com -> New Project)
-- 2. Im Supabase Dashboard -> SQL Editor -> "New query"
-- 3. Diesen kompletten Inhalt einfügen und "Run" klicken
-- 4. Danach in Project Settings -> API die "Project URL" und den
--    "anon public" Key kopieren und in js/config.js eintragen
-- ============================================================================

-- Erweiterung für UUID-Generierung (auf Supabase i.d.R. schon aktiv)
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Profile (optionaler Anzeigename pro Nutzer)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profile: eigenes Profil lesen"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Profile: eigenes Profil anlegen"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Profile: eigenes Profil bearbeiten"
  on public.profiles for update
  using (auth.uid() = id);

-- Automatisch ein Profil anlegen, wenn sich jemand neu registriert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Trainingspläne
-- ----------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null default 'Mein Trainingsplan',
  is_active boolean not null default true,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

create policy "Plans: eigene Pläne verwalten"
  on public.plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Trainingsblöcke (Mesozyklen, z.B. "Block 1 – Kraftaufbau, 4 Wochen")
-- ----------------------------------------------------------------------------
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  name text not null default 'Neuer Block',
  notes text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.blocks enable row level security;

create policy "Blocks: eigene Blöcke verwalten"
  on public.blocks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Trainingstage (1–7 pro Block, frei benennbar, z.B. "Tag 1 – Push")
-- ----------------------------------------------------------------------------
create table if not exists public.training_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  block_id uuid not null references public.blocks (id) on delete cascade,
  name text not null default 'Neuer Trainingstag',
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.training_days enable row level security;

create policy "TrainingDays: eigene Trainingstage verwalten"
  on public.training_days for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Übungen (gruppiert per section_name, z.B. "Warm-up", "Hauptteil", "Superset A")
-- ----------------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  training_day_id uuid not null references public.training_days (id) on delete cascade,
  section_name text not null default 'Hauptteil',
  section_order int not null default 0,
  name text not null default 'Neue Übung',
  target_sets int not null default 3,
  target_reps text not null default '8-12',
  notes text,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;

create policy "Exercises: eigene Übungen verwalten"
  on public.exercises for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Logs (tatsächlich trainierte Gewichte/Wiederholungen je Satz und Datum)
-- ----------------------------------------------------------------------------
create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  workout_date date not null default current_date,
  set_index int not null default 1,
  weight numeric,
  reps int,
  created_at timestamptz not null default now()
);

alter table public.logs enable row level security;

create policy "Logs: eigene Logs verwalten"
  on public.logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists logs_exercise_date_idx
  on public.logs (exercise_id, workout_date desc, set_index);

-- Verhindert Duplikate & ermöglicht "Upsert": pro Übung/Datum/Satz nur ein Eintrag.
-- Speichert man am selben Tag erneut, wird der bestehende Wert einfach aktualisiert.
alter table public.logs
  add constraint logs_unique_entry unique (exercise_id, workout_date, set_index);

-- ----------------------------------------------------------------------------
-- Fertig! Alle Tabellen sind über Row Level Security so abgesichert, dass
-- jede:r Nutzer:in ausschließlich die eigenen Daten sehen und bearbeiten kann.
-- ----------------------------------------------------------------------------

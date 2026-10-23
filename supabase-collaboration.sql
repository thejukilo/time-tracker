-- Suggestions, feedback, and administration data.
-- Run once in the Supabase SQL Editor.

create table if not exists public.item_suggestions (
  id uuid primary key default gen_random_uuid(),
  submitted_by text not null,
  item_type text not null check (item_type in ('departments','categories','projects','instruments')),
  action text not null check (action in ('add','remove')),
  item_name text not null,
  target_id uuid,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists item_suggestions_pending_idx on public.item_suggestions(status, created_at desc);

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  submitted_by text not null,
  message text not null,
  status text not null default 'open' check (status in ('open','replied','closed')),
  reply text,
  replied_by text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists app_feedback_status_idx on public.app_feedback(status, created_at desc);

create table if not exists public.user_dropdown_preferences (
  user_email text primary key,
  department_ids uuid[] not null default '{}',
  category_ids uuid[] not null default '{}',
  project_ids uuid[] not null default '{}',
  instrument_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

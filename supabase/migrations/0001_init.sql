-- MySchemeGuide schema for Supabase Postgres.  Apply with the Supabase SQL editor or `supabase db push`.
-- Design rules:
--  * No Aadhaar / PAN / document contents are stored here. Documents live encrypted on the user's device.
--  * Roles are server-managed (user_roles); nothing a client can edit (e.g. user_metadata) grants privileges.
--  * Every user-owned table has Row Level Security; admin/audit tables have no client write path at all.

create type public.scheme_status as enum ('verified', 'needs_review', 'expired', 'unverified');
create type public.app_role as enum ('citizen', 'admin', 'super_admin');

-- ------------------------------------------------------------------ users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,                                   -- E.164, copied from the verified auth phone by the backend
  display_name text check (char_length(display_name) <= 80),
  language text not null default 'en',
  state text check (char_length(state) <= 60),
  ocr_consent boolean not null default false,   -- explicit consent before document images go to the AI provider
  ocr_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ schemes
create table public.schemes (
  scheme_id text primary key check (scheme_id ~ '^[a-z0-9_]{3,80}$'),
  official_name text not null check (char_length(official_name) between 3 and 300),
  name_local jsonb not null default '{}',
  government_level text not null check (government_level in ('central', 'state')),
  state text not null default '',
  department text not null default '',
  category text not null default 'other',
  official_eligibility text[] not null default '{}',
  official_benefits text not null default '',
  documents text[] not null default '{}',
  application_url text,
  official_source_url text,
  source_type text check (source_type in ('central_portal', 'state_portal', 'gazette', 'department_circular', 'imported_dataset', 'other')),
  how_to_apply text not null default '',
  verification_status public.scheme_status not null default 'unverified',
  verified_at timestamptz,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_label text,                          -- masked, e.g. "Admin ******4321"
  review_expires_at date,
  review_note text,
  extra jsonb not null default '{}',            -- structured rules, form fields, translations (not official text)
  origin text not null default 'seed',
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a scheme can only be 'verified' if a human reviewer, a source and an expiry were recorded
  constraint verified_needs_evidence check (
    verification_status <> 'verified' or (
      verified_at is not null and reviewer_id is not null and official_source_url is not null
      and source_type is not null and review_expires_at is not null))
);
create index schemes_status_idx on public.schemes(verification_status);
create index schemes_state_idx on public.schemes(state);

create table public.scheme_history (
  id bigserial primary key,
  scheme_id text not null,
  action text not null check (action in ('seed', 'edit', 'verify', 'reject', 'expire', 'source_update', 'create')),
  from_status public.scheme_status,
  to_status public.scheme_status,
  actor_id uuid references auth.users(id) on delete set null,
  note text,
  diff jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index scheme_history_scheme_idx on public.scheme_history(scheme_id, created_at desc);

-- ------------------------------------------------------------------ citizen data
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scheme_id text not null references public.schemes(scheme_id) on delete restrict,
  scheme_name text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'under_review', 'need_documents', 'approved', 'rejected')),
  reference_number text check (char_length(reference_number) <= 60),
  notes text check (char_length(notes) <= 500),
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index applications_user_idx on public.applications(user_id, updated_at desc);

create table public.application_events (
  id bigserial primary key,
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status text not null,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create table public.bookmarks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scheme_id text not null references public.schemes(scheme_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, scheme_id)
);

create table public.notifications (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  application_id uuid references public.applications(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Audit trail: written only by the backend (service role). Never contains Aadhaar, PAN, tokens or document content.
create table public.audit_logs (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------ helpers
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'super_admin'));
$$;
create function public.is_super_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin');
$$;

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_schemes_touch before update on public.schemes for each row execute function public.touch_updated_at();
create trigger t_apps_touch before update on public.applications for each row execute function public.touch_updated_at();

-- history and audit are append-only, even for the service role
create function public.deny_mutation() returns trigger language plpgsql as $$
begin raise exception '% is append-only', tg_table_name; end $$;
create trigger t_history_immutable before update or delete on public.scheme_history for each row execute function public.deny_mutation();
create trigger t_audit_immutable before update or delete on public.audit_logs for each row execute function public.deny_mutation();

-- ------------------------------------------------------------------ Row Level Security
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.schemes enable row level security;
alter table public.scheme_history enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.bookmarks enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- profiles: owner only
grant select, insert, update, delete on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete on public.profiles for delete to authenticated using (id = auth.uid());

-- roles: a user can read their own role; there is NO client write policy (service role only)
grant select on public.user_roles to authenticated;
create policy roles_select_own on public.user_roles for select to authenticated using (user_id = auth.uid());

-- schemes: full table only for admins; everyone else reads the public view (no reviewer ids)
grant select on public.schemes to authenticated;
create policy schemes_admin_select on public.schemes for select to authenticated using (public.is_admin());
create view public.schemes_public as
  select scheme_id, official_name, name_local, government_level, state, department, category, official_eligibility,
         official_benefits, documents, application_url, official_source_url, source_type, how_to_apply,
         verification_status, verified_at, review_expires_at, updated_at
  from public.schemes;
grant select on public.schemes_public to anon, authenticated;

grant select on public.scheme_history to authenticated;
create policy history_admin_select on public.scheme_history for select to authenticated using (public.is_admin());

-- citizen data: owner only
grant select, insert, update, delete on public.applications to authenticated;
create policy apps_all_own on public.applications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert on public.application_events to authenticated;
grant usage, select on sequence public.application_events_id_seq to authenticated;
create policy events_select_own on public.application_events for select to authenticated using (user_id = auth.uid());
create policy events_insert_own on public.application_events for insert to authenticated with check (
  user_id = auth.uid() and exists (select 1 from public.applications a where a.id = application_id and a.user_id = auth.uid()));

grant select, insert, delete on public.bookmarks to authenticated;
create policy bookmarks_all_own on public.bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.notifications to authenticated;
grant usage, select on sequence public.notifications_id_seq to authenticated;
create policy notif_all_own on public.notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- audit: super admins may read; nobody but the service role may write
grant select on public.audit_logs to authenticated;
create policy audit_super_select on public.audit_logs for select to authenticated using (public.is_super_admin());

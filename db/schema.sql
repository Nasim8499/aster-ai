-- Aster — PostgreSQL schema (works with Neon, Supabase, RDS, D1 via Hyperdrive)
-- The client uses a localStorage repository shaped exactly like these tables,
-- so migrating to this schema is a drop-in swap in src/lib/store.tsx.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Accounts & sessions
-- ---------------------------------------------------------------------------
create type user_role as enum ('admin', 'member');
create type auth_provider as enum ('password', 'google');
create type plan_id as enum ('free', 'pro', 'team');

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         citext unique not null,
  name          text not null,
  password_hash text,                          -- null for OAuth-only accounts
  provider      auth_provider not null default 'password',
  role          user_role not null default 'member',
  plan          plan_id not null default 'free',
  avatar_color  text not null default '#6c5ce7',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  token_hash    text not null unique,
  user_agent    text,
  ip            inet,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_expiry_idx on sessions(expires_at);

create table if not exists oauth_accounts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  provider        text not null check (provider in ('google')),
  provider_uid    text not null,
  created_at      timestamptz not null default now(),
  unique (provider, provider_uid)
);

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  title       text not null default 'New chat',
  mode        text not null default 'chat' check (mode in ('chat', 'agent')),
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists conversations_user_idx on conversations(user_id, updated_at desc);

create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null default '',
  model           text,
  tokens_input    integer,
  tokens_output   integer,
  error           text,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_idx on messages(conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Agent runs
-- ---------------------------------------------------------------------------
create type run_status as enum (
  'queued', 'thinking', 'researching', 'writing', 'building', 'reviewing',
  'awaiting_approval', 'paused', 'completed', 'failed', 'stopped'
);

create table if not exists agent_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  project_id    uuid,
  task          text not null,
  status        run_status not null default 'queued',
  auto_approve  boolean not null default false,
  provider      text not null default 'server' check (provider in ('server', 'local')),
  model         text,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  ended_at      timestamptz
);
create index if not exists agent_runs_user_idx on agent_runs(user_id, created_at desc);

create table if not exists agent_steps (
  id                uuid primary key default gen_random_uuid(),
  run_id            uuid not null references agent_runs(id) on delete cascade,
  position          smallint not null,
  title             text not null,
  description       text not null default '',
  status            text not null default 'pending'
                    check (status in ('pending','active','awaiting_approval','done','failed','skipped')),
  tools             text[] not null default '{}',
  requires_approval boolean not null default false,
  approved_by       uuid references users(id),
  approved_at       timestamptz,
  started_at        timestamptz,
  ended_at          timestamptz,
  unique (run_id, position)
);

create table if not exists agent_logs (
  id         bigserial primary key,
  run_id     uuid not null references agent_runs(id) on delete cascade,
  step_id    uuid references agent_steps(id) on delete set null,
  tone       text not null default 'info' check (tone in ('info','success','warn','error','tool')),
  message    text not null,
  created_at timestamptz not null default now()
);
create index if not exists agent_logs_run_idx on agent_logs(run_id, created_at);

create table if not exists artifacts (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references agent_runs(id) on delete cascade,
  kind        text not null check (kind in ('html','markdown','code','table')),
  title       text not null,
  filename    text not null,
  content     text not null default '',
  outline     jsonb not null default '[]',
  version     integer not null default 1,
  updated_at  timestamptz not null default now()
);
create index if not exists artifacts_run_idx on artifacts(run_id);

create table if not exists artifact_files (
  id           uuid primary key default gen_random_uuid(),
  artifact_id  uuid not null references artifacts(id) on delete cascade,
  name         text not null,
  mime         text not null,
  size_bytes   integer not null default 0,
  content      text,
  storage_key  text,                          -- set when moved to R2/S3
  unique (artifact_id, name)
);

-- ---------------------------------------------------------------------------
-- Projects, plans & usage
-- ---------------------------------------------------------------------------
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  name        text not null,
  kind        text not null default 'report' check (kind in ('website','report','checklist','workflow')),
  status      text not null default 'draft' check (status in ('draft','active','archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists projects_user_idx on projects(user_id, updated_at desc);
alter table agent_runs
  add constraint agent_runs_project_fk foreign key (project_id) references projects(id) on delete set null;

create table if not exists subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  plan                plan_id not null default 'free',
  status              text not null default 'active' check (status in ('active','canceled','past_due')),
  provider            text,                  -- stripe | paddle | null (simulated)
  provider_customer   text,
  provider_subscription text,
  current_period_end  timestamptz,
  created_at          timestamptz not null default now()
);

create table if not exists usage_events (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null check (kind in ('chat','agent')),
  quantity   integer not null default 1,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists usage_user_period_idx on usage_events(user_id, kind, created_at);

-- Monthly usage rollup used to enforce plan limits
create or replace view usage_this_month as
select user_id,
       kind,
       date_trunc('month', created_at) as period,
       sum(quantity)::int as quantity
from usage_events
group by user_id, kind, date_trunc('month', created_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array['users','conversations','agent_runs','artifacts','projects'] loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row level security (Supabase style). The Node/Workers backend connects as
-- an owner role, so these policies protect direct client access.
-- ---------------------------------------------------------------------------
alter table users enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table agent_runs enable row level security;
alter table agent_steps enable row level security;
alter table projects enable row level security;
alter table usage_events enable row level security;

create policy "own profile" on users for select using (auth.uid() = id);
create policy "own conversations" on conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own messages" on messages for all using (
  exists (select 1 from conversations c where c.id = messages.conversation_id and c.user_id = auth.uid())
);
create policy "own runs" on agent_runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own steps" on agent_steps for all using (
  exists (select 1 from agent_runs r where r.id = agent_steps.run_id and r.user_id = auth.uid())
);
create policy "own projects" on projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own usage" on usage_events for select using (auth.uid() = user_id);

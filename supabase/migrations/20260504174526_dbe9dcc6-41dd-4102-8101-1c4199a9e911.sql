
-- Roles enum and table
create type public.app_role as enum ('admin', 'user');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- Auto-create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- Bot settings (per user)
create table public.bot_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  server_url text,
  api_token text, -- bearer token to talk to bot server (stored server-side via edge function)
  ai_enabled boolean not null default false,
  ai_system_prompt text not null default 'You are a helpful WhatsApp assistant. Reply concisely.',
  ai_model text not null default 'google/gemini-3-flash-preview',
  webhook_secret text not null default encode(gen_random_bytes(24), 'hex'),
  connection_status text not null default 'disconnected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bot_settings enable row level security;
create trigger bot_settings_updated before update on public.bot_settings
  for each row execute function public.set_updated_at();

-- Contacts
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wa_id text not null,
  name text,
  ai_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, wa_id)
);
alter table public.contacts enable row level security;
create trigger contacts_updated before update on public.contacts
  for each row execute function public.set_updated_at();

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wa_id text not null,
  direction text not null check (direction in ('in','out')),
  body text not null,
  ack text,
  wa_message_id text,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create index messages_user_wa_idx on public.messages (user_id, wa_id, created_at desc);

-- Auto-reply rules
create table public.auto_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_text text not null,
  match_type text not null default 'contains' check (match_type in ('contains','equals','regex')),
  response text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.auto_replies enable row level security;
create trigger auto_replies_updated before update on public.auto_replies
  for each row execute function public.set_updated_at();

-- Broadcasts
create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  recipient_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.broadcasts enable row level security;

create table public.broadcast_recipients (
  id uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  wa_id text not null,
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now()
);
alter table public.broadcast_recipients enable row level security;

-- RLS policies: each user owns their rows; admins see all
-- profiles
create policy "profiles self select" on public.profiles for select using (auth.uid() = id or public.has_role(auth.uid(),'admin'));
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

-- user_roles (read-only for users)
create policy "roles self select" on public.user_roles for select using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

-- Generic owner policies for the rest
create policy "bot_settings owner all" on public.bot_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "contacts owner all" on public.contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "messages owner select" on public.messages for select using (auth.uid() = user_id);
create policy "messages owner insert" on public.messages for insert with check (auth.uid() = user_id);
create policy "auto_replies owner all" on public.auto_replies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "broadcasts owner all" on public.broadcasts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "broadcast_recipients owner all" on public.broadcast_recipients for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.contacts;
alter publication supabase_realtime add table public.bot_settings;

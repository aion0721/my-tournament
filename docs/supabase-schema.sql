create extension if not exists pgcrypto;

create table if not exists public.events (
  id text primary key,
  name text not null,
  host_user_id text not null,
  host_auth_user_id uuid null references auth.users (id) on delete set null,
  capacity integer not null check (capacity > 1),
  participants_per_block integer not null check (participants_per_block > 1),
  winners_per_block integer not null check (winners_per_block > 0),
  block_count integer not null check (block_count > 0),
  share_token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id text primary key,
  event_id text not null references public.events (id) on delete cascade,
  name text not null,
  source_type text not null default 'open' check (source_type in ('open', 'invite')),
  invite_id text null,
  assigned_block_index integer not null check (assigned_block_index >= 0),
  assigned_seed integer not null check (assigned_seed > 0),
  joined_at timestamptz not null default now()
);

create unique index if not exists participants_event_slot_key
  on public.participants (event_id, assigned_block_index, assigned_seed);

create table if not exists public.event_invites (
  id text primary key,
  event_id text not null references public.events (id) on delete cascade,
  display_name text not null,
  invite_token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'joined')),
  fixed_block_index integer null check (fixed_block_index >= 0),
  fixed_seed integer null check (fixed_seed > 0),
  joined_participant_id text null,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id text primary key,
  event_id text not null references public.events (id) on delete cascade,
  block_id text null,
  stage_type text not null check (stage_type in ('block', 'final')),
  round_index integer not null check (round_index >= 0),
  match_index integer not null check (match_index >= 0),
  slot1_source jsonb not null,
  slot2_source jsonb not null,
  participant_sources jsonb null,
  advance_count integer null,
  is_final_stage boolean null default false,
  participant_ids jsonb null,
  qualified_participant_ids jsonb null,
  player1_participant_id text null references public.participants (id) on delete set null,
  player2_participant_id text null references public.participants (id) on delete set null,
  winner_participant_id text null references public.participants (id) on delete set null,
  next_match_id text null references public.matches (id) on delete set null,
  next_slot smallint null check (next_slot in (1, 2))
);

alter table public.participants
  add constraint participants_invite_id_fkey
  foreign key (invite_id) references public.event_invites (id) on delete set null;

alter table public.event_invites
  add constraint event_invites_joined_participant_id_fkey
  foreign key (joined_participant_id) references public.participants (id) on delete set null;

create index if not exists participants_event_id_idx on public.participants (event_id);
create index if not exists event_invites_event_id_idx on public.event_invites (event_id);
create index if not exists matches_event_id_idx on public.matches (event_id);

alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.event_invites enable row level security;
alter table public.matches enable row level security;

drop policy if exists "events are viewable by everyone" on public.events;
create policy "events are viewable by everyone"
  on public.events for select using (true);

drop policy if exists "participants are viewable by everyone" on public.participants;
create policy "participants are viewable by everyone"
  on public.participants for select using (true);

drop policy if exists "event invites are viewable by everyone for mvp" on public.event_invites;
create policy "event invites are viewable by everyone for mvp"
  on public.event_invites for select using (true);

drop policy if exists "matches are viewable by everyone" on public.matches;
create policy "matches are viewable by everyone"
  on public.matches for select using (true);

drop policy if exists "events can be inserted by everyone for mvp" on public.events;
create policy "events can be inserted by everyone for mvp"
  on public.events for insert with check (true);

drop policy if exists "participants can be inserted by everyone for mvp" on public.participants;
create policy "participants can be inserted by everyone for mvp"
  on public.participants for insert with check (true);

drop policy if exists "event invites can be inserted by everyone for mvp" on public.event_invites;
create policy "event invites can be inserted by everyone for mvp"
  on public.event_invites for insert with check (true);

drop policy if exists "event invites can be updated by everyone for mvp" on public.event_invites;
create policy "event invites can be updated by everyone for mvp"
  on public.event_invites for update using (true) with check (true);

drop policy if exists "matches can be inserted by everyone for mvp" on public.matches;
create policy "matches can be inserted by everyone for mvp"
  on public.matches for insert with check (true);

drop policy if exists "matches can be updated by everyone for mvp" on public.matches;
create policy "matches can be updated by everyone for mvp"
  on public.matches for update using (true) with check (true);

comment on policy "event invites can be updated by everyone for mvp" on public.event_invites is
'本番では auth.uid() = events.host_auth_user_id または招待参加確定に必要な最小条件へ絞る。';

comment on policy "matches can be updated by everyone for mvp" on public.matches is
'本番では auth.uid() = events.host_auth_user_id の条件に差し替える。';

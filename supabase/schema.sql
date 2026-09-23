-- Quire schema. Run this once in Supabase SQL Editor (Project > SQL Editor > New query).
-- Requires Supabase Auth (email or magic link) to be enabled — each signed-in user only
-- ever sees their own rows, enforced below with row-level security.

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled novel',
  goal_type text not null default 'words' check (goal_type in ('words','time')),
  period text not null default 'daily' check (period in ('daily','weekly')),
  period_goal integer not null default 500,
  book_goal integer not null default 80000,
  outline_mode text not null default 'loose' check (outline_mode in ('loose','three','stc')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists chapters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null default 'Untitled chapter',
  position integer not null default 0
);

create table if not exists scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  chapter_id uuid not null references chapters(id) on delete cascade,
  title text not null default 'Untitled scene',
  text text not null default '',
  word_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft','revised','final')),
  beat_three integer,
  beat_stc integer,
  position integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Story bible: characters, places, plot/timeline notes.
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null check (kind in ('character','place','plot')),
  name text not null default '',
  -- character: {bio, arc, relationships}; place: {description, lore}; plot: {when_label, summary, sort_key}
  fields jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Links an entry (character/place) to a scene it appears in — powers "linked scenes" everywhere.
create table if not exists scene_links (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references scenes(id) on delete cascade,
  entry_id uuid not null references entries(id) on delete cascade,
  unique (scene_id, entry_id)
);

-- Mind map nodes. A node can stand alone (idea) or mirror a bible entry / scene (kept in sync by the app).
create table if not exists map_nodes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null default 'idea' check (kind in ('idea','character','place','scene')),
  label text not null default '',
  x double precision not null default 0,
  y double precision not null default 0,
  entry_id uuid references entries(id) on delete cascade,
  scene_id uuid references scenes(id) on delete cascade
);

create table if not exists map_edges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  a uuid not null references map_nodes(id) on delete cascade,
  b uuid not null references map_nodes(id) on delete cascade,
  label text not null default ''
);

-- Research & inspiration: notes, reference links, and moodboard images (image_path -> Storage object).
create table if not exists research_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note','link','image')),
  title text not null default '',
  body text not null default '',
  url text,
  image_path text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- One row per writing session, used for both word and time goals/stats.
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  scene_id uuid references scenes(id) on delete set null,
  day date not null default current_date,
  words integer not null default 0,
  seconds integer not null default 0,
  started_at timestamptz not null default now()
);

create index if not exists idx_chapters_project on chapters(project_id);
create index if not exists idx_scenes_project on scenes(project_id);
create index if not exists idx_scenes_chapter on scenes(chapter_id);
create index if not exists idx_entries_project on entries(project_id);
create index if not exists idx_links_scene on scene_links(scene_id);
create index if not exists idx_links_entry on scene_links(entry_id);
create index if not exists idx_nodes_project on map_nodes(project_id);
create index if not exists idx_edges_project on map_edges(project_id);
create index if not exists idx_research_project on research_items(project_id);
create index if not exists idx_sessions_project_day on sessions(project_id, day);

-- Row-level security: every table but the join tables carries user_id indirectly via project_id.
alter table projects enable row level security;
alter table chapters enable row level security;
alter table scenes enable row level security;
alter table entries enable row level security;
alter table scene_links enable row level security;
alter table map_nodes enable row level security;
alter table map_edges enable row level security;
alter table research_items enable row level security;
alter table sessions enable row level security;

create policy "own projects" on projects for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own chapters" on chapters for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "own scenes" on scenes for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "own entries" on entries for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "own scene_links" on scene_links for all
  using (exists (select 1 from scenes s join projects p on p.id = s.project_id where s.id = scene_id and p.user_id = auth.uid()))
  with check (exists (select 1 from scenes s join projects p on p.id = s.project_id where s.id = scene_id and p.user_id = auth.uid()));

create policy "own map_nodes" on map_nodes for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "own map_edges" on map_edges for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "own research_items" on research_items for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));

create policy "own sessions" on sessions for all
  using (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()))
  with check (exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid()));

-- Storage bucket for moodboard images. Create the bucket named "research" in
-- Storage > New bucket (keep it private), then run this policy block.
insert into storage.buckets (id, name, public) values ('research', 'research', false)
  on conflict (id) do nothing;

create policy "own research images read" on storage.objects for select
  using (bucket_id = 'research' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own research images write" on storage.objects for insert
  with check (bucket_id = 'research' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own research images delete" on storage.objects for delete
  using (bucket_id = 'research' and (storage.foldername(name))[1] = auth.uid()::text);

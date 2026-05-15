-- DJ accounts (Supabase auth handles the actual user, this extends it)
create table dj_profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  email text,
  stripe_subscription_status text default 'inactive',
  created_at timestamp with time zone default now()
);

-- Clients (couples linked to a DJ)
create table clients (
  id uuid default gen_random_uuid() primary key,
  dj_id uuid references dj_profiles(id) on delete cascade,
  partner_1_name text,
  partner_2_name text,
  wedding_date date,
  status text default 'invited',
  invite_token uuid default gen_random_uuid() unique,
  created_at timestamp with time zone default now()
);

-- Songs saved by DJ-linked couples
create table client_songs (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references clients(id) on delete cascade,
  spotify_track_id text,
  title text,
  artist text,
  album text,
  album_art_url text,
  moment text,
  saved_at timestamp with time zone default now()
);

-- Enable RLS on all tables
alter table dj_profiles enable row level security;
alter table clients enable row level security;
alter table client_songs enable row level security;

-- RLS policies: DJs can only see their own data
create policy "DJs own profile" on dj_profiles for all using (auth.uid() = id);
create policy "DJs own clients" on clients for all using (auth.uid() = dj_id);
create policy "DJs own client songs" on client_songs for all
  using (
    exists (
      select 1 from clients
      where clients.id = client_songs.client_id
        and clients.dj_id = auth.uid()
    )
  );

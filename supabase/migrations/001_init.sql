-- Carton Plein : schéma, règles d'accès et logique de jeu côté serveur.
-- À exécuter une fois dans Supabase > SQL Editor (ou via `supabase db push`).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Catalogue : un album (master Discogs) par ligne, alimenté par scripts/sync-discogs.mjs.
create table if not exists public.releases (
  master_id     bigint primary key,
  artist        text not null,
  title         text not null,
  year          int,
  genres        text[] not null default '{}',
  styles        text[] not null default '{}',
  label         text,
  country       text,
  have          int not null default 0,
  want          int not null default 0,
  lowest_price  numeric,
  for_sale      int not null default 0,
  uri           text,
  gem           boolean not null default false,
  -- nombre d'éditions Discogs par format : {"v":606,"c":204,"k":259,"e":33}
  fmt_counts    jsonb not null default '{}'::jsonb,
  -- palier de rareté par format (1 à 5) : {"v":1,"c":1,"k":2,"e":4}
  tiers         jsonb not null default '{}'::jsonb,
  -- visuels par format, liens directs vers Discogs (jamais copiés) :
  -- {"v":{"release_id":1,"cover":"https://i.discogs.com/…","thumb":"…","back":"…"},"main":{…}}
  covers        jsonb not null default '{}'::jsonb,
  active        boolean not null default true,
  refreshed_at  timestamptz
);

create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  pseudo       text not null check (char_length(pseudo) between 2 and 24),
  city         text not null check (char_length(city) between 1 and 60),
  city_key     text not null,
  friend_code  text not null unique,
  boxes        int not null default 3,
  last_refill  timestamptz not null default now(),
  opened       int not null default 0,
  created_at   timestamptz not null default now()
);
create unique index if not exists profiles_pseudo_lower on public.profiles (lower(pseudo));
create index if not exists profiles_city_key on public.profiles (city_key);

create table if not exists public.copies (
  id           uuid primary key default gen_random_uuid(),
  owner        uuid not null references public.profiles(id) on delete cascade,
  master_id    bigint not null references public.releases(master_id),
  format       text not null check (format in ('v','c','k','e')),
  tier         smallint not null check (tier between 1 and 5),
  phantom      boolean not null default false,
  grade        text not null check (grade in ('M','NM','VG+','VG','G+')),
  serial       int not null,
  found_by     uuid references public.profiles(id) on delete set null,
  found_at     timestamptz not null default now(),
  acquired_at  timestamptz not null default now(),
  via          text not null default 'box' check (via in ('box','trade'))
);
create index if not exists copies_owner on public.copies (owner);
create index if not exists copies_master on public.copies (master_id, format);

create table if not exists public.friendships (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.trades (
  id          uuid primary key default gen_random_uuid(),
  from_user   uuid not null references public.profiles(id) on delete cascade,
  to_user     uuid not null references public.profiles(id) on delete cascade,
  give        uuid[] not null default '{}',
  take        uuid[] not null default '{}',
  status      text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired')),
  created_at  timestamptz not null default now(),
  done_at     timestamptz,
  check (from_user <> to_user),
  check (cardinality(give) + cardinality(take) > 0)
);
create index if not exists trades_from on public.trades (from_user, status);
create index if not exists trades_to on public.trades (to_user, status);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.city_key_of(s text) returns text
language sql immutable as $$
  -- « Paris », « Paris, FR » et « paris » donnent la même clé : seule la partie avant la virgule compte.
  select btrim(regexp_replace(
    translate(lower(split_part(coalesce(s,''), ',', 1)),
      'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
      'aaaaaaceeeeiiiinooooouuuuyy'),
    '[^a-z0-9]+', ' ', 'g'))
$$;

create or replace function public.profiles_set_city_key() returns trigger
language plpgsql as $$
begin
  new.city_key := public.city_key_of(new.city);
  new.pseudo := btrim(new.pseudo);
  new.city := btrim(new.city);
  return new;
end $$;

drop trigger if exists profiles_city_key on public.profiles;
create trigger profiles_city_key before insert or update of city, pseudo on public.profiles
  for each row execute function public.profiles_set_city_key();

-- ---------------------------------------------------------------------------
-- Règles du jeu (constantes)
--   3 cartons max en stock, 1 nouveau toutes les 3 h, 5 disques par carton,
--   le 5e disque est au moins « Étagère » (palier 2).
--   Tirage des paliers : 50 % / 28 % / 14,5 % / 6 % / 1,5 %.
--   États Goldmine : M 5 %, NM 20 %, VG+ 35 %, VG 25 %, G+ 15 %.
-- ---------------------------------------------------------------------------

create or replace function public.create_profile(p_pseudo text, p_city text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  p public.profiles;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from profiles where id = uid) then
    select * into p from profiles where id = uid; return p;
  end if;
  if exists (select 1 from profiles where lower(pseudo) = lower(btrim(p_pseudo))) then
    raise exception 'pseudo_taken';
  end if;
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from profiles where friend_code = code);
  end loop;
  insert into profiles (id, pseudo, city, city_key, friend_code)
    values (uid, p_pseudo, p_city, '', code)
    returning * into p;
  return p;
end $$;

create or replace function public.open_box()
returns setof public.copies
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  gained int; stock int; new_last timestamptz;
  r double precision; t int; tt int; g text; ser int;
  pick record;
  c public.copies;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into p from profiles where id = uid for update;
  if not found then raise exception 'no_profile'; end if;

  gained := greatest(0, floor(extract(epoch from (now() - p.last_refill)) / 10800)::int);
  stock := least(3, p.boxes + gained);
  if stock < 1 then raise exception 'no_box'; end if;
  new_last := case when stock >= 3 then now() else p.last_refill + make_interval(secs => gained * 10800) end;
  update profiles set boxes = stock - 1, last_refill = new_last, opened = opened + 1 where id = uid;

  for i in 1..5 loop
    r := random();
    t := case when r < 0.50 then 1 when r < 0.78 then 2 when r < 0.925 then 3 when r < 0.985 then 4 else 5 end;
    if i = 5 and t < 2 then t := 2; end if;
    tt := t;
    loop
      select rel.master_id, f.key as format,
             coalesce((rel.fmt_counts ->> f.key)::int, 0) = 0 as phantom
        into pick
        from releases rel, jsonb_each_text(rel.tiers) f
        where rel.active and f.value::int = tt
        order by random() limit 1;
      exit when pick.master_id is not null or tt <= 1;
      tt := tt - 1;
    end loop;
    if pick.master_id is null then raise exception 'empty_catalog'; end if;

    r := random();
    g := case when r < 0.05 then 'M' when r < 0.25 then 'NM' when r < 0.60 then 'VG+' when r < 0.85 then 'VG' else 'G+' end;

    perform pg_advisory_xact_lock(hashtext(pick.master_id::text || pick.format));
    select coalesce(max(serial), 0) + 1 into ser from copies
      where master_id = pick.master_id and format = pick.format;

    insert into copies (owner, master_id, format, tier, phantom, grade, serial, found_by)
      values (uid, pick.master_id, pick.format, tt, pick.phantom, g, ser, uid)
      returning * into c;
    return next c;
  end loop;
end $$;

create or replace function public.add_friend(p_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); fid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select id into fid from profiles where friend_code = upper(btrim(p_code));
  if fid is null then raise exception 'unknown_code'; end if;
  if fid = uid then raise exception 'own_code'; end if;
  insert into friendships (user_id, friend_id) values (uid, fid) on conflict do nothing;
  return fid;
end $$;

create or replace function public.propose_trade(p_to uuid, p_give uuid[], p_take uuid[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); tid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_to is null or p_to = uid then raise exception 'bad_target'; end if;
  p_give := coalesce(p_give, '{}'); p_take := coalesce(p_take, '{}');
  if cardinality(p_give) + cardinality(p_take) = 0 then raise exception 'empty_trade'; end if;
  if cardinality(p_give) > 10 or cardinality(p_take) > 10 then raise exception 'too_many'; end if;
  if not exists (select 1 from friendships where (user_id = uid and friend_id = p_to) or (user_id = p_to and friend_id = uid)) then
    raise exception 'not_friends';
  end if;
  if (select count(distinct x) from unnest(p_give) x) <> cardinality(p_give)
     or (select count(distinct x) from unnest(p_take) x) <> cardinality(p_take) then
    raise exception 'duplicate_copy';
  end if;
  if (select count(*) from copies where id = any(p_give) and owner = uid) <> cardinality(p_give) then
    raise exception 'not_your_copy';
  end if;
  if (select count(*) from copies where id = any(p_take) and owner = p_to) <> cardinality(p_take) then
    raise exception 'not_their_copy';
  end if;
  insert into trades (from_user, to_user, give, take) values (uid, p_to, p_give, p_take) returning id into tid;
  return tid;
end $$;

create or replace function public.accept_trade(p_trade uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); tr public.trades; ok_give int; ok_take int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into tr from trades where id = p_trade for update;
  if not found or tr.to_user <> uid then raise exception 'not_found'; end if;
  if tr.status <> 'pending' then return tr.status; end if;
  perform 1 from copies where id = any(tr.give || tr.take) for update;
  select count(*) into ok_give from copies where id = any(tr.give) and owner = tr.from_user;
  select count(*) into ok_take from copies where id = any(tr.take) and owner = tr.to_user;
  if ok_give <> cardinality(tr.give) or ok_take <> cardinality(tr.take) then
    update trades set status = 'expired', done_at = now() where id = tr.id;
    return 'expired';
  end if;
  update copies set owner = tr.to_user, acquired_at = now(), via = 'trade' where id = any(tr.give);
  update copies set owner = tr.from_user, acquired_at = now(), via = 'trade' where id = any(tr.take);
  update trades set status = 'accepted', done_at = now() where id = tr.id;
  return 'accepted';
end $$;

create or replace function public.close_trade(p_trade uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); tr public.trades; st text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into tr from trades where id = p_trade for update;
  if not found or (tr.to_user <> uid and tr.from_user <> uid) then raise exception 'not_found'; end if;
  if tr.status <> 'pending' then return tr.status; end if;
  st := case when tr.to_user = uid then 'declined' else 'cancelled' end;
  update trades set status = st, done_at = now() where id = tr.id;
  return st;
end $$;

create or replace function public.city_stats(p_key text)
returns jsonb
language sql stable security definer set search_path = public as $$
  with pl as (select id from profiles where city_key = p_key),
  cp as (
    select c.*, r.artist, r.genres
    from copies c join pl on pl.id = c.owner join releases r on r.master_id = c.master_id
  )
  select jsonb_build_object(
    'players', (select count(*) from pl),
    'copies', (select count(*) from cp),
    'formats', (select coalesce(jsonb_object_agg(format, n), '{}'::jsonb) from (select format, count(*) n from cp group by format) x),
    'artists', (select coalesce(jsonb_agg(jsonb_build_object('name', artist, 'n', n) order by n desc), '[]'::jsonb)
                from (select artist, count(*) n from cp group by artist order by n desc limit 8) x),
    'genres', (select coalesce(jsonb_agg(jsonb_build_object('name', g, 'n', n) order by n desc), '[]'::jsonb)
               from (select g, count(*) n from cp, unnest(genres) g group by g order by n desc limit 8) x),
    'best', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
               select id, owner, master_id, format, tier, phantom, grade, serial, found_at, via
               from cp order by tier desc, phantom desc, found_at desc limit 8) x),
    'recent', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
               select id, owner, master_id, format, tier, phantom, grade, serial, found_at, via
               from cp where via = 'box' order by found_at desc limit 8) x)
  )
$$;

create or replace function public.cities()
returns table (city_key text, city text, players bigint)
language sql stable security definer set search_path = public as $$
  select city_key, min(city) as city, count(*) as players
  from profiles group by city_key order by count(*) desc limit 30
$$;

-- ---------------------------------------------------------------------------
-- Droits d'accès : lecture large, écriture uniquement via les fonctions ci-dessus
-- ---------------------------------------------------------------------------

alter table public.releases    enable row level security;
alter table public.profiles    enable row level security;
alter table public.copies      enable row level security;
alter table public.friendships enable row level security;
alter table public.trades      enable row level security;

revoke all on public.releases, public.profiles, public.copies, public.friendships, public.trades from anon, authenticated;
grant select on public.releases to anon, authenticated;
grant select on public.profiles, public.copies, public.friendships, public.trades to authenticated;
grant update (pseudo, city) on public.profiles to authenticated;
grant delete on public.friendships to authenticated;

drop policy if exists releases_read on public.releases;
create policy releases_read on public.releases for select using (true);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists copies_read on public.copies;
create policy copies_read on public.copies for select to authenticated using (true);

drop policy if exists friendships_read on public.friendships;
create policy friendships_read on public.friendships for select to authenticated
  using (user_id = auth.uid() or friend_id = auth.uid());
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists trades_read on public.trades;
create policy trades_read on public.trades for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid());

revoke all on function public.create_profile(text, text), public.open_box(), public.add_friend(text),
  public.propose_trade(uuid, uuid[], uuid[]), public.accept_trade(uuid), public.close_trade(uuid),
  public.city_stats(text), public.cities() from public, anon;
grant execute on function public.create_profile(text, text), public.open_box(), public.add_friend(text),
  public.propose_trade(uuid, uuid[], uuid[]), public.accept_trade(uuid), public.close_trade(uuid),
  public.city_stats(text), public.cities() to authenticated;

-- Mises à jour en direct (échanges, collection) quand la publication Realtime existe (Supabase).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.trades; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.copies; exception when duplicate_object then null; end;
  end if;
end $$;

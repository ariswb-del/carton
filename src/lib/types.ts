export type Fmt = 'v' | 'c' | 'k' | 'e';
export type Grade = 'M' | 'NM' | 'VG+' | 'VG' | 'G+';

export type CoverInfo = {
  release_id?: number;
  uri?: string;
  cover?: string;
  thumb?: string;
  back?: string | null;
  w?: number;
  h?: number;
  label?: string | null;
  catno?: string | null;
  country?: string | null;
  year?: number | null;
};

export type Release = {
  master_id: number;
  artist: string;
  title: string;
  year: number | null;
  genres: string[];
  styles: string[];
  label: string | null;
  country: string | null;
  have: number;
  want: number;
  lowest_price: number | null;
  for_sale: number;
  uri: string | null;
  gem: boolean;
  fmt_counts: Partial<Record<Fmt, number>>;
  tiers: Partial<Record<Fmt, number>>;
  covers: Partial<Record<Fmt | 'main', CoverInfo>>;
  refreshed_at: string | null;
};

export type Copy = {
  id: string;
  owner: string;
  master_id: number;
  format: Fmt;
  tier: number;
  phantom: boolean;
  grade: Grade;
  serial: number;
  found_by: string | null;
  found_at: string;
  acquired_at: string;
  via: 'box' | 'trade';
};

export type Profile = {
  id: string;
  pseudo: string;
  city: string;
  city_key: string;
  friend_code: string;
  boxes: number;
  last_refill: string;
  opened: number;
  created_at: string;
};

export type Trade = {
  id: string;
  from_user: string;
  to_user: string;
  give: string[];
  take: string[];
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  created_at: string;
  done_at: string | null;
};

import type { Copy, Fmt, Grade, Profile, Release } from './types';

export const FORMATS: Fmt[] = ['v', 'c', 'k', 'e'];
export const FMT: Record<Fmt, string> = { v: 'Vinyle', c: 'CD', k: 'K7', e: '8-track' };
export const FMT_LONG: Record<Fmt, string> = { v: 'Vinyle', c: 'CD', k: 'Cassette', e: 'Cartouche 8-track' };

export const TIERS = [
  null,
  { n: 'Bac à 1 €', pts: 5, d: "Le fond du bac, ce qu'on trouve partout.", p: 0.5 },
  { n: 'Étagère', pts: 15, d: "Un bon disque qu'on range bien en vue.", p: 0.28 },
  { n: 'Vitrine', pts: 40, d: 'Ce que le disquaire met derrière la vitre.', p: 0.145 },
  { n: 'Coffre', pts: 120, d: 'Recherché, cher, rarement en bac.', p: 0.06 },
  { n: 'Graal', pts: 400, d: "Le disque d'une vie de digger.", p: 0.015 },
] as const;

export const GRADES: Record<Grade, { mult: number; long: string }> = {
  M: { mult: 1.5, long: 'Mint' },
  NM: { mult: 1.25, long: 'Near Mint' },
  'VG+': { mult: 1, long: 'Very Good Plus' },
  VG: { mult: 0.75, long: 'Very Good' },
  'G+': { mult: 0.5, long: 'Good Plus' },
};

export const BOX_MAX = 3;
export const REFILL_MS = 3 * 3600e3;
export const PER_BOX = 5;
export const PHANTOM_MULT = 1.5;

export function points(c: Pick<Copy, 'tier' | 'grade' | 'phantom'>): number {
  const t = TIERS[c.tier];
  return Math.round((t ? t.pts : 0) * (GRADES[c.grade]?.mult ?? 1) * (c.phantom ? PHANTOM_MULT : 1));
}

export function boxState(p: Profile | null, now = Date.now()) {
  if (!p) return { stock: 0, next: null as number | null };
  const last = Date.parse(p.last_refill);
  const gained = Math.max(0, Math.floor((now - last) / REFILL_MS));
  const stock = Math.min(BOX_MAX, p.boxes + gained);
  return { stock, next: stock >= BOX_MAX ? null : last + (gained + 1) * REFILL_MS };
}

export function coverFor(r: Release, f: Fmt) {
  return r.covers?.[f]?.cover ? r.covers[f]! : r.covers?.main ?? {};
}

export const discogsUrl = (path?: string | null) => (path ? (path.startsWith('http') ? path : `https://www.discogs.com${path}`) : 'https://www.discogs.com');

export const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0));
export const fmtEur = (n: number | null) =>
  n == null ? '–' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n < 10 ? 2 : 0 }).format(n);

export function ago(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

export function duration(ms: number) {
  ms = Math.max(0, ms);
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1e3);
  return `${h ? h + ' h ' : ''}${String(m).padStart(h ? 2 : 1, '0')} min ${String(s).padStart(2, '0')} s`;
}

export function hash(s: string | number) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const searchKey = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ERRORS: Record<string, string> = {
  no_box: "Plus de carton pour l'instant : le prochain arrive bientôt.",
  empty_catalog: "Le catalogue n'est pas encore chargé.",
  pseudo_taken: 'Ce pseudo est déjà pris.',
  unknown_code: 'Aucun joueur avec ce code.',
  own_code: "C'est ton propre code.",
  not_friends: "Vous devez être amis pour échanger.",
  not_your_copy: "Un des disques proposés n'est plus dans ton bac.",
  not_their_copy: "Un des disques demandés n'est plus dans son bac.",
  too_many: '10 disques maximum de chaque côté.',
  empty_trade: 'Choisis au moins un disque.',
  not_authenticated: 'Ta session a expiré, reconnecte-toi.',
};
export function errorText(e: unknown) {
  const msg = (e as { message?: string })?.message || '';
  const key = Object.keys(ERRORS).find(k => msg.includes(k));
  return key ? ERRORS[key] : 'Action impossible pour le moment, réessaie.';
}

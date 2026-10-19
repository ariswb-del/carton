'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Shell from '@/components/Shell';
import { useGame } from '@/components/Game';
import { CopyCard, CopySheet, Tier } from '@/components/ui';
import MediaObject from '@/components/objects/MediaObject';
import { ago, errorText, FMT, FORMATS, fmtNum } from '@/lib/game';
import type { Copy } from '@/lib/types';

type Stats = {
  players: number; copies: number; formats: Record<string, number>;
  artists: { name: string; n: number }[]; genres: { name: string; n: number }[];
  best: Copy[]; recent: Copy[];
};
type City = { city_key: string; city: string; players: number };

function Bars({ rows }: { rows: { name: string; n: number }[] }) {
  const max = rows[0]?.n || 1;
  return <div className="bars">{rows.map(r => <div className="bar" key={r.name}><span>{r.name}</span><span className="mono muted">{r.n}</span><div className="fill"><i style={{ width: `${(r.n / max) * 100}%` }} /></div></div>)}</div>;
}

function Town() {
  const { sb, profile, releases, people, loadPeople, refreshProfile, toast } = useGame();
  const [stats, setStats] = useState<Stats | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [detail, setDetail] = useState<Copy | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const [s, c] = await Promise.all([sb.rpc('city_stats', { p_key: profile.city_key }), sb.rpc('cities')]);
    const st = s.data as Stats | null;
    if (st) { st.best = st.best.map(x => ({ ...x, master_id: Number(x.master_id) })); st.recent = st.recent.map(x => ({ ...x, master_id: Number(x.master_id) })); }
    setStats(st); setCities((c.data as City[]) ?? []);
    if (st) loadPeople([...st.best, ...st.recent].map(x => x.owner));
  }, [sb, profile, loadPeople]);
  useEffect(() => { load(); }, [load]);

  if (!profile) return null;

  async function move(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const city = String(new FormData(e.currentTarget).get('city')).trim();
    const { error } = await sb.from('profiles').update({ city }).eq('id', profile!.id);
    if (error) return toast(errorText(error));
    await refreshProfile(); toast('Ville mise à jour.');
  }

  return (
    <div className="section">
      <div><div className="eyebrow">Ma ville</div><h1>Ça tourne à {profile.city}</h1></div>
      <form className="row" onSubmit={move}>
        <input className="input" name="city" defaultValue={profile.city} maxLength={60} style={{ maxWidth: 280 }} aria-label="Ta ville" list="known-cities" />
        <datalist id="known-cities">{cities.map(c => <option key={c.city_key} value={c.city} />)}</datalist>
        <button className="btn small">Changer de ville</button>
      </form>
      {!stats ? <div className="empty">Chargement des bacs du quartier…</div> : !stats.copies ? <div className="empty">Personne n&apos;a encore ouvert de carton par ici.</div> : <>
        <div className="stats">
          <div className="stat"><b>{stats.players}</b><span>collectionneur{stats.players > 1 ? 's' : ''} ici</span></div>
          <div className="stat"><b>{fmtNum(stats.copies)}</b><span>disques dans les bacs</span></div>
          {FORMATS.map(f => <div className="stat" key={f}><b>{fmtNum(stats.formats[f] ?? 0)}</b><span>{FMT[f]}</span></div>)}
        </div>
        <div className="two"><div className="stack"><h3>Les artistes du coin</h3><Bars rows={stats.artists} /></div><div className="stack"><h3>Les genres du coin</h3><Bars rows={stats.genres} /></div></div>
        <div className="stack"><h3>Les plus belles pièces du quartier</h3>
          <div className="grid">{stats.best.map(c => { const r = releases.get(c.master_id); return r ? <CopyCard key={c.id} copy={c} release={r} onClick={() => setDetail(c)} /> : null; })}</div>
        </div>
        <div className="stack"><h3>Sorties de carton récentes</h3>
          <div className="list">{stats.recent.map(c => { const r = releases.get(c.master_id); return r ? (
            <div className="li" key={c.id}><div className="mini"><MediaObject release={r} format={c.format} phantom={c.phantom} /></div>
              <div className="grow"><b>{r.title}</b><span className="muted small">{r.artist} · trouvé par {people.get(c.owner)?.pseudo ?? 'un voisin'}, {ago(c.found_at)}</span></div><Tier t={c.tier} /></div>
          ) : null; })}</div>
        </div>
      </>}
      <div className="stack"><h3>Les villes du réseau</h3>
        <div className="list">{cities.slice(0, 12).map(c => <div className="li" key={c.city_key}><div className="grow"><b>{c.city}</b></div><span className="mono muted">{c.players} joueur{c.players > 1 ? 's' : ''}</span></div>)}</div>
      </div>
      {detail && releases.get(detail.master_id) && <CopySheet release={releases.get(detail.master_id)!} format={detail.format} copy={detail} owner={people.get(detail.owner)?.pseudo} onClose={() => setDetail(null)} />}
    </div>
  );
}

export default function Page() { return <Shell><Town /></Shell>; }

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import { useGame } from '@/components/Game';
import { CopyCard, CopySheet, TierBar } from '@/components/ui';
import { fmtNum, points, searchKey } from '@/lib/game';
import { collectionStats } from '@/lib/stats';
import type { Copy, Release } from '@/lib/types';

const SORTS: Record<string, (a: Copy, b: Copy, rel: Map<number, Release>) => number> = {
  value: (a, b) => points(b) - points(a),
  tier: (a, b) => b.tier - a.tier || points(b) - points(a),
  recent: (a, b) => Date.parse(b.acquired_at) - Date.parse(a.acquired_at),
  year: (a, b, r) => (r.get(a.master_id)?.year ?? 0) - (r.get(b.master_id)?.year ?? 0),
  artist: (a, b, r) => (r.get(a.master_id)?.artist ?? '').localeCompare(r.get(b.master_id)?.artist ?? ''),
};

function Collection() {
  const { copies, releases, releaseList, profile } = useGame();
  const [f, setF] = useState<'all' | 'v' | 'c' | 'k' | 'e' | 'ph'>('all');
  const [sort, setSort] = useState('value');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState<Copy | null>(null);
  const st = collectionStats(copies, releaseList.length);

  const groups = useMemo(() => {
    const k = searchKey(q);
    const list = copies.filter(c => (f === 'all' || (f === 'ph' ? c.phantom : c.format === f)) && (!k || searchKey(`${releases.get(c.master_id)?.artist} ${releases.get(c.master_id)?.title}`).includes(k)));
    list.sort((a, b) => SORTS[sort](a, b, releases));
    const m = new Map<string, { c: Copy; n: number }>();
    for (const c of list) { const key = `${c.master_id}|${c.format}|${c.grade}|${c.phantom}`; const g = m.get(key); if (g) g.n++; else m.set(key, { c, n: 1 }); }
    return [...m.values()];
  }, [copies, f, sort, q, releases]);

  if (!copies.length) return <div className="empty"><b>Ton bac est vide</b><span>Ouvre ton premier carton pour commencer la collection.</span><Link className="btn primary" href="/cartons">Aller aux cartons</Link></div>;

  return (
    <div className="section">
      <div><div className="eyebrow">Ma collection</div><h1>Le bac de {profile?.pseudo}</h1></div>
      <div className="stats">
        <div className="stat"><b>{fmtNum(st.n)}</b><span>exemplaires</span></div>
        <div className="stat"><b>{fmtNum(st.albums)}</b><span>albums différents</span></div>
        <div className="stat"><b>{Math.round(st.pct * 100)} %</b><span>du catalogue</span></div>
        <div className="stat"><b>{fmtNum(st.value)}</b><span>points de cote</span></div>
        <div className="stat"><b>{fmtNum(st.phantoms)}</b><span>pressages fantômes</span></div>
      </div>
      <TierBar byTier={st.byTier} total={st.n} />
      <div className="row between">
        <div className="chips" role="group" aria-label="Filtrer par format">
          {([['all', 'Tout'], ['v', 'Vinyles'], ['c', 'CD'], ['k', 'K7'], ['e', '8-track'], ['ph', 'Fantômes']] as const).map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={f === k} onClick={() => setF(k)}>{l}</button>
          ))}
        </div>
        <div className="row">
          <input className="input" style={{ width: 220 }} placeholder="Chercher un artiste, un titre" value={q} onChange={e => setQ(e.target.value)} aria-label="Chercher dans la collection" />
          <select className="input" style={{ width: 'auto' }} value={sort} onChange={e => setSort(e.target.value)} aria-label="Trier">
            <option value="value">Valeur</option><option value="tier">Rareté</option><option value="recent">Récents</option><option value="year">Année</option><option value="artist">Artiste</option>
          </select>
        </div>
      </div>
      {groups.length ? (
        <div className="grid">
          {groups.map(({ c, n }) => { const r = releases.get(c.master_id); return r ? <CopyCard key={c.id} copy={c} release={r} count={n} onClick={() => setDetail(c)} /> : null; })}
        </div>
      ) : <div className="empty">Rien ne correspond à ce filtre.</div>}
      {detail && releases.get(detail.master_id) && <CopySheet release={releases.get(detail.master_id)!} format={detail.format} copy={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

export default function Page() { return <Shell><Collection /></Shell>; }

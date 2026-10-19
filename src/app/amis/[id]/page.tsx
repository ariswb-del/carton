'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import { useGame } from '@/components/Game';
import { CopyCard } from '@/components/ui';
import MediaObject from '@/components/objects/MediaObject';
import { errorText, fmtNum, points } from '@/lib/game';
import { collectionStats } from '@/lib/stats';
import type { Copy } from '@/lib/types';

function Compare({ id }: { id: string }) {
  const { sb, copies: mine, releases, releaseList, people, loadPeople, refreshTrades, toast } = useGame();
  const router = useRouter();
  const [theirs, setTheirs] = useState<Copy[] | null>(null);
  const [give, setGive] = useState<Set<string>>(new Set());
  const [take, setTake] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const friend = people.get(id);

  useEffect(() => {
    loadPeople([id]);
    sb.from('copies').select('*').eq('owner', id).limit(5000).then(({ data }) => setTheirs(((data as Copy[]) ?? []).map(c => ({ ...c, master_id: Number(c.master_id) }))));
  }, [sb, id, loadPeople]);

  const cmp = useMemo(() => {
    if (!theirs) return null;
    const mm = new Set(mine.map(c => c.master_id)), tm = new Set(theirs.map(c => c.master_id));
    return { common: [...mm].filter(m => tm.has(m)), onlyMe: [...mm].filter(m => !tm.has(m)), onlyThem: [...tm].filter(m => !mm.has(m)) };
  }, [mine, theirs]);

  if (!theirs || !cmp) return <div className="empty">Chargement du bac de {friend?.pseudo ?? 'ton ami'}…</div>;
  const ms = collectionStats(mine, releaseList.length), ts = collectionStats(theirs, releaseList.length);

  const albumList = (ids: number[]) => ids.length ? (
    <div className="list">
      {ids.slice(0, 40).map(m => { const r = releases.get(m); return r ? (
        <div className="li" key={m}><div className="mini"><MediaObject release={r} format="v" /></div><div className="grow"><b>{r.title}</b><span className="muted small">{r.artist}</span></div></div>
      ) : null; })}
      {ids.length > 40 && <span className="muted small">+ {ids.length - 40} autres</span>}
    </div>
  ) : <div className="empty">Aucun</div>;

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, cid: string) => {
    const n = new Set(set); if (n.has(cid)) n.delete(cid); else if (n.size < 10) n.add(cid); else toast('10 disques maximum de chaque côté.'); setter(n);
  };
  const pickGrid = (list: Copy[], set: Set<string>, setter: (s: Set<string>) => void) => list.length ? (
    <div className="grid">
      {[...list].sort((a, b) => points(b) - points(a)).map(c => { const r = releases.get(c.master_id); return r ? <CopyCard key={c.id} copy={c} release={r} pickable checked={set.has(c.id)} onClick={() => toggle(set, setter, c.id)} /> : null; })}
    </div>
  ) : <div className="empty">Bac vide.</div>;

  async function propose() {
    setBusy(true);
    const { error } = await sb.rpc('propose_trade', { p_to: id, p_give: [...give], p_take: [...take] });
    setBusy(false);
    if (error) return toast(errorText(error));
    await refreshTrades();
    toast('Proposition envoyée.');
    router.push('/echanges');
  }

  return (
    <div className="section">
      <div className="row"><Link className="btn small ghost" href="/amis">← Amis</Link></div>
      <div><div className="eyebrow">Comparaison</div><h1>Toi et {friend?.pseudo ?? 'ton ami'}</h1></div>
      <div className="stats">
        <div className="stat"><b>{fmtNum(ms.albums)} · {fmtNum(ts.albums)}</b><span>albums (toi · lui/elle)</span></div>
        <div className="stat"><b>{fmtNum(ms.value)} · {fmtNum(ts.value)}</b><span>points de cote</span></div>
        <div className="stat"><b>{cmp.common.length}</b><span>albums en commun</span></div>
      </div>
      <div className="split">
        <div className="stack"><h3>En commun ({cmp.common.length})</h3>{albumList(cmp.common)}</div>
        <div className="stack"><h3>Toi seulement ({cmp.onlyMe.length})</h3>{albumList(cmp.onlyMe)}</div>
        <div className="stack"><h3>Lui/elle seulement ({cmp.onlyThem.length})</h3>{albumList(cmp.onlyThem)}</div>
      </div>
      <div className="section">
        <div className="row between"><h2>Proposer un échange</h2>
          <button className="btn primary" onClick={propose} disabled={busy || (!give.size && !take.size)}>Envoyer ({give.size} contre {take.size})</button>
        </div>
        <h3>Tu donnes</h3>{pickGrid(mine, give, setGive)}
        <h3>Tu reçois</h3>{pickGrid(theirs, take, setTake)}
      </div>
    </div>
  );
}

export default function Page({ params }: { params: { id: string } }) { return <Shell><Compare id={params.id} /></Shell>; }

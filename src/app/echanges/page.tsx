'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useGame } from '@/components/Game';
import { Tier } from '@/components/ui';
import { ago, errorText, FMT } from '@/lib/game';
import type { Copy, Trade } from '@/lib/types';

const STATUS: Record<Trade['status'], string> = { pending: 'En attente', accepted: 'Conclu', declined: 'Refusé', cancelled: 'Annulé', expired: 'Expiré' };

function Trades() {
  const { sb, profile, trades, releases, people, loadPeople, refreshTrades, refreshCopies, toast } = useGame();
  const [items, setItems] = useState<Map<string, Copy | null>>(new Map());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadPeople(trades.flatMap(t => [t.from_user, t.to_user]));
    const ids = [...new Set(trades.flatMap(t => [...t.give, ...t.take]))].filter(id => !items.has(id));
    if (!ids.length) return;
    sb.from('copies').select('*').in('id', ids).then(({ data }) => {
      setItems(prev => { const m = new Map(prev); ids.forEach(id => m.set(id, null)); ((data as Copy[]) ?? []).forEach(c => m.set(c.id, { ...c, master_id: Number(c.master_id) })); return m; });
    });
  }, [trades, sb, loadPeople, items]);

  if (!profile) return null;

  async function act(t: Trade, accept: boolean) {
    setBusy(true);
    const { data, error } = await sb.rpc(accept ? 'accept_trade' : 'close_trade', { p_trade: t.id });
    setBusy(false);
    if (error) return toast(errorText(error));
    if (data === 'expired') toast('Un des disques a déjà changé de main : échange annulé.');
    else if (data === 'accepted') toast('Échange conclu. Les disques sont dans ton bac.');
    setItems(new Map());
    await Promise.all([refreshTrades(), refreshCopies()]);
  }

  const side = (ids: string[]) => ids.length ? ids.map(id => {
    const c = items.get(id);
    if (c === undefined) return <div key={id} className="muted small">…</div>;
    if (c === null) return <div key={id} className="muted small">disque introuvable</div>;
    const r = releases.get(c.master_id);
    return r ? <div key={id} className="row" style={{ gap: 6 }}><b>{r.title}</b><span className="tag">{FMT[c.format]}</span><span className="tag">{c.grade}</span><Tier t={c.tier} /></div> : null;
  }) : <span className="muted small">rien</span>;

  const card = (t: Trade) => {
    const inc = t.to_user === profile.id;
    const other = people.get(inc ? t.from_user : t.to_user)?.pseudo ?? 'Collectionneur';
    return (
      <div className="panel stack" key={t.id}>
        <div className="row between"><b>{inc ? `${other} te propose` : `Proposé à ${other}`}</b><span className="muted small">{STATUS[t.status]} · {ago(t.created_at)}</span></div>
        <div className="two">
          <div><div className="eyebrow">Tu donnes</div>{side(inc ? t.take : t.give)}</div>
          <div><div className="eyebrow">Tu reçois</div>{side(inc ? t.give : t.take)}</div>
        </div>
        {t.status === 'pending' && (
          <div className="row">
            {inc ? <>
              <button className="btn small primary" disabled={busy} onClick={() => act(t, true)}>Accepter</button>
              <button className="btn small ghost" disabled={busy} onClick={() => act(t, false)}>Refuser</button>
            </> : <button className="btn small ghost" disabled={busy} onClick={() => act(t, false)}>Annuler la proposition</button>}
          </div>
        )}
      </div>
    );
  };

  const pending = trades.filter(t => t.status === 'pending');
  const past = trades.filter(t => t.status !== 'pending').slice(0, 20);
  return (
    <div className="section">
      <div><div className="eyebrow">Échanges</div><h1>Au comptoir</h1></div>
      <p className="lede">Les échanges se proposent depuis la page d&apos;un ami, onglet Amis. Un échange accepté est immédiat et définitif.</p>
      <div className="stack"><h3>En cours ({pending.length})</h3>{pending.length ? pending.map(card) : <div className="empty">Aucune proposition en cours.</div>}</div>
      {past.length > 0 && <div className="stack"><h3>Historique</h3>{past.map(card)}</div>}
    </div>
  );
}

export default function Page() { return <Shell><Trades /></Shell>; }

'use client';

import { useEffect, useState } from 'react';
import Shell, { CartonArt } from '@/components/Shell';
import { useGame } from '@/components/Game';
import { CopyCard, CopySheet, GhostTag, Pips } from '@/components/ui';
import { BOX_MAX, boxState, duration, errorText, fmtNum, PER_BOX, TIERS } from '@/lib/game';
import type { Copy } from '@/lib/types';

function Cartons() {
  const { sb, profile, releases, releaseList, refreshProfile, refreshCopies, toast } = useGame();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [pulled, setPulled] = useState<Copy[] | null>(null);
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [detail, setDetail] = useState<Copy | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const st = boxState(profile, now);

  async function open() {
    if (busy || st.stock < 1) return;
    setBusy(true); setOpening(true); setPulled(null); setFlipped(new Set());
    const { data, error } = await sb.rpc('open_box');
    if (error) { setBusy(false); setOpening(false); return toast(errorText(error)); }
    await new Promise(r => setTimeout(r, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650));
    setPulled(((data as Copy[]) ?? []).map(c => ({ ...c, master_id: Number(c.master_id) })));
    setBusy(false);
    refreshProfile(); refreshCopies();
  }

  if (!releaseList.length) return <div className="empty"><b>Le catalogue n&apos;est pas encore chargé</b><span>Lance la synchronisation Discogs (voir le guide d&apos;installation).</span></div>;

  return (
    <>
      <div className="hero">
        <div className="stack" style={{ justifyItems: 'start' }}>
          <div className="eyebrow">Brocante du jour · {fmtNum(releaseList.length)} albums en circulation</div>
          <h1>{st.stock ? 'Un carton à fouiller' : "Plus de cartons pour l'instant"}</h1>
          <p className="lede">Chaque carton contient {PER_BOX} disques, dont au moins un « Étagère » ou mieux. Un nouveau carton arrive toutes les 3 heures, jusqu&apos;à {BOX_MAX} en stock.</p>
          <div className="row" style={{ fontWeight: 700 }}><Pips n={st.stock} big /> {st.stock} / {BOX_MAX} carton{st.stock > 1 ? 's' : ''}</div>
          <div className="row">
            <button className="btn primary" onClick={open} disabled={busy || st.stock < 1}>Ouvrir un carton</button>
            {pulled && <button className="btn ghost" onClick={() => setFlipped(new Set(pulled.map((_, i) => i)))}>Tout retourner</button>}
          </div>
          <div className="mono muted small">{st.next ? `Prochain carton dans ${duration(st.next - now)}` : 'Stock plein'}</div>
        </div>
        <CartonArt open={opening && !busy} shake={busy} lot={(profile?.opened ?? 0) + (pulled ? 0 : 1)} />
      </div>

      {pulled && (
        <div className="section">
          <div className="row between"><h2>Dans le carton</h2><span className="muted small">Touche un disque pour le retourner</span></div>
          <div className="reveal">
            {pulled.map((c, i) => {
              const r = releases.get(c.master_id); if (!r) return null;
              const done = flipped.has(i);
              return (
                <div key={c.id} className="reveal-slot">
                  {done
                    ? <div className="turn-in"><CopyCard copy={c} release={r} onClick={() => setDetail(c)} /></div>
                    : <button type="button" className="kraft-back rise" style={{ animationDelay: `${i * 90}ms` }} aria-label={`Retourner le disque ${i + 1}`} onClick={() => setFlipped(s => new Set(s).add(i))}>?</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="section">
        <h2>Les paliers de rareté</h2>
        <div className="list">
          {[5, 4, 3, 2, 1].map(t => (
            <div className="li" key={t}><span className={`tier t${t}`}>{TIERS[t]!.n}</span><div className="grow"><span className="muted">{TIERS[t]!.d}</span></div><span className="mono muted">{(TIERS[t]!.p * 100).toLocaleString('fr-FR')} %</span></div>
          ))}
          <div className="li"><GhostTag /><div className="grow"><span className="muted">Le disque existe, mais jamais dans ce format. Monte en rareté et vaut 1,5× plus de points.</span></div></div>
        </div>
        <p className="muted small" style={{ margin: 0 }}>La rareté combine la demande Discogs (ratio want/have), le prix plancher du marché Discogs et la rareté réelle du format pour l&apos;album. L&apos;état Goldmine (M, NM, VG+, VG, G+) module la valeur en points et se voit sur l&apos;objet.</p>
      </div>

      {detail && releases.get(detail.master_id) && <CopySheet release={releases.get(detail.master_id)!} format={detail.format} copy={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

export default function Page() { return <Shell><Cartons /></Shell>; }

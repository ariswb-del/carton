'use client';

import { useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import { useGame } from '@/components/Game';
import { CopySheet } from '@/components/ui';
import MediaObject from '@/components/objects/MediaObject';
import { discogsUrl, FMT, FMT_LONG, FORMATS, fmtEur, fmtNum, searchKey, TIERS } from '@/lib/game';
import type { Fmt, Release } from '@/lib/types';

function Catalogue() {
  const { releaseList, copies } = useGame();
  const [q, setQ] = useState('');
  const [gems, setGems] = useState(false);
  const [detail, setDetail] = useState<{ r: Release; f: Fmt } | null>(null);

  const owned = useMemo(() => { const m = new Map<number, number>(); copies.forEach(c => m.set(c.master_id, (m.get(c.master_id) ?? 0) + 1)); return m; }, [copies]);
  const list = useMemo(() => {
    const k = searchKey(q);
    return [...releaseList]
      .filter(r => (!gems || r.gem) && (!k || searchKey(`${r.artist} ${r.title} ${r.label ?? ''} ${(r.styles || []).join(' ')}`).includes(k)))
      .sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title));
  }, [releaseList, q, gems]);

  return (
    <div className="section">
      <div><div className="eyebrow">Catalogue</div><h1>{fmtNum(releaseList.length)} albums dans les bacs</h1></div>
      <p className="lede">Chaque album existe en quatre formats dans le jeu. Les pastilles donnent la rareté de chaque format ; un contour en pointillés signale un pressage fantôme, jamais sorti dans la réalité. Clique sur un format pour voir l&apos;objet.</p>
      <div className="row">
        <input className="input" style={{ maxWidth: 320 }} placeholder="Artiste, titre, label, style" value={q} onChange={e => setQ(e.target.value)} aria-label="Chercher dans le catalogue" />
        <button type="button" className="chip" aria-pressed={gems} onClick={() => setGems(g => !g)}>Pépites seulement</button>
        <span className="muted small">{list.length} résultat{list.length > 1 ? 's' : ''}</span>
      </div>
      <div className="tablewrap">
        <table>
          <thead><tr><th></th><th>Album</th><th>Année</th><th>Formats dans le jeu</th><th style={{ textAlign: 'right' }}>Have / Want</th><th style={{ textAlign: 'right' }}>Prix plancher</th><th style={{ textAlign: 'right' }}>À toi</th><th></th></tr></thead>
          <tbody>
            {list.map(r => (
              <tr key={r.master_id}>
                <td style={{ width: 56 }}><MediaObject release={r} format="v" /></td>
                <td><b>{r.title}</b><br /><span className="muted">{r.artist}</span>{r.gem && <> <span className="tier t5" style={{ fontSize: 10 }}>Pépite</span></>}</td>
                <td className="num">{r.year || '–'}</td>
                <td><div className="row" style={{ gap: 4 }}>
                  {FORMATS.map(f => (
                    <button key={f} type="button" className={`fx t${r.tiers?.[f] ?? 1} ${r.fmt_counts?.[f] ? '' : 'ph'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => setDetail({ r, f })}
                      title={`${FMT_LONG[f]} : ${r.fmt_counts?.[f] ? `${fmtNum(r.fmt_counts[f]!)} édition(s) sur Discogs` : 'jamais sorti, pressage fantôme'} · ${TIERS[r.tiers?.[f] ?? 1]?.n}`}>
                      {FMT[f]}{r.fmt_counts?.[f] ? '' : ' ✦'}
                    </button>
                  ))}
                </div></td>
                <td className="num">{fmtNum(r.have)} / {fmtNum(r.want)}</td>
                <td className="num">{fmtEur(r.lowest_price)}</td>
                <td className="num">{owned.get(r.master_id) ? `×${owned.get(r.master_id)}` : '–'}</td>
                <td><a href={discogsUrl(r.uri)} target="_blank" rel="noopener noreferrer">Discogs ↗</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail && <CopySheet release={detail.r} format={detail.f} onClose={() => setDetail(null)} />}
    </div>
  );
}

export default function Page() { return <Shell><Catalogue /></Shell>; }

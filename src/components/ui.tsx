'use client';

import { useEffect, type ReactNode } from 'react';
import MediaObject from './objects/MediaObject';
import ObjectStage from './objects/ObjectStage';
import { discogsUrl, FMT, FMT_LONG, FORMATS, fmtEur, fmtNum, GRADES, points, TIERS } from '@/lib/game';
import type { Copy, Fmt, Release } from '@/lib/types';

export const Tier = ({ t }: { t: number }) => <span className={`tier t${t}`}>{TIERS[t]?.n}</span>;
export const GhostTag = () => <span className="ghost-tag" title="Ce format n'a jamais existé pour cet album">Pressage fantôme</span>;

export function Pips({ n, big }: { n: number; big?: boolean }) {
  return <span className={`pips ${big ? 'big' : ''}`} aria-label={`${n} carton(s) disponible(s)`}>{[0, 1, 2].map(i => <i key={i} className={i < n ? 'on' : ''} />)}</span>;
}

type CardProps = {
  copy: Pick<Copy, 'format' | 'tier' | 'phantom' | 'grade'> & Partial<Pick<Copy, 'id' | 'serial'>>;
  release: Release;
  count?: number;
  checked?: boolean;
  pickable?: boolean;
  onClick?: () => void;
};

export function CopyCard({ copy, release, count, checked, pickable, onClick }: CardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`card r${copy.tier} ${checked ? 'sel' : ''}`} onClick={onClick} aria-pressed={pickable ? !!checked : undefined}>
      {pickable && <input type="checkbox" className="pick" tabIndex={-1} aria-hidden="true" checked={!!checked} readOnly />}
      {count && count > 1 ? <span className="cnt">×{count}</span> : null}
      <div className="art"><MediaObject release={release} format={copy.format} phantom={copy.phantom} grade={copy.grade} /></div>
      <div>
        <div className="t">{release.title}</div>
        <div className="a">{release.artist}{release.year ? ` · ${release.year}` : ''}</div>
      </div>
      <div className="meta">
        <span className="tag">{FMT[copy.format]}</span>
        <span className="tag" title={GRADES[copy.grade]?.long}>{copy.grade}</span>
        <Tier t={copy.tier} />
        {copy.phantom && <GhostTag />}
      </div>
    </Tag>
  );
}

export function Sheet({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="scrim" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}

/** Fiche d'un exemplaire (ou d'un format du catalogue) avec l'objet en main. */
export function CopySheet({ release, format, copy, owner, onClose }: { release: Release; format: Fmt; copy?: Copy; owner?: string; onClose: () => void }) {
  const phantom = copy ? copy.phantom : !(release.fmt_counts?.[format]);
  const cv = release.covers?.[format];
  const editionUrl = cv?.uri ? discogsUrl(cv.uri) : discogsUrl(release.uri);
  return (
    <Sheet onClose={onClose} label={`${release.title}, ${FMT_LONG[format]}`}>
      <div className="row between">
        <div className="eyebrow">{FMT_LONG[format]}{copy ? ` · état ${copy.grade} · exemplaire n° ${copy.serial}` : ''}</div>
        <button type="button" className="btn small ghost" onClick={onClose}>Fermer</button>
      </div>
      <div className="det">
        <ObjectStage release={release} format={format} phantom={phantom} grade={copy?.grade} />
        <div className="stack">
          <div><h2>{release.title}</h2><div className="muted">{release.artist}</div></div>
          <div className="row">
            <Tier t={copy?.tier ?? release.tiers?.[format] ?? 1} />
            {phantom && <GhostTag />}
            {copy && <span className="tag">{GRADES[copy.grade].long}</span>}
          </div>
          <dl className="kv">
            <dt>Année</dt><dd>{release.year || '–'}</dd>
            <dt>Label</dt><dd>{cv?.label || release.label || '–'}{cv?.catno ? ` · ${cv.catno}` : ''}{cv?.country ? ` · ${cv.country}` : ''}</dd>
            <dt>Styles</dt><dd>{[...(release.genres || []), ...(release.styles || [])].join(', ') || '–'}</dd>
            {copy && <><dt>Valeur de jeu</dt><dd className="mono">{fmtNum(points(copy))} points</dd></>}
            {owner && <><dt>Trouvé par</dt><dd>{owner}</dd></>}
            <dt>Discogs</dt><dd>{fmtNum(release.have)} l&apos;ont, {fmtNum(release.want)} le veulent</dd>
            <dt>Prix plancher</dt><dd>{fmtEur(release.lowest_price)} <span className="muted">(toutes éditions, {fmtNum(release.for_sale)} en vente)</span></dd>
            <dt>Éditions</dt>
            <dd className="row" style={{ gap: 4 }}>
              {FORMATS.map(f => <span key={f} className={`fx t${release.tiers?.[f] ?? 1} ${release.fmt_counts?.[f] ? '' : 'ph'}`}>{FMT[f]} · {release.fmt_counts?.[f] ? fmtNum(release.fmt_counts[f]!) : 'fantôme'}</span>)}
            </dd>
          </dl>
          {phantom
            ? <p className="muted small" style={{ margin: 0 }}>Ce {FMT_LONG[format].toLowerCase()} n&apos;a jamais été édité. Il n&apos;existe que dans Carton Plein, avec la pochette originale de l&apos;album.</p>
            : <p className="muted small" style={{ margin: 0 }}>Pochette de l&apos;édition {FMT_LONG[format].toLowerCase()} la plus collectionnée sur Discogs.</p>}
          <div className="row">
            <a className="btn small" href={editionUrl} target="_blank" rel="noopener noreferrer">Voir sur Discogs ↗</a>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

export function TierBar({ byTier, total }: { byTier: number[]; total: number }) {
  return (
    <div className="tierbar" role="img" aria-label="Répartition par rareté">
      {[1, 2, 3, 4, 5].map(t => byTier[t] ? <i key={t} style={{ width: `${(byTier[t] / total) * 100}%`, background: `var(--t${t})` }} title={`${TIERS[t]?.n} : ${byTier[t]}`} /> : null)}
    </div>
  );
}

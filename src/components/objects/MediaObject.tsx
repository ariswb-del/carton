'use client';

import { useState, type CSSProperties } from 'react';
import { coverFor, FMT_LONG, hash } from '@/lib/game';
import type { Fmt, Grade, Release } from '@/lib/types';

const LABEL_COLORS = ['#C8102E', '#1D4E89', '#F2C14E', '#2A9D8F', '#E76F51', '#5E548E', '#F4F1DE', '#111111', '#E9C46A', '#6A994E'];
const SHELLS = ['#1E1E1E', '#E8E4DA', '#2F4A6D', '#7A1F1F', '#C9C9C9', '#3D3D3D'];

export type MediaProps = {
  release: Release;
  format: Fmt;
  phantom?: boolean;
  grade?: Grade;
  open?: boolean;
  flipped?: boolean;
  size?: 'card' | 'stage';
};

/** Pochette réelle chargée directement depuis Discogs ; repli typographique si l'image manque. */
function Cover({ src, release, kind = 'front' }: { src?: string | null; release: Release; kind?: 'front' | 'back' }) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="cover-img" src={src} alt={kind === 'front' ? `Pochette de ${release.title}, ${release.artist}` : `Verso de ${release.title}`}
        loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} />
    );
  }
  const bg = LABEL_COLORS[hash(release.master_id) % LABEL_COLORS.length];
  return (
    <div className={`cover-fallback ${kind}`} style={{ '--fb': bg } as CSSProperties}>
      {kind === 'front' ? <><b>{release.title}</b><span>{release.artist}</span></> : <><span>{release.artist}</span><b>{release.title}</b><i>{release.label} · {release.year}</i></>}
    </div>
  );
}

function Wear({ grade }: { grade?: Grade }) {
  if (!grade || grade === 'M' || grade === 'NM') return null;
  return <div className={`wear wear-${grade.replace('+', 'p')}`} aria-hidden="true" />;
}

function Phantom({ on }: { on?: boolean }) {
  if (!on) return null;
  return <><div className="holo" aria-hidden="true" /><div className="ghost-stamp" aria-hidden="true">Pressage fantôme</div></>;
}

function Vinyl({ release, phantom, grade, open, flipped }: MediaProps) {
  const cv = coverFor(release, 'v');
  const lbl = LABEL_COLORS[hash('l' + release.master_id) % LABEL_COLORS.length];
  return (
    <div className={`obj vin ${open ? 'is-open' : ''}`}>
      <div className="vin-disc" aria-hidden="true">
        <div className="vin-label" style={{ '--lbl': lbl } as CSSProperties}>
          <span>{release.artist}</span><b>{release.title}</b><i>33⅓</i>
        </div>
      </div>
      <div className={`vin-sleeve ${flipped ? 'is-flipped' : ''}`}>
        <div className="face front"><Cover src={cv.cover} release={release} /><Wear grade={grade} /><div className="sheen" /></div>
        <div className="face back"><Cover src={cv.back} release={release} kind="back" /><Wear grade={grade} /></div>
        <Phantom on={phantom} />
      </div>
    </div>
  );
}

function CD({ release, phantom, grade, open, flipped }: MediaProps) {
  const cv = coverFor(release, 'c');
  return (
    <div className={`obj cd ${open ? 'is-open' : ''} ${flipped ? 'is-flipped' : ''}`}>
      <div className="cd-tray" aria-hidden="true">
        <div className="cd-disc"><Cover src={cv.cover} release={release} /><div className="cd-rainbow" /><div className="cd-hub" /></div>
      </div>
      <div className="cd-lid">
        <div className="face front">
          <div className="cd-booklet"><Cover src={cv.cover} release={release} /></div>
          <div className="cd-hinge" /><Wear grade={grade} /><div className="gloss" />
        </div>
        <div className="face inner">
          <div className="cd-booklet inside"><b>{release.title}</b><span>{release.artist}</span><i>{cv.label || release.label}{cv.catno ? ` · ${cv.catno}` : ''}</i></div>
        </div>
      </div>
      <div className="cd-backcard" aria-hidden={!flipped}>
        <Cover src={cv.back} release={release} kind="back" /><div className="gloss" />
      </div>
      <Phantom on={phantom} />
    </div>
  );
}

function Cassette({ release, phantom, grade, open, flipped }: MediaProps) {
  const cv = coverFor(release, 'k');
  const shell = SHELLS[hash('k' + release.master_id) % SHELLS.length];
  const light = shell === '#E8E4DA' || shell === '#C9C9C9';
  const lbl = LABEL_COLORS[hash('lk' + release.master_id) % LABEL_COLORS.length];
  return (
    <div className={`obj k7 ${open ? 'is-open' : ''} ${flipped ? 'is-flipped' : ''}`}>
      <div className="k7-base" aria-hidden="true">
        <svg className="k7-shell" viewBox="0 0 200 128">
          <rect x="2" y="2" width="196" height="124" rx="9" fill={shell} />
          <rect x="13" y="11" width="174" height="74" rx="4" fill="#F4F1E8" />
          <rect x="13" y="11" width="174" height="12" rx="4" fill={lbl} />
          <text x="20" y="38" fontFamily="var(--f-title)" fontWeight="900" fontSize="13" fill="#1A1A1A">{release.title.slice(0, 24).toUpperCase()}</text>
          <text x="20" y="50" fontFamily="var(--f-mono)" fontSize="8" fill="#333">{release.artist.slice(0, 34)}</text>
          <text x="180" y="20" textAnchor="end" fontFamily="var(--f-mono)" fontSize="8" fontWeight="600" fill="#FFF">A</text>
          <rect x="52" y="58" width="96" height="24" rx="12" fill="#141414" />
          <circle cx="72" cy="70" r="9" fill="#EDEDED" /><circle cx="128" cy="70" r="9" fill="#EDEDED" />
          <circle cx="72" cy="70" r="3" fill="#141414" /><circle cx="128" cy="70" r="3" fill="#141414" />
          <rect x="86" y="63" width="28" height="14" fill="#5B3A1E" opacity=".75" />
          <path d="M44 126 L54 98 H146 L156 126Z" fill={light ? '#BDB8AC' : '#111'} opacity=".8" />
          <circle cx="9" cy="9" r="2" fill="#777" /><circle cx="191" cy="9" r="2" fill="#777" /><circle cx="9" cy="119" r="2" fill="#777" /><circle cx="191" cy="119" r="2" fill="#777" />
        </svg>
      </div>
      <div className="k7-lid">
        <div className="face front">
          <div className="k7-jcard"><Cover src={cv.cover} release={release} /></div>
          <div className="k7-spine"><span>{release.artist} · {release.title}</span></div>
          <Wear grade={grade} /><div className="gloss" />
        </div>
        <div className="face inner"><div className="k7-inside" /></div>
      </div>
      <div className="k7-backcard" aria-hidden={!flipped}>
        <Cover src={cv.back} release={release} kind="back" /><div className="gloss" />
      </div>
      <Phantom on={phantom} />
    </div>
  );
}

function EightTrack({ release, phantom, grade, flipped }: MediaProps) {
  const cv = coverFor(release, 'e');
  const shell = ['#1B1B1B', '#2E2E2E', '#4A3423'][hash('e' + release.master_id) % 3];
  return (
    <div className={`obj eight ${flipped ? 'is-flipped' : ''}`}>
      <div className="eight-body" style={{ '--shell': shell } as CSSProperties}>
        <div className="eight-head" aria-hidden="true"><i /><i /></div>
        <div className="eight-label">
          <div className="face front"><Cover src={cv.cover} release={release} /><div className="eight-band"><span>8-TRACK STEREO</span><b>{release.title}</b></div></div>
          <div className="face back"><Cover src={cv.back} release={release} kind="back" /></div>
        </div>
        <Wear grade={grade} /><div className="gloss" />
      </div>
      <Phantom on={phantom} />
    </div>
  );
}

export default function MediaObject(props: MediaProps) {
  const { format, size = 'card', release } = props;
  const Comp = { v: Vinyl, c: CD, k: Cassette, e: EightTrack }[format];
  return (
    <div className={`media media-${format} media-${size}`} role="img" aria-label={`${FMT_LONG[format]} : ${release.title}, ${release.artist}`}>
      <Comp {...props} />
    </div>
  );
}

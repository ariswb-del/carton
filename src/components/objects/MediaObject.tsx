'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { FMT_LONG, hash } from '@/lib/game';
import { TEXTURES } from '@/lib/textures';
import type { Fmt, Grade, Release } from '@/lib/types';

/* Objets en vraie 3D CSS : chaque objet est une ou plusieurs boîtes à 6 faces,
   dimensionnées en cqw (1 cqw = 1 % de la largeur du cadre carré qui les contient).
   La pochette Discogs est une simple <img> sur la face avant : aucune copie, aucun traitement. */

const LABEL_COLORS = ['#C8102E', '#1D4E89', '#F2C14E', '#2A9D8F', '#E76F51', '#5E548E', '#F4F1DE', '#111111', '#E9C46A', '#6A994E'];
const SHELLS = ['#1E1E1E', '#E8E4DA', '#2F4A6D', '#7A1F1F', '#C9C9C9', '#3D3D3D'];
const u = (n: number) => `${n}cqw`;

export type Pose = { x: number; y: number };
export type MediaProps = {
  release: Release;
  format: Fmt;
  phantom?: boolean;
  grade?: Grade;
  open?: boolean;
  pose?: Pose;          // rotation de l'objet ; par défaut, un léger trois-quarts
  animate?: boolean;    // transition douce sur la rotation (désactivée pendant un glisser)
};

type Faces = Partial<Record<'front' | 'back' | 'left' | 'right' | 'top' | 'bottom', ReactNode>>;

/** Boîte 3D centrée sur l'origine de son parent. */
function Box({ w, h, d, faces, className = '' }: { w: number; h: number; d: number; faces: Faces; className?: string }) {
  const face = (name: keyof Faces, fw: number, fh: number, tr: string) =>
    faces[name] === undefined ? null : (
      <div className={`face f-${name}`} style={{ width: u(fw), height: u(fh), marginLeft: u(-fw / 2), marginTop: u(-fh / 2), transform: tr }}>
        {faces[name]}
      </div>
    );
  return (
    <div className={`box ${className}`}>
      {face('front', w, h, `translateZ(${u(d / 2)})`)}
      {face('back', w, h, `rotateY(180deg) translateZ(${u(d / 2)})`)}
      {face('right', d, h, `rotateY(90deg) translateZ(${u(w / 2)})`)}
      {face('left', d, h, `rotateY(-90deg) translateZ(${u(w / 2)})`)}
      {face('top', w, d, `rotateX(90deg) translateZ(${u(h / 2)})`)}
      {face('bottom', w, d, `rotateX(-90deg) translateZ(${u(h / 2)})`)}
    </div>
  );
}

/** Une pièce positionnée dans l'espace de l'objet. */
const Part = ({ t, children, className = '' }: { t: string; children: ReactNode; className?: string }) =>
  <div className={`part ${className}`} style={{ transform: t }}>{children}</div>;

/** Pochette réelle depuis Discogs ; repli typographique si absente ou indisponible. */
function Cover({ release, crop }: { release: Release; crop?: 'circle' }) {
  const src = release.covers?.main?.cover || release.covers?.v?.cover || release.covers?.c?.cover;
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`cover-img ${crop ?? ''}`} src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} />;
  }
  const bg = LABEL_COLORS[hash(release.master_id) % LABEL_COLORS.length];
  return (
    <div className={`cover-fallback ${crop ?? ''}`} style={{ '--fb': bg } as CSSProperties}>
      <b>{release.title}</b><span>{release.artist}</span>
    </div>
  );
}

/** Dos imprimé : texte, label, année, code-barres décoratif. */
function BackPrint({ release, dark }: { release: Release; dark?: boolean }) {
  const bars = Array.from({ length: 28 }, (_, i) => 1 + (hash(`${release.master_id}-${i}`) % 3));
  return (
    <div className={`backprint ${dark ? 'dark' : ''}`}>
      <b>{release.title}</b>
      <span>{release.artist}</span>
      <i>{[release.label, release.year].filter(Boolean).join(' · ')}</i>
      <div className="barcode" aria-hidden="true">{bars.map((b, i) => <em key={i} style={{ width: `${b * 0.35}cqw` }} />)}</div>
    </div>
  );
}

const Spine = ({ release, dark }: { release: Release; dark?: boolean }) => (
  <div className={`spine ${dark ? 'dark' : ''}`}><span>{release.artist} · {release.title}</span></div>
);

const Plastic = () => <div className="plastic" />;
const Edge = ({ c }: { c: string }) => <div className="edge" style={{ background: c }} />;

function Overlays({ grade, phantom, kind }: { grade?: Grade; phantom?: boolean; kind: 'paper' | 'plastic' }) {
  return (
    <>
      {grade && grade !== 'M' && grade !== 'NM' && <div className={`wear wear-${kind} wear-${grade.replace('+', 'p')}`} aria-hidden="true" />}
      {phantom && <div className="holo" aria-hidden="true" />}
      {kind === 'plastic' && <div className="gloss" aria-hidden="true" />}
    </>
  );
}

/* ---------------- Vinyle : pochette 31 × 31 cm, disque qui sort par la droite ---------------- */
function Vinyl({ release, phantom, grade, open }: MediaProps) {
  const S = 62, D = 1.4, X = -7;
  const label = LABEL_COLORS[hash('l' + release.master_id) % LABEL_COLORS.length];
  return (
    <>
      <Part t={`translate3d(${u(X)},0,0)`}>
        <Box w={S} h={S} d={D} faces={{
          front: <><Cover release={release} /><Overlays grade={grade} phantom={phantom} kind="paper" /></>,
          back: <><BackPrint release={release} /><Overlays grade={grade} kind="paper" /></>,
          left: <Spine release={release} />,
          top: <Edge c="#D9D2C3" />, bottom: <Edge c="#CFC7B6" />,
        }} />
      </Part>
      <Part className="vin-disc-part" t={`translate3d(${u(X + (open ? 40 : 13))},0,0) rotateZ(${open ? 200 : 0}deg)`}>
        <div className="vin-disc" style={{ width: u(S - 3), height: u(S - 3), marginLeft: u(-(S - 3) / 2), marginTop: u(-(S - 3) / 2), '--lbl': label } as CSSProperties}>
          {TEXTURES.vinylDisc
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="tex" src={TEXTURES.vinylDisc} alt="" draggable={false} />
            : <div className="grooves" />}
          <div className="vin-label"><Cover release={release} crop="circle" /></div>
          <div className="vin-hole" />
        </div>
      </Part>
    </>
  );
}

/* ---------------- CD : boîtier cristal 142 × 125 × 10 mm, couvercle à charnière ---------------- */
function CD({ release, phantom, grade, open }: MediaProps) {
  const W = 66, H = 58, DB = 5.2, DL = 1.4;
  const clear = <Plastic />;
  return (
    <>
      <Part t={`translate3d(0,0,${u(-DL / 2)})`}>
        <Box w={W} h={H} d={DB} faces={{
          front: <div className="cd-tray">
            {TEXTURES.cdTray
              // eslint-disable-next-line @next/next/no-img-element
              ? <img className="tex" src={TEXTURES.cdTray} alt="" draggable={false} />
              : <div className="cd-disc"><Cover release={release} crop="circle" /><div className="cd-rainbow" /><div className="cd-hub" /></div>}
          </div>,
          back: <><BackPrint release={release} /><Overlays grade={grade} kind="plastic" /></>,
          left: <Spine release={release} />, right: clear, top: clear, bottom: clear,
        }} />
      </Part>
      <Part className="hinge" t={`translate3d(${u(-W / 2)},0,${u(DB / 2)}) rotateY(${open ? -160 : 0}deg) translate3d(${u(W / 2)},0,0)`}>
        <Box w={W} h={H} d={DL} faces={{
          front: <div className="cd-front"><div className="cd-booklet"><Cover release={release} /></div><div className="cd-hinge-strip" /><Overlays grade={grade} phantom={phantom} kind="plastic" /></div>,
          back: <div className="cd-inside"><b>{release.title}</b><span>{release.artist}</span><i>{release.label}{release.year ? ` · ${release.year}` : ''}</i></div>,
          left: clear, right: clear, top: clear, bottom: clear,
        }} />
      </Part>
    </>
  );
}

/* ---------------- K7 : boîtier 70 × 109 × 17 mm, jaquette, cassette à l'intérieur ---------------- */
function CassetteShell({ release }: { release: Release }) {
  if (TEXTURES.k7Shell) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="tex k7-tex" src={TEXTURES.k7Shell} alt="" draggable={false} />;
  }
  const shell = SHELLS[hash('k' + release.master_id) % SHELLS.length];
  const light = shell === '#E8E4DA' || shell === '#C9C9C9';
  const lbl = LABEL_COLORS[hash('lk' + release.master_id) % LABEL_COLORS.length];
  return (
    <svg className="k7-shell" viewBox="0 0 200 128" aria-hidden="true">
      <rect x="2" y="2" width="196" height="124" rx="9" fill={shell} />
      <rect x="13" y="11" width="174" height="74" rx="4" fill="#F4F1E8" />
      <rect x="13" y="11" width="174" height="12" rx="4" fill={lbl} />
      <text x="20" y="38" fontFamily="var(--f-title)" fontWeight="900" fontSize="13" fill="#1A1A1A">{release.title.slice(0, 24).toUpperCase()}</text>
      <text x="20" y="50" fontFamily="var(--f-mono)" fontSize="8" fill="#333">{release.artist.slice(0, 34)}</text>
      <rect x="52" y="58" width="96" height="24" rx="12" fill="#141414" />
      <circle cx="72" cy="70" r="9" fill="#EDEDED" /><circle cx="128" cy="70" r="9" fill="#EDEDED" />
      <circle cx="72" cy="70" r="3" fill="#141414" /><circle cx="128" cy="70" r="3" fill="#141414" />
      <rect x="86" y="63" width="28" height="14" fill="#5B3A1E" opacity=".75" />
      <path d="M44 126 L54 98 H146 L156 126Z" fill={light ? '#BDB8AC' : '#111'} opacity=".8" />
    </svg>
  );
}

function Cassette({ release, phantom, grade, open }: MediaProps) {
  const W = 44, H = 68, DB = 8.4, DL = 2.2;
  const clear = <Plastic />;
  return (
    <>
      <Part t={`translate3d(0,0,${u(-DL / 2)})`}>
        <Box w={W} h={H} d={DB} faces={{
          front: <div className="k7-inside"><CassetteShell release={release} /></div>,
          back: <><div className="k7-backflap"><BackPrint release={release} /></div><Overlays grade={grade} kind="plastic" /></>,
          left: <Spine release={release} dark />, right: clear, top: clear, bottom: clear,
        }} />
      </Part>
      <Part className="hinge" t={`translate3d(${u(-W / 2)},0,${u(DB / 2)}) rotateY(${open ? -155 : 0}deg) translate3d(${u(W / 2)},0,0)`}>
        <Box w={W} h={H} d={DL} faces={{
          front: <div className="k7-jcard"><div className="k7-art"><Cover release={release} /></div><div className="k7-band"><b>{release.title}</b><span>{release.artist}</span></div><Overlays grade={grade} phantom={phantom} kind="plastic" /></div>,
          back: <div className="k7-lines" />,
          left: clear, right: clear, top: clear, bottom: clear,
        }} />
      </Part>
    </>
  );
}

/* ---------------- 8-track : cartouche 100 × 135 × 22 mm ---------------- */
function EightTrack({ release, phantom, grade }: MediaProps) {
  const W = 52, H = 70, D = 11.4;
  const shell = ['#1B1B1B', '#2E2E2E', '#4A3423'][hash('e' + release.master_id) % 3];
  const body = <div className="eight-plastic" style={{ background: shell }} />;
  return (
    <Part t="translate3d(0,0,0)">
      <Box w={W} h={H} d={D} faces={{
        front: <div className="eight-front" style={{ background: shell }}>
          {TEXTURES.eightBody
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="tex" src={TEXTURES.eightBody} alt="" draggable={false} />
            : <div className="eight-ribs" />}
          <div className="eight-label"><div className="eight-art"><Cover release={release} /></div><div className="eight-band"><span>STEREO 8</span><b>{release.title}</b></div></div>
          <Overlays grade={grade} phantom={phantom} kind="plastic" />
        </div>,
        back: <div className="eight-back" style={{ background: shell }}><BackPrint release={release} dark /></div>,
        top: <div className="eight-top"><i /><em /></div>,
        left: body, right: body, bottom: body,
      }} />
    </Part>
  );
}

export const DEFAULT_POSE: Record<Fmt, Pose> = { v: { x: -8, y: -22 }, c: { x: -8, y: -26 }, k: { x: -8, y: -28 }, e: { x: -10, y: -26 } };

export default function MediaObject(props: MediaProps) {
  const { format, release, pose, animate, open } = props;
  const p = pose ?? DEFAULT_POSE[format];
  const Comp = { v: Vinyl, c: CD, k: Cassette, e: EightTrack }[format];
  return (
    <div className={`media media-${format} ${open ? 'is-open' : ''}`} role="img" aria-label={`${FMT_LONG[format]} : ${release.title}, ${release.artist}`}>
      <div className="scene">
        <div className={`rig ${animate ? 'animate' : ''}`} style={{ transform: `rotateX(${p.x}deg) rotateY(${p.y}deg)` }}>
          <Comp {...props} />
        </div>
      </div>
    </div>
  );
}

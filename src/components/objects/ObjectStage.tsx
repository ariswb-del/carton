'use client';

import { useRef, useState } from 'react';
import MediaObject, { type MediaProps } from './MediaObject';

/** Vue « en main » : on fait pivoter l'objet au doigt ou à la souris, on l'ouvre, on le retourne. */
export default function ObjectStage(props: Omit<MediaProps, 'open' | 'flipped' | 'size'>) {
  const [open, setOpen] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [rot, setRot] = useState({ x: -6, y: 18 });
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const canOpen = props.format !== 'e';
  const openLabel = { v: open ? 'Rentrer le disque' : 'Sortir le disque', c: open ? 'Fermer le boîtier' : 'Ouvrir le boîtier', k: open ? 'Fermer le boîtier' : 'Ouvrir le boîtier', e: '' }[props.format];

  return (
    <div className="stage">
      <div
        className="stage-scene"
        onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY, rx: rot.x, ry: rot.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
        onPointerMove={e => {
          const d = drag.current; if (!d) return;
          setRot({ x: Math.max(-25, Math.min(25, d.rx - (e.clientY - d.y) * 0.25)), y: Math.max(-45, Math.min(45, d.ry + (e.clientX - d.x) * 0.35)) });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <div className="stage-rot" style={{ transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)` }}>
          <MediaObject {...props} size="stage" open={open} flipped={flipped} />
        </div>
      </div>
      <div className="row center">
        {canOpen && <button type="button" className="btn small" onClick={() => { setOpen(o => !o); setFlipped(false); }}>{openLabel}</button>}
        <button type="button" className="btn small ghost" onClick={() => { setFlipped(f => !f); setOpen(false); }}>{flipped ? 'Voir le recto' : 'Retourner'}</button>
      </div>
      <p className="hint">Fais glisser pour tourner l&apos;objet.</p>
    </div>
  );
}

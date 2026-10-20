'use client';

import { useRef, useState } from 'react';
import MediaObject, { DEFAULT_POSE, type MediaProps } from './MediaObject';
import { IS_3D, Viewer3D } from './Media3D';

/** L'objet « en main » : on le fait tourner librement au doigt ou à la souris, on l'ouvre, on le retourne. */
export default function ObjectStage(props: Omit<MediaProps, 'open' | 'pose' | 'animate'>) {
  if (IS_3D(props.format)) return <Viewer3D format={props.format} release={props.release} grade={props.grade} phantom={props.phantom} />;
  return <CssStage {...props} />;
}

function CssStage(props: Omit<MediaProps, 'open' | 'pose' | 'animate'>) {
  const home = DEFAULT_POSE[props.format];
  const [pose, setPose] = useState(home);
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const canOpen = props.format !== 'e';
  const openLabel = { v: open ? 'Rentrer le disque' : 'Sortir le disque', c: open ? 'Fermer le boîtier' : 'Ouvrir le boîtier', k: open ? 'Fermer le boîtier' : 'Ouvrir le boîtier', e: '' }[props.format];

  return (
    <div className="stage">
      <div
        className={`stage-scene ${dragging ? 'grabbing' : ''}`}
        onPointerDown={e => {
          drag.current = { x: e.clientX, y: e.clientY, px: pose.x, py: pose.y };
          setDragging(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          const d = drag.current; if (!d) return;
          setPose({ x: Math.max(-75, Math.min(75, d.px - (e.clientY - d.y) * 0.45)), y: d.py + (e.clientX - d.x) * 0.55 });
        }}
        onPointerUp={() => { drag.current = null; setDragging(false); }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        onDoubleClick={() => setPose(home)}
      >
        <MediaObject {...props} pose={pose} open={open} animate={!dragging} />
      </div>
      <div className="row center">
        {canOpen && <button type="button" className="btn small" onClick={() => { setOpen(o => !o); setPose(p => ({ x: home.x, y: Math.round((p.y - home.y) / 360) * 360 + home.y })); }}>{openLabel}</button>}
        <button type="button" className="btn small ghost" onClick={() => { setOpen(false); setPose(p => ({ ...p, y: p.y + 180 })); }}>Retourner</button>
        <button type="button" className="btn small ghost" onClick={() => { setOpen(false); setPose(home); }}>Recentrer</button>
      </div>
      <p className="hint">Fais glisser pour tourner l&apos;objet dans tous les sens.</p>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Grade, Release } from '@/lib/types';

/* Objets rendus en vraie 3D (Three.js) : 8-track et K7. Les autres formats restent en 3D CSS pour l'instant. */
export type Fmt3D = 'e' | 'k';
export const IS_3D = (f: string): f is Fmt3D => f === 'e' || f === 'k';

const POSE: Record<Fmt3D, { x: number; y: number }> = { e: { x: 12, y: 24 }, k: { x: 10, y: 28 } };
const key = (f: Fmt3D, r: Release, grade?: Grade, phantom?: boolean) =>
  `${f}|${r.master_id}|${grade ?? ''}|${phantom ? 1 : 0}|${r.covers?.main?.cover ?? ''}|${(r.tracklist ?? []).length}`;

async function builder(f: Fmt3D, r: Release, grade?: Grade, phantom?: boolean) {
  if (f === 'e') { const { buildEightTrack } = await import('@/lib/three/eightTrack'); return () => buildEightTrack(r, { grade, phantom }); }
  const { buildCassette } = await import('@/lib/three/cassette'); return () => buildCassette(r, { grade, phantom });
}

/** Vignette : rendu 3D figé ; en attendant (ou si la 3D est indisponible), la version dessinée. */
export function Snapshot3D({ format, release, grade, phantom, fallback }: { format: Fmt3D; release: Release; grade?: Grade; phantom?: boolean; fallback: ReactNode }) {
  const [src, setSrc] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver(async entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      const [{ snapshot }, build] = await Promise.all([import('@/lib/three/stage'), builder(format, release, grade, phantom)]);
      const url = await snapshot(key(format, release, grade, phantom), build, POSE[format]);
      if (alive && url) setSrc(url);
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => { alive = false; io.disconnect(); };
  }, [format, release, grade, phantom]);
  return (
    <div ref={holder} className="snap-holder">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img className="snap" src={src} alt="" draggable={false} /> : fallback}
    </div>
  );
}

/** Vue en main : on tourne l'objet au doigt, on l'ouvre (K7), on le retourne. */
export function Viewer3D({ format, release, grade, phantom }: { format: Fmt3D; release: Release; grade?: Grade; phantom?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<import('@/lib/three/stage').Viewer | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setState('loading'); setOpen(false);
    (async () => {
      try {
        const [{ mountViewer }, build] = await Promise.all([import('@/lib/three/stage'), builder(format, release, grade, phantom)]);
        if (!host.current || cancelled) return;
        const v = await mountViewer(host.current, build, POSE[format]);
        if (cancelled) { v.dispose(); return; }
        api.current = v; setState('ready');
      } catch { if (!cancelled) setState('error'); }
    })();
    return () => { cancelled = true; api.current?.dispose(); api.current = null; };
  }, [format, release, grade, phantom]);
  const label = format === 'e' ? 'la cartouche' : 'la cassette';
  return (
    <div className="stage">
      <div ref={host} className="gl-host">
        {state === 'loading' && <div className="gl-wait">Chargement de {label}…</div>}
        {state === 'error' && <div className="gl-wait">La 3D n&apos;est pas disponible sur cet appareil.</div>}
      </div>
      <div className="row center">
        {format === 'k' && <button type="button" className="btn small" disabled={state !== 'ready'} onClick={() => { api.current?.setOpen(!open); setOpen(o => !o); }}>{open ? 'Fermer le boîtier' : 'Ouvrir le boîtier'}</button>}
        <button type="button" className="btn small ghost" onClick={() => api.current?.flip()} disabled={state !== 'ready'}>Retourner</button>
        <button type="button" className="btn small ghost" onClick={() => api.current?.reset()} disabled={state !== 'ready'}>Recentrer</button>
      </div>
      <p className="hint">Fais glisser pour tourner {label}, pince ou molette pour zoomer.</p>
    </div>
  );
}

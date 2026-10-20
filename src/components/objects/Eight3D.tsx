'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Grade, Release } from '@/lib/types';

const POSE = { x: 12, y: 24 };
const key = (r: Release, grade?: Grade, phantom?: boolean) => `e|${r.master_id}|${grade ?? ''}|${phantom ? 1 : 0}|${r.covers?.main?.cover ?? ''}`;

/** Vignette : rendu 3D figé de la cartouche ; en attendant (ou si la 3D est indisponible), la version dessinée. */
export function EightSnapshot({ release, grade, phantom, fallback }: { release: Release; grade?: Grade; phantom?: boolean; fallback: ReactNode }) {
  const [src, setSrc] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    const el = holder.current;
    if (!el) return;
    // Ne calcule la vignette que lorsqu'elle approche de l'écran
    const io = new IntersectionObserver(async entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      io.disconnect();
      const [{ snapshot }, { buildEightTrack }] = await Promise.all([import('@/lib/three/stage'), import('@/lib/three/eightTrack')]);
      const url = await snapshot(key(release, grade, phantom), () => buildEightTrack(release, { grade, phantom }), POSE);
      if (alive && url) setSrc(url);
    }, { rootMargin: '300px' });
    io.observe(el);
    return () => { alive = false; io.disconnect(); };
  }, [release, grade, phantom]);
  return (
    <div ref={holder} className="snap-holder">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img className="snap" src={src} alt="" draggable={false} /> : fallback}
    </div>
  );
}

/** Vue en main : on tourne la cartouche au doigt, on la retourne. */
export function EightViewer({ release, grade, phantom }: { release: Release; grade?: Grade; phantom?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ flip: () => void; reset: () => void; dispose: () => void } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ mountViewer }, { buildEightTrack }] = await Promise.all([import('@/lib/three/stage'), import('@/lib/three/eightTrack')]);
        if (!host.current || cancelled) return;
        const v = await mountViewer(host.current, () => buildEightTrack(release, { grade, phantom }), POSE);
        if (cancelled) { v.dispose(); return; }
        api.current = v; setState('ready');
      } catch { if (!cancelled) setState('error'); }
    })();
    return () => { cancelled = true; api.current?.dispose(); api.current = null; };
  }, [release, grade, phantom]);
  return (
    <div className="stage">
      <div ref={host} className="gl-host">{state === 'loading' && <div className="gl-wait">Chargement de la cartouche…</div>}{state === 'error' && <div className="gl-wait">La 3D n&apos;est pas disponible sur cet appareil.</div>}</div>
      <div className="row center">
        <button type="button" className="btn small ghost" onClick={() => api.current?.flip()} disabled={state !== 'ready'}>Retourner</button>
        <button type="button" className="btn small ghost" onClick={() => api.current?.reset()} disabled={state !== 'ready'}>Recentrer</button>
      </div>
      <p className="hint">Fais glisser pour tourner la cartouche, pince ou molette pour zoomer.</p>
    </div>
  );
}

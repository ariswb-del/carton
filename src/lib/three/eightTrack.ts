import * as THREE from 'three';
import { TEXTURES, type Rect } from '@/lib/textures';
import type { Grade, Release } from '@/lib/types';
import { hash } from '@/lib/game';
import { EIGHT_OUTLINE } from './eightOutline';

/* Cartouche 8-track en vraie 3D, cotes réelles en millimètres (100 × 135 × 22).
   Silhouette d'après la photo de façade : coins arrondis, encoche en U du galet presseur en haut à droite. */

export const W = 100, H = 134, D = 22;
const NOTCH: [number, number, number] = [0.712, 0.832, 4.2]; // encoche du galet : début et fin en % de la largeur, profondeur en mm
const PLASTIC = '#4A4D4B';

/** Contour : silhouette détourée de la photo, avec l'encoche en U du galet creusée dans le bord supérieur. */
function contour(): [number, number][] {
  const n0 = NOTCH[0], n1 = NOTCH[1], depth = NOTCH[2] / H, top = 0.97;
  const pts = EIGHT_OUTLINE, out: [number, number][] = [];
  let done = false;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const skip = done && p[1] > top && p[0] > n0 && p[0] < n1;
    if (!skip) out.push(p);
    // le bord supérieur se parcourt de droite à gauche : à la traversée de n1, on creuse le U jusqu'à n0
    if (!done && p[1] > top && q[1] > top && p[0] >= n1 && q[0] < n1) {
      const yTop = Math.max(p[1], q[1]);
      out.push([n1, yTop]);
      for (let k = 1; k < 14; k++) {
        const t = k / 14;
        out.push([n1 - (n1 - n0) * t, yTop - depth * Math.sin(Math.PI * t)]);
      }
      out.push([n0, yTop]);
      done = true;
    }
  }
  return out;
}

type PathLike = { moveTo(x: number, y: number): void; lineTo(x: number, y: number): void };
let CONTOUR: [number, number][] | null = null;

/** Trace la silhouette, centrée sur l'origine (x vers la droite, y vers le haut), avec échelle et décalage. */
function outline(path: PathLike, sx = 1, sy = 1, ox = 0, oy = 0) {
  CONTOUR ??= contour();
  CONTOUR.forEach(([x, y], i) => {
    const px = ox + (x - 0.5) * W * sx, py = oy + (y - 0.5) * H * sy;
    if (i === 0) path.moveTo(px, py); else path.lineTo(px, py);
  });
}

/** Largeur du plat de la tranche du bas (pour l'étiquette de rangement). */
function bottomFlat() {
  const low = EIGHT_OUTLINE.filter(([, y]) => y < 0.004).map(([x]) => x);
  return low.length >= 2 ? { x0: Math.min(...low), x1: Math.max(...low) } : { x0: 0.08, x1: 0.92 };
}

export const loadImage = (src: string) => new Promise<HTMLImageElement | null>(res => {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => res(im);
  im.onerror = () => res(null);
  im.src = src;
});

export const proxied = (url?: string | null) => (url ? `/api/cover?u=${encodeURIComponent(url)}` : null);

function rectPx([l, t, r, b]: Rect, w: number, h: number) {
  return { x: (l / 100) * w, y: (t / 100) * h, w: ((r - l) / 100) * w, h: ((b - t) / 100) * h };
}

export function coverOrFallback(ctx: CanvasRenderingContext2D, cover: HTMLImageElement | null, release: Release, x: number, y: number, w: number, h: number) {
  if (cover) {
    const s = Math.max(w / cover.width, h / cover.height);
    const cw = w / s, ch = h / s;
    ctx.drawImage(cover, (cover.width - cw) / 2, (cover.height - ch) / 2, cw, ch, x, y, w, h);
  } else {
    const hues = ['#C8102E', '#1D4E89', '#2A9D8F', '#E76F51', '#5E548E', '#6A994E'];
    ctx.fillStyle = hues[hash(release.master_id) % hues.length];
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${Math.round(w * 0.09)}px "Big Shoulders Display", Impact, sans-serif`;
    ctx.fillText(release.title.toUpperCase().slice(0, 22), x + w * 0.06, y + h * 0.88, w * 0.88);
  }
}

export function scratches(ctx: CanvasRenderingContext2D, grade: Grade | undefined, seed: number, x: number, y: number, w: number, h: number) {
  const n = grade === 'G+' ? 46 : grade === 'VG' ? 20 : grade === 'VG+' ? 7 : 0;
  let s = seed || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${0.08 + rnd() * 0.22})`;
    ctx.lineWidth = 0.6 + rnd() * 1.6;
    const sx = x + rnd() * w, sy = y + rnd() * h, len = 20 + rnd() * w * 0.4, a = rnd() * Math.PI;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len); ctx.stroke();
  }
  if (grade === 'G+') { ctx.fillStyle = 'rgba(190,160,90,.12)'; ctx.fillRect(x, y, w, h); }
  ctx.restore();
}

function clipToSilhouette(ctx: CanvasRenderingContext2D, cw: number, ch: number, mirror: boolean) {
  const sx = (cw / W) * (mirror ? -1 : 1), sy = -(ch / H);
  ctx.beginPath();
  outline(ctx, sx, sy, cw / 2, ch / 2);
  ctx.closePath();
  ctx.clip();
}

async function faceTexture(kind: 'front' | 'back', release: Release, grade: Grade | undefined, cover: HTMLImageElement | null) {
  const photoSrc = kind === 'front' ? TEXTURES.eightFront : TEXTURES.eightBack;
  const photo = photoSrc ? await loadImage(photoSrc) : null;
  const cw = 1024, ch = Math.round((1024 * H) / W);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const ctx = c.getContext('2d')!;
  ctx.save();
  clipToSilhouette(ctx, cw, ch, kind === 'back');
  ctx.fillStyle = PLASTIC; ctx.fillRect(0, 0, cw, ch);
  if (photo) ctx.drawImage(photo, 0, 0, cw, ch);
  const rect = rectPx(kind === 'front' ? TEXTURES.eightFrontLabel : TEXTURES.eightBackLabel, cw, ch);

  if (kind === 'front') {
    // étiquette : pochette + bandeau titre
    const band = rect.h * 0.14;
    ctx.fillStyle = '#F2EFE6'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    coverOrFallback(ctx, cover, release, rect.x, rect.y, rect.w, rect.h - band);
    ctx.fillStyle = '#141414'; ctx.fillRect(rect.x, rect.y + rect.h - band, rect.w, band);
    ctx.fillStyle = '#FFD21F'; ctx.font = `600 ${Math.round(band * 0.24)}px "IBM Plex Mono", monospace`;
    ctx.fillText('STEREO 8', rect.x + band * 0.3, rect.y + rect.h - band * 0.62);
    ctx.fillStyle = '#F2F2F2'; ctx.font = `900 ${Math.round(band * 0.42)}px "Big Shoulders Display", Impact, sans-serif`;
    ctx.fillText(release.title.toUpperCase(), rect.x + band * 0.3, rect.y + rect.h - band * 0.18, rect.w - band * 0.6);
    scratches(ctx, grade, release.master_id, rect.x, rect.y, rect.w, rect.h);
  } else {
    // étiquette de dos générée : elle recouvre entièrement celle de la photo
    ctx.fillStyle = '#F2EEE4'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    const p = rect.w * 0.07;
    ctx.fillStyle = '#1F1F1F'; ctx.font = `900 ${Math.round(rect.w * 0.085)}px "Big Shoulders Display", Impact, sans-serif`;
    ctx.fillText(release.title.toUpperCase(), rect.x + p, rect.y + p + rect.w * 0.07, rect.w - 2 * p);
    ctx.font = `${Math.round(rect.w * 0.045)}px "IBM Plex Mono", monospace`;
    ctx.fillText(release.artist, rect.x + p, rect.y + p + rect.w * 0.15, rect.w - 2 * p);
    ctx.globalAlpha = 0.7;
    ctx.fillText([release.label, release.year].filter(Boolean).join(' · '), rect.x + p, rect.y + p + rect.w * 0.22, rect.w - 2 * p);
    ctx.globalAlpha = 1;
    // code-barres décoratif
    const bx = rect.x + rect.w - p - rect.w * 0.34, by = rect.y + rect.h - p - rect.w * 0.12;
    ctx.fillStyle = '#fff'; ctx.fillRect(bx - 6, by - 6, rect.w * 0.34 + 12, rect.w * 0.12 + 12);
    let cx = bx;
    for (let i = 0; cx < bx + rect.w * 0.34; i++) {
      const bw = 1.5 + (hash(`${release.master_id}-${i}`) % 3) * 1.6;
      if (i % 2 === 0) { ctx.fillStyle = '#111'; ctx.fillRect(cx, by, bw, rect.w * 0.12); }
      cx += bw;
    }
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

async function edgeTexture(release: Release) {
  const photo = TEXTURES.eightEdge ? await loadImage(TEXTURES.eightEdge) : null;
  const cw = 1024, ch = Math.round((1024 * D) / W);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = PLASTIC; ctx.fillRect(0, 0, cw, ch);
  if (photo) ctx.drawImage(photo, 0, 0, cw, ch);
  const r = rectPx(TEXTURES.eightEdgeLabel, cw, ch);
  ctx.fillStyle = '#F2EEE4'; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `900 ${Math.round(r.h * 0.5)}px "Big Shoulders Display", Impact, sans-serif`;
  ctx.fillText(release.title.toUpperCase(), r.x + r.h * 0.4, r.y + r.h * 0.68, r.w * 0.6);
  ctx.font = `${Math.round(r.h * 0.3)}px "IBM Plex Mono", monospace`;
  ctx.fillText(release.artist, r.x + r.w * 0.66, r.y + r.h * 0.64, r.w * 0.32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function buildEightTrack(release: Release, opts: { grade?: Grade; phantom?: boolean }) {
  if (typeof document !== 'undefined' && document.fonts) { try { await document.fonts.ready; } catch { /* sans gravité */ } }
  const cover = await loadImage(proxied(release.covers?.main?.cover) ?? '');
  const [front, back, edge] = await Promise.all([faceTexture('front', release, opts.grade, cover), faceTexture('back', release, opts.grade, cover), edgeTexture(release)]);

  const g = new THREE.Group();
  const plastic = new THREE.MeshStandardMaterial({ color: PLASTIC, roughness: 0.55, metalness: 0.05 });

  // Corps : silhouette extrudée, arêtes arrondies
  const shape = new THREE.Shape();
  outline(shape);
  const bevel = 0.9;
  const body = new THREE.ExtrudeGeometry(shape, { depth: D - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 10 });
  body.translate(0, 0, -(D - 2 * bevel) / 2);
  g.add(new THREE.Mesh(body, plastic));

  // Façade et dos : photos + étiquettes, découpées à la silhouette
  const faceGeo = new THREE.PlaneGeometry(W, H);
  const faceMat = (map: THREE.Texture) => new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.5, roughness: 0.6, metalness: 0.03 });
  const fm = new THREE.Mesh(faceGeo, faceMat(front)); fm.position.z = D / 2 + 0.06; g.add(fm);
  const bm = new THREE.Mesh(faceGeo, faceMat(back)); bm.position.z = -(D / 2 + 0.06); bm.rotation.y = Math.PI; g.add(bm);

  // Pressage fantôme : reflet irisé sur l'étiquette
  if (opts.phantom) {
    const r = TEXTURES.eightFrontLabel;
    const lw = ((r[2] - r[0]) / 100) * W, lh = ((r[3] - r[1]) / 100) * H;
    const holo = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, roughness: 0.15, metalness: 0.9, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 900] }));
    holo.position.set(-W / 2 + ((r[0] + r[2]) / 200) * W, H / 2 - ((r[1] + r[3]) / 200) * H, D / 2 + 0.12);
    g.add(holo);
  }

  // Tranche du bas : étiquette de rangement
  const bf = bottomFlat();
  const em = new THREE.Mesh(new THREE.PlaneGeometry((bf.x1 - bf.x0) * W * 0.96, D - 2 * bevel), new THREE.MeshStandardMaterial({ map: edge, roughness: 0.6 }));
  em.rotation.x = Math.PI / 2; em.position.set(((bf.x0 + bf.x1) / 2 - 0.5) * W, -H / 2 - 0.06, 0); g.add(em);

  // Fente de lecture en haut : bande magnétique visible
  const slot = new THREE.Mesh(new THREE.BoxGeometry(56, 0.5, D - 7), new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 }));
  slot.position.set(-12, H / 2 + 0.02, 0); g.add(slot);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(52, 0.3, 6.3), new THREE.MeshStandardMaterial({ color: '#4A2E1A', roughness: 0.35, metalness: 0.2 }));
  tape.position.set(-12, H / 2 + 0.3, 1.5); g.add(tape);

  // Galet presseur en caoutchouc, visible dans l'encoche
  const nx = -W / 2 + ((NOTCH[0] + NOTCH[1]) / 2) * W;
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.4, D - 4, 32), new THREE.MeshStandardMaterial({ color: '#0E0E0E', roughness: 0.92 }));
  roller.rotation.x = Math.PI / 2; roller.position.set(nx, H / 2 - NOTCH[2] - 2.2, 0); g.add(roller);

  // Rainures de préhension sur les flancs, en bas
  const rib = new THREE.BoxGeometry(0.9, 1.1, D - 5);
  const sideAt = (yn: number, side: 'l' | 'r') => {
    const xs = CONTOUR!.filter(([, y]) => Math.abs(y - yn) < 0.02).map(([x]) => x);
    if (!xs.length) return side === 'l' ? 0 : 1;
    return side === 'l' ? Math.min(...xs) : Math.max(...xs);
  };
  for (let i = 0; i < 9; i++) {
    const y = -H / 2 + 9 + i * 2.3, yn = y / H + 0.5;
    for (const side of ['l', 'r'] as const) {
      const m = new THREE.Mesh(rib, plastic);
      m.position.set((sideAt(yn, side) - 0.5) * W + (side === 'l' ? -0.35 : 0.35), y, 0);
      g.add(m);
    }
  }

  g.userData.dispose = () => {
    g.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.MeshStandardMaterial | undefined;
      if (mat) { mat.map?.dispose(); mat.dispose(); }
    });
  };
  return g;
}

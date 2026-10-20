import * as THREE from 'three';
import { TEXTURES } from '@/lib/textures';
import type { Grade, Release } from '@/lib/types';
import { hash } from '@/lib/game';
import { coverOrFallback, loadImage, proxied, scratches } from './eightTrack';

/* K7 en vraie 3D, cotes réelles en millimètres.
   - Cassette : 100,4 × 63,8 × 12, photo redressée et nettoyée + étiquette imprimée face A / face B.
   - Boîtier cristal (Norelco) : 69 × 110 × 17, couvercle à charnière côté tranche.
   - Jaquette : face avant (pochette + bloc texte), tranche, rabat arrière avec la liste des titres. */

const CW = 100.4, CH = 63.8, CD = 12, CR = 3.2;   // cassette
const BW = 69, BH = 110, BD = 17;                  // boîtier
const LID = 4.2;                                   // épaisseur du couvercle
const INKS = ['#1F4FA8', '#B3261E', '#1A1A1A', '#2E6B3A', '#7A2C8F', '#0E6E7A'];
const SHELL = '#EEE8DA';

// Zones d'impression sur la photo de la cassette (en % de l'image), d'après la mise en page d'une vraie K7
const ZONE = { top: [4, 10, 96, 30], left: [2.5, 41, 17.5, 52], right: [83, 41, 97.5, 52], bottom: [22, 57, 78, 76] } as const;

const catNo = (r: Release) => `CPK-${String(r.master_id % 100000).padStart(5, '0')}`;
const ink = (r: Release) => INKS[hash('ink' + r.master_id) % INKS.length];

function sides(r: Release) {
  const tracks = (r.tracklist ?? []).map(t => t.t);
  const byPos = { a: (r.tracklist ?? []).filter(t => /^[A1]/i.test(t.p) && !/^1\d/.test(t.p)).map(t => t.t), b: (r.tracklist ?? []).filter(t => /^[B2]/i.test(t.p)).map(t => t.t) };
  if (byPos.a.length && byPos.b.length) return byPos;
  const half = Math.ceil(tracks.length / 2);
  return { a: tracks.slice(0, half), b: tracks.slice(half) };
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight: string, family: string) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 8 && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}
const TITLE = '"Big Shoulders Display", Impact, sans-serif';
const MONO = '"IBM Plex Mono", monospace';
const SANS = '"Instrument Sans", Helvetica, Arial, sans-serif';

function texture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function roundRect(ctx: CanvasRenderingContext2D | THREE.Shape, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
}

/** Face de cassette : photo nettoyée + impression de l'album (titre, titres de la face, face, référence, label). */
async function shellFace(r: Release, side: 'A' | 'B', photo: HTMLImageElement | null) {
  const w = 1004, h = 638;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.save();
  ctx.beginPath(); roundRect(ctx, 0, 0, w, h, (CR / CW) * w); ctx.clip();
  ctx.fillStyle = SHELL; ctx.fillRect(0, 0, w, h);
  if (photo) ctx.drawImage(photo, 0, 0, w, h);
  const Z = (k: keyof typeof ZONE) => { const [l, t, rr, b] = ZONE[k]; return { x: (l / 100) * w, y: (t / 100) * h, w: ((rr - l) / 100) * w, h: ((b - t) / 100) * h }; };
  const col = ink(r);
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';

  // bandeau du haut : titre, puis titres de la face séparés par des puces
  const top = Z('top');
  const titleSize = fitText(ctx, r.title.toUpperCase(), top.w * 0.7, 40, '800', SANS);
  ctx.fillText(r.title.toUpperCase(), top.x + top.w / 2, top.y + titleSize);
  const list = side === 'A' ? sides(r).a : sides(r).b;
  const lines: string[] = [];
  if (list.length) {
    let cur = '';
    ctx.font = `600 30px ${SANS}`;
    for (const t of list.map(s => s.toUpperCase())) {
      const next = cur ? `${cur} • ${t}` : t;
      if (ctx.measureText(next).width > top.w && cur) { lines.push(cur); cur = t; } else cur = next;
      if (lines.length >= 3) break;
    }
    if (cur && lines.length < 3) lines.push(cur);
  } else lines.push(r.artist.toUpperCase());
  const ls = Math.min(30, (top.h - titleSize - 6) / Math.max(1, lines.length) - 4);
  lines.forEach((l, i) => { fitText(ctx, l, top.w, ls, '600', SANS); ctx.fillText(l, top.x + top.w / 2, top.y + titleSize + 8 + (i + 1) * (ls + 4)); });

  // face et référence, de part et d'autre de la fenêtre
  const left = Z('left'), right = Z('right');
  ctx.font = `700 30px ${SANS}`; ctx.textAlign = 'left';
  ctx.fillText(catNo(r).replace('-', '-\n').split('\n')[0], left.x, left.y + 28);
  ctx.fillText(catNo(r).split('-')[1], left.x, left.y + 62);
  ctx.textAlign = 'right';
  ctx.fillText(`Side ${side === 'A' ? 1 : 2}`, right.x + right.w, right.y + 44);

  // bas : label et année
  const bot = Z('bottom');
  ctx.textAlign = 'center';
  const credit = `℗ © ${r.year ?? ''} ${r.label ?? ''}`.replace(/\s+/g, ' ').trim();
  fitText(ctx, credit, bot.w, 30, '600', SANS);
  ctx.fillText(credit, bot.x + bot.w / 2, bot.y + 40);
  ctx.font = `500 22px ${MONO}`;
  ctx.fillText(r.artist, bot.x + bot.w / 2, bot.y + 80, bot.w);
  ctx.restore();
  return texture(c);
}

/** Jaquette, face avant : pochette en haut, bloc de texte en dessous (mise en page d'une jaquette de K7 classique). */
function jcardFront(r: Release, cover: HTMLImageElement | null, grade?: Grade) {
  const w = 650, h = 1010;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FBF9F3'; ctx.fillRect(0, 0, w, h);
  coverOrFallback(ctx, cover, r, 0, 0, w, 630);
  ctx.fillStyle = '#111';
  ctx.textAlign = 'left'; ctx.font = `700 26px ${SANS}`; ctx.fillText(catNo(r), 28, 684);
  ctx.textAlign = 'center';
  fitText(ctx, r.title.toUpperCase(), w - 80, 46, '800', SANS); ctx.fillText(r.title.toUpperCase(), w / 2, 744);
  fitText(ctx, r.artist, w - 100, 30, '600', SANS); ctx.fillText(r.artist, w / 2, 790);
  ctx.font = `500 22px ${SANS}`;
  ctx.fillText(`℗ © ${r.year ?? ''} ${r.label ?? ''}`.trim(), w / 2, 838, w - 80);
  ctx.font = `900 50px ${TITLE}`; ctx.fillText('STEREO CASSETTE', w / 2, 960);
  scratches(ctx, grade, r.master_id, 0, 0, w, h);
  return texture(c);
}

/** Jaquette, tranche : référence et titre, à lire de bas en haut. */
function jcardSpine(r: Release) {
  const w = 125, h = 1010;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FBF9F3'; ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 24px ${SANS}`; ctx.fillText(catNo(r), -h / 2 + 110, -24);
  fitText(ctx, r.title.toUpperCase(), h - 300, 44, '800', SANS); ctx.fillText(r.title.toUpperCase(), 80, -18);
  fitText(ctx, r.artist, h - 300, 26, '600', SANS); ctx.fillText(r.artist, 80, 26);
  return texture(c);
}

/** Jaquette, rabat arrière : liste des titres face 1 / face 2, à lire de bas en haut. */
function jcardFlap(r: Release) {
  const w = 260, h = 1010;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FBF9F3'; ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#111'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const { a, b } = sides(r);
  const col = (title: string, list: string[], x: number) => {
    ctx.font = `800 26px ${SANS}`; ctx.fillText(title, x, -w / 2 + 50);
    ctx.font = `500 21px ${SANS}`;
    (list.length ? list : ['—']).slice(0, 8).forEach((t, i) => ctx.fillText(t.toUpperCase(), x, -w / 2 + 84 + i * 24, h / 2 - 40));
  };
  col('SIDE 1', a, -h / 2 + 30);
  col('SIDE 2', b, 20);
  ctx.font = `500 16px ${SANS}`; ctx.globalAlpha = 0.7;
  ctx.fillText(`${r.label ?? ''} · ${r.year ?? ''} · Données Discogs`, -h / 2 + 30, w / 2 - 20, h - 60);
  return texture(c);
}

export async function buildCassette(release: Release, opts: { grade?: Grade; phantom?: boolean }) {
  if (typeof document !== 'undefined' && document.fonts) { try { await document.fonts.ready; } catch { /* sans gravité */ } }
  const [cover, photo] = await Promise.all([loadImage(proxied(release.covers?.main?.cover) ?? ''), TEXTURES.k7Shell ? loadImage(TEXTURES.k7Shell) : Promise.resolve(null)]);
  const [sideA, sideB] = await Promise.all([shellFace(release, 'A', photo), shellFace(release, 'B', photo)]);

  const g = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { disposables.push(x); return x; };

  /* ---- Cassette, debout dans le boîtier (grand côté à la verticale) ---- */
  const cassette = new THREE.Group();
  const shape = new THREE.Shape(); roundRect(shape, -CW / 2, -CH / 2, CW, CH, CR);
  const bodyGeo = keep(new THREE.ExtrudeGeometry(shape, { depth: CD - 1.2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.5, bevelSegments: 2, curveSegments: 8 }));
  bodyGeo.translate(0, 0, -(CD - 1.2) / 2);
  const shellMat = keep(new THREE.MeshStandardMaterial({ color: SHELL, roughness: 0.5 }));
  cassette.add(new THREE.Mesh(bodyGeo, shellMat));
  const faceGeo = keep(new THREE.PlaneGeometry(CW, CH));
  const fa = new THREE.Mesh(faceGeo, keep(new THREE.MeshStandardMaterial({ map: sideA, transparent: true, alphaTest: 0.5, roughness: 0.5 })));
  fa.position.z = CD / 2 + 0.05; cassette.add(fa);
  const fb = new THREE.Mesh(faceGeo, keep(new THREE.MeshStandardMaterial({ map: sideB, transparent: true, alphaTest: 0.5, roughness: 0.5 })));
  fb.position.z = -(CD / 2 + 0.05); fb.rotation.y = Math.PI; cassette.add(fb);
  cassette.rotation.z = Math.PI / 2;                       // debout, côté tête de lecture vers l'ouverture
  cassette.position.set(1.5, 0, -LID / 2 + 0.45);
  g.add(cassette);

  /* ---- Boîtier cristal ---- */
  const clear = keep(new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide }));
  const edgeMat = keep(new THREE.MeshPhysicalMaterial({ color: '#dfe6ea', transparent: true, opacity: 0.45, roughness: 0.1, depthWrite: false }));
  const baseD = BD - LID;
  const base = new THREE.Mesh(keep(new THREE.BoxGeometry(BW, BH, baseD)), clear);
  base.position.z = -LID / 2;
  base.renderOrder = 2;
  g.add(base);
  g.add(new THREE.LineSegments(keep(new THREE.EdgesGeometry(base.geometry)), keep(new THREE.LineBasicMaterial({ color: '#aab6be', transparent: true, opacity: 0.85 }))).translateZ(-LID / 2));

  // tranche de la jaquette (côté charnière, à gauche) et rabat arrière avec les titres
  const spine = new THREE.Mesh(keep(new THREE.PlaneGeometry(baseD - 1.2, BH - 4)), keep(new THREE.MeshStandardMaterial({ map: jcardSpine(release), roughness: 0.8 })));
  spine.rotation.y = -Math.PI / 2; spine.position.set(-BW / 2 + 0.7, 0, -LID / 2); g.add(spine);
  const flapW = 26;
  const flap = new THREE.Mesh(keep(new THREE.PlaneGeometry(flapW, BH - 4)), keep(new THREE.MeshStandardMaterial({ map: jcardFlap(release), roughness: 0.8 })));
  flap.rotation.y = Math.PI; flap.position.set(-BW / 2 + 1.2 + flapW / 2, 0, -BD / 2 + 0.3); g.add(flap);

  // couvercle : pivote sur la charnière (bord gauche)
  const hinge = new THREE.Group();
  hinge.position.set(-BW / 2, 0, BD / 2 - LID);
  const lid = new THREE.Group();
  lid.position.set(BW / 2, 0, LID / 2);
  const lidBox = new THREE.Mesh(keep(new THREE.BoxGeometry(BW, BH, LID)), clear);
  lidBox.renderOrder = 3;
  lid.add(lidBox);
  lid.add(new THREE.LineSegments(keep(new THREE.EdgesGeometry(lidBox.geometry)), keep(new THREE.LineBasicMaterial({ color: '#aab6be', transparent: true, opacity: 0.85 }))));
  const front = new THREE.Mesh(keep(new THREE.PlaneGeometry(BW - 4, BH - 4)), keep(new THREE.MeshStandardMaterial({ map: jcardFront(release, cover, opts.grade), roughness: 0.75 })));
  front.position.set(1, 0, -LID / 2 + 0.6); lid.add(front);
  // reflet sur le plastique avant
  const gloss = new THREE.Mesh(keep(new THREE.PlaneGeometry(BW, BH)), edgeMat);
  gloss.position.z = LID / 2 + 0.02; gloss.renderOrder = 4; lid.add(gloss);
  if (opts.phantom) {
    const holo = new THREE.Mesh(keep(new THREE.PlaneGeometry(BW - 4, BH - 4)), keep(new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.22, roughness: 0.15, metalness: 0.9, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [200, 900], depthWrite: false })));
    holo.position.z = -LID / 2 + 0.75; holo.renderOrder = 5; lid.add(holo);
  }
  hinge.add(lid);
  g.add(hinge);
  edgeMat.opacity = 0.12;

  let open = 0, target = 0;
  g.userData.setOpen = (o: boolean) => { target = o ? 1 : 0; };
  g.userData.update = () => {
    open += (target - open) * 0.12;
    hinge.rotation.y = -open * THREE.MathUtils.degToRad(115);
  };
  g.userData.dispose = () => {
    disposables.forEach(d => d.dispose());
    [sideA, sideB].forEach(t => t.dispose());
    g.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; m?.map?.dispose(); });
  };
  return g;
}

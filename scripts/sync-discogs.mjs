#!/usr/bin/env node
// Synchronise le catalogue Carton Plein avec Discogs.
//   node scripts/sync-discogs.mjs            → tout le catalogue
//   node scripts/sync-discogs.mjs --limit 5  → les 5 premiers albums (test)
//   node scripts/sync-discogs.mjs --dry      → n'écrit rien, affiche le résultat
//
// Variables d'environnement : DISCOGS_KEY, DISCOGS_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
// Conditions Discogs : données affichées jamais plus vieilles que 6 h (d'où l'exécution toutes les 6 h),
// images liées directement depuis Discogs (jamais copiées), 60 requêtes / minute maximum.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { computeTiers, FORMATS } from './rarity.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const LIMIT = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const DRY = args.includes('--dry');

// Sur GitHub Actions, « ::error:: » fait remonter le message dans les annotations du résumé.
const fail = (msg) => { console.log(`::error::${msg}`); process.exit(1); };

const { DISCOGS_KEY, DISCOGS_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const missing = ['DISCOGS_KEY', 'DISCOGS_SECRET', ...(DRY ? [] : ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])].filter(k => !process.env[k]);
if (missing.length) fail(`Secret(s) manquant(s) ou vide(s) : ${missing.join(', ')}. À ajouter dans Settings > Secrets and variables > Actions.`);
if (!DRY && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(SUPABASE_URL.trim())) fail('SUPABASE_URL doit être de la forme https://xxxx.supabase.co (Project URL, sans /rest/v1 ni autre chemin).');

const UA = 'CartonPlein/1.0 +https://github.com';
const DISCOGS_FMT = { v: 'Vinyl', c: 'CD', k: 'Cassette', e: '8-Track Cartridge' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let lastCall = 0;
async function discogs(pathname, params = {}) {
  const url = new URL('https://api.discogs.com' + pathname);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = lastCall + 1100 - Date.now(); // ≤ 55 requêtes / minute
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const res = await fetch(url, { headers: { 'User-Agent': UA, Authorization: `Discogs key=${DISCOGS_KEY}, secret=${DISCOGS_SECRET}` } });
    if (res.status === 429 || res.status >= 500) { await sleep(15000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`${res.status} ${pathname}`);
    const remaining = Number(res.headers.get('x-discogs-ratelimit-remaining'));
    if (remaining <= 3) await sleep(20000);
    return res.json();
  }
  throw new Error(`Discogs indisponible pour ${pathname}`);
}

const clean = s => String(s || '').replace(/\s*\(\d+\)/g, '').replace(/\*/g, '').trim();
const pickImages = imgs => {
  const list = Array.isArray(imgs) ? imgs : [];
  const primary = list.find(i => i.type === 'primary') || list[0];
  const back = list.find(i => i !== primary);
  if (!primary) return null;
  return { cover: primary.uri, thumb: primary.uri150, back: back ? back.uri : null, w: primary.width, h: primary.height };
};

async function fetchAlbum(seed, previous) {
  const id = seed.master_id;
  const m = await discogs(`/masters/${id}`);
  const facets = await discogs(`/masters/${id}/versions`, { per_page: 1 });
  const fmtFacet = (facets.filter_facets || []).find(f => f.id === 'format');
  const fmt_counts = {};
  for (const f of FORMATS) {
    const hit = fmtFacet && fmtFacet.values.find(v => v.title === DISCOGS_FMT[f]);
    fmt_counts[f] = hit ? hit.count : 0;
  }

  // have / want au niveau de l'album (tous pressages confondus) via la recherche
  let have = previous?.have ?? 0, want = previous?.want ?? 0;
  try {
    const artist = clean((m.artists || [])[0]?.name);
    const s = await discogs('/database/search', { type: 'master', q: `${artist} ${m.title}`, per_page: 25 });
    const hit = (s.results || []).find(r => r.id === id);
    if (hit?.community) { have = hit.community.have; want = hit.community.want; }
  } catch { /* on garde les valeurs précédentes */ }

  // Une édition réelle par format, la plus collectionnée, pour sa propre pochette
  // (jaquette de la K7, livret du CD, étiquette du 8-track).
  const covers = { main: pickImages(m.images) };
  for (const f of FORMATS) {
    if (!fmt_counts[f]) continue;
    let releaseId = previous?.covers?.[f]?.release_id;
    if (!releaseId) {
      const v = await discogs(`/masters/${id}/versions`, { format: DISCOGS_FMT[f], per_page: 100 });
      const best = (v.versions || []).sort((a, b) => (b.stats?.community?.in_collection || 0) - (a.stats?.community?.in_collection || 0))[0];
      releaseId = best?.id;
    }
    if (!releaseId) continue;
    const rel = await discogs(`/releases/${releaseId}`);
    const img = pickImages(rel.images);
    covers[f] = { release_id: releaseId, uri: rel.uri, country: rel.country || null, year: rel.year || null,
      label: clean(rel.labels?.[0]?.name), catno: rel.labels?.[0]?.catno || null, ...(img || {}) };
  }

  return {
    master_id: id,
    artist: seed.artist || clean((m.artists || []).map(a => a.name + (a.join && a.join !== ',' ? ' ' + a.join : '')).join(' ').replace(/\s+/g, ' ')),
    title: seed.title || m.title,
    year: m.year || null,
    genres: m.genres || [],
    styles: (m.styles || []).slice(0, 5),
    label: covers.v?.label || covers.c?.label || previous?.label || null,
    country: covers.v?.country || previous?.country || null,
    have, want,
    lowest_price: m.lowest_price ?? null,
    for_sale: m.num_for_sale || 0,
    uri: m.uri ? new URL(m.uri).pathname : `/master/${id}`,
    gem: !!seed.gem,
    tracklist: (m.tracklist || []).filter(t => (t.type_ || 'track') === 'track' && t.title).slice(0, 40).map(t => ({ p: t.position || '', t: t.title })),
    fmt_counts,
    covers,
    active: true,
    refreshed_at: new Date().toISOString(),
  };
}

async function main() {
  const seeds = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog-seed.json'), 'utf8')).slice(0, LIMIT);
  const supabase = DRY ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const existing = new Map();
  // Test de la clé Discogs avant de lancer 25 minutes de travail
  try { await discogs('/masters/24047'); }
  catch (e) { fail(`Discogs refuse la connexion (${e.message}). Vérifie DISCOGS_KEY et DISCOGS_SECRET (Consumer Key et Consumer Secret de ton application Discogs).`); }

  let hasTracklist = true;
  if (supabase) {
    const probe = await supabase.from('releases').select('tracklist').limit(1);
    if (probe.error) { hasTracklist = false; console.log('::warning::Colonne « tracklist » absente : exécute supabase/migrations/002_tracklist.sql dans Supabase pour afficher les titres sur les K7.'); }
    const { data, error } = await supabase.from('releases').select('*');
    if (error) {
      const hint = /relation|does not exist|schema cache/i.test(error.message)
        ? 'La table « releases » est introuvable : exécute supabase/migrations/001_init.sql dans Supabase > SQL Editor.'
        : /JWT|apikey|Invalid API key|401|403/i.test(error.message)
          ? 'Clé Supabase refusée : SUPABASE_SERVICE_ROLE_KEY doit être la clé « service_role » (Project Settings > API), pas la clé « anon ».'
          : 'Supabase refuse la lecture.';
      fail(`${hint} Détail : ${error.message}`);
    }
    data.forEach(r => existing.set(Number(r.master_id), r));
  }

  const rows = [];
  let ok = 0, failed = 0;
  for (const [i, seed] of seeds.entries()) {
    try {
      const row = await fetchAlbum(seed, existing.get(seed.master_id));
      rows.push(row); ok++;
      console.log(`[${i + 1}/${seeds.length}] ${row.artist} – ${row.title}  ${JSON.stringify(row.fmt_counts)}`);
    } catch (e) {
      failed++;
      console.warn(`[${i + 1}/${seeds.length}] échec ${seed.master_id}: ${e.message}`);
      const prev = existing.get(seed.master_id);
      if (prev) rows.push(prev); // on garde l'ancienne ligne pour le calcul des raretés
    }
  }

  // Raretés recalculées sur tout le catalogue (les exemplaires déjà tirés gardent leur palier)
  const all = new Map(existing);
  rows.forEach(r => all.set(r.master_id, r));
  const tiers = computeTiers([...all.values()]);
  const fresh = rows.filter(r => r.refreshed_at && Date.now() - Date.parse(r.refreshed_at) < 3600e3)
    .map(r => { const row = { ...r, tiers: tiers[r.master_id] }; if (!hasTracklist) delete row.tracklist; return row; });

  if (DRY) {
    console.log(JSON.stringify(fresh.slice(0, 2), null, 2));
  } else {
    for (let i = 0; i < fresh.length; i += 50) {
      const { error } = await supabase.from('releases').upsert(fresh.slice(i, i + 50));
      if (error) throw error;
    }
    // Mettre à jour les paliers des albums non rafraîchis cette fois-ci
    const stale = [...all.values()].filter(r => !fresh.some(f => f.master_id === Number(r.master_id)));
    for (const r of stale) await supabase.from('releases').update({ tiers: tiers[r.master_id] }).eq('master_id', r.master_id);
  }
  const dist = {}; Object.values(tiers).forEach(t => Object.values(t).forEach(v => (dist[v] = (dist[v] || 0) + 1)));
  console.log(`Terminé : ${ok} albums à jour, ${failed} échecs. Répartition des paliers :`, dist);
  if (failed > seeds.length / 2) process.exit(1);
}

main().catch(e => { console.error(e); fail(`Synchronisation interrompue : ${e.message || e}`); });

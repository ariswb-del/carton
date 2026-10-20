// Relais des pochettes Discogs, pour que le moteur 3D puisse les appliquer sur les objets.
// - Uniquement des images i.discogs.com (pas un relais ouvert).
// - Rien n'est stocké côté serveur : l'image est transmise à la volée.
// - Cache limité au navigateur du joueur, 6 heures maximum (règle de fraîcheur Discogs).
export const runtime = 'edge';

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('u') || '';
  let target: URL;
  try { target = new URL(raw); } catch { return new Response('Adresse invalide', { status: 400 }); }
  if (target.protocol !== 'https:' || target.hostname !== 'i.discogs.com') return new Response('Source non autorisée', { status: 400 });

  const upstream = await fetch(target, { headers: { 'User-Agent': 'CartonPlein/1.0', Accept: 'image/*' }, cache: 'no-store' });
  const type = upstream.headers.get('content-type') || '';
  if (!upstream.ok || !type.startsWith('image/')) return new Response('Pochette indisponible', { status: 502 });

  return new Response(upstream.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=21600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

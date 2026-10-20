import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Lien magique reçu par e-mail → session ouverte → retour au jeu.
// En cas d'échec, on revient à l'accueil avec la raison, pour l'afficher au joueur.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const fail = (reason: string) => NextResponse.redirect(new URL(`/?erreur=${encodeURIComponent(reason)}`, url.origin));

  const upstream = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (upstream) return fail(upstream);
  if (!code) return fail('lien incomplet');

  const supabase = supabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(error.message);
  return NextResponse.redirect(new URL('/cartons', url.origin));
}

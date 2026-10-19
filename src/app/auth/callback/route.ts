import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

// Lien magique reçu par e-mail → session ouverte → retour au jeu.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const supabase = supabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL('/cartons', url.origin));
}

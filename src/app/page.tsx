'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useGame } from '@/components/Game';
import { Footer } from '@/components/Shell';
import MediaObject from '@/components/objects/MediaObject';
import { FMT } from '@/lib/game';
import type { Fmt } from '@/lib/types';

// Connexion par e-mail et mot de passe, sans aucun e-mail envoyé (confirmation désactivée dans Supabase).
export default function Landing() {
  const { ready, user, sb, releaseList } = useGame();
  const router = useRouter();
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (ready && user) router.replace('/cartons'); }, [ready, user, router]);

  // Vitrine : un album par format, pris parmi ceux qui ont une vraie pochette pour ce format
  const showcase = useMemo(() => {
    const out: { r: (typeof releaseList)[number]; f: Fmt }[] = [];
    for (const f of ['v', 'k', 'c', 'e'] as Fmt[]) {
      const pool = releaseList.filter(r => r.covers?.[f]?.cover && !out.some(o => o.r.master_id === r.master_id));
      if (pool.length) out.push({ r: pool[(new Date().getDate() * 7 + f.charCodeAt(0)) % pool.length], f });
    }
    return out;
  }, [releaseList]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email')).trim();
    const password = String(f.get('password'));
    setBusy(true); setErr(null);

    if (mode === 'signup') {
      const { data, error } = await sb.auth.signUp({ email, password });
      setBusy(false);
      if (error) {
        const m = error.message || '';
        return setErr(
          /already registered|already exists/i.test(m) ? 'Un compte existe déjà avec cet e-mail. Passe sur « Se connecter ».'
          : /at least \d+ characters|too short/i.test(m) ? 'Mot de passe trop court : 8 caractères minimum.'
          : /password/i.test(m) ? 'Mot de passe trop faible : mélange minuscules, majuscules et chiffres.'
          : /fetch|network|Failed/i.test(m) ? 'Le site ne joint pas Supabase : vérifie les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans Vercel.'
          : `Inscription impossible : ${m}`,
        );
      }
      if (!data.session) return setErr('Compte créé, mais Supabase attend une confirmation par e-mail. Désactive « Confirm email » dans Supabase (voir le guide), puis connecte-toi.');
      window.location.assign('/cartons');
      return;
    }

    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      const m = error.message || '';
      return setErr(
        /invalid login|invalid credentials/i.test(m) ? 'E-mail ou mot de passe incorrect.'
        : /not confirmed/i.test(m) ? 'Ce compte attend une confirmation par e-mail. Désactive « Confirm email » dans Supabase (voir le guide).'
        : `Connexion impossible : ${m}`,
      );
    }
    window.location.assign('/cartons');
  }

  return (
    <>
      <header className="top"><div className="wrap"><div className="hrow"><span className="brand"><span className="dot" aria-hidden="true">33</span>Carton Plein</span></div></div></header>
      <main className="wrap">
        <div className="hero">
          <div className="stack">
            <div className="eyebrow">Brocante numérique · vinyles, CD, K7, 8-track</div>
            <h1>Fouille les cartons, monte ta collection</h1>
            <p className="lede">Chaque carton contient cinq disques, avec leur vraie pochette et leur cote Discogs. Garde les pépites, échange les doublons avec tes amis, découvre ce qui tourne dans ta ville. Certains formats n&apos;ont jamais existé : ce sont des pressages fantômes, les pièces les plus convoitées.</p>
            <div className="chips" role="group" aria-label="Connexion">
              <button type="button" className="chip" aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setErr(null); }}>Créer un compte</button>
              <button type="button" className="chip" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setErr(null); }}>Se connecter</button>
            </div>
            <form className="stack" style={{ maxWidth: 420 }} onSubmit={submit}>
              <div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" name="email" type="email" required autoComplete="email" placeholder="toi@exemple.fr" /></div>
              <div className="field"><label htmlFor="password">Mot de passe</label><input className="input" id="password" name="password" type="password" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="8 caractères minimum" /></div>
              {mode === 'signup' && <p className="muted small" style={{ margin: 0 }}>Au moins 8 caractères, avec des minuscules, des majuscules et des chiffres.</p>}
              <div className="row"><button className="btn primary" disabled={busy}>{mode === 'signup' ? 'Recevoir mes 3 cartons' : 'Entrer dans la brocante'}</button></div>
              {err && <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{err}</p>}
              {mode === 'login' && <p className="muted small" style={{ margin: 0 }}>Mot de passe oublié ? Écris à l&apos;organisateur du jeu, il peut le réinitialiser.</p>}
            </form>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', alignItems: 'end' }}>
            {showcase.map(({ r, f }) => (
              <figure key={f} style={{ margin: 0, display: 'grid', gap: 6, justifyItems: 'center' }}>
                <div style={{ width: f === 'k' || f === 'e' ? '62%' : '100%' }}><MediaObject release={r} format={f} grade="NM" /></div>
                <figcaption className="muted small">{FMT[f]} · {r.title}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

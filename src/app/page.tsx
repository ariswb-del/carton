'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useGame } from '@/components/Game';
import { Footer } from '@/components/Shell';
import MediaObject from '@/components/objects/MediaObject';
import { FMT } from '@/lib/game';
import type { Fmt } from '@/lib/types';

export default function Landing() {
  const { ready, user, sb, releaseList } = useGame();
  const router = useRouter();
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (ready && user) router.replace('/cartons'); }, [ready, user, router]);

  // Retour d'un lien de connexion qui a échoué
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('erreur');
    if (!reason) return;
    setErr(
      /verifier|code verifier|both auth code/i.test(reason) ? "Le lien a été ouvert dans un autre navigateur que celui où tu l'as demandé. Redemande un lien et ouvre-le sur ce navigateur-ci."
      : /expired|invalid|not found|already/i.test(reason) ? 'Ce lien a expiré ou a déjà servi. Demande plutôt un code ci-dessous.'
      : `La connexion a échoué : ${reason}`,
    );
    window.history.replaceState(null, '', '/');
  }, []);

  // Vitrine : un album par format, pris parmi ceux qui ont une vraie pochette pour ce format
  const showcase = useMemo(() => {
    const out: { r: (typeof releaseList)[number]; f: Fmt }[] = [];
    for (const f of ['v', 'k', 'c', 'e'] as Fmt[]) {
      const pool = releaseList.filter(r => r.covers?.[f]?.cover && !out.some(o => o.r.master_id === r.master_id));
      if (pool.length) out.push({ r: pool[(new Date().getDate() * 7 + f.charCodeAt(0)) % pool.length], f });
    }
    return out;
  }, [releaseList]);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email')).trim();
    setBusy(true); setErr(null);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setBusy(false);
    if (error) {
      const m = error.message || '';
      setErr(
        /not authorized/i.test(m) ? "Cette adresse n'est pas autorisée : le service d'e-mail de test de Supabase n'écrit qu'aux membres du projet. Il faut brancher un service d'envoi (voir le guide)."
        : /rate limit|too many|seconds/i.test(m) ? "Trop de demandes de code en peu de temps (limite Supabase). Réessaie dans une heure, ou branche un service d'envoi."
        : /fetch|network|Failed/i.test(m) ? 'Le site ne joint pas Supabase : vérifie les variables NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans Vercel.'
        : `L'envoi a échoué : ${m}`,
      );
    }
    else setSent(email);
  }

  // Code reçu par e-mail, saisi ici : marche sur tout appareil, sans dépendre du lien.
  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = String(new FormData(e.currentTarget).get('code')).replace(/\D/g, '');
    if (!sent || token.length < 6) return setErr('Le code fait au moins 6 chiffres.');
    setBusy(true); setErr(null);
    const { error } = await sb.auth.verifyOtp({ email: sent, token, type: 'email' });
    setBusy(false);
    if (error) {
      setErr(/expired|invalid/i.test(error.message) ? 'Code incorrect ou expiré. Vérifie-le, ou redemande un code.' : `La connexion a échoué : ${error.message}`);
      return;
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
            {sent ? (
              <form className="panel stack" style={{ maxWidth: 420 }} onSubmit={verify}>
                <h3>Regarde ta boîte mail</h3>
                <p className="muted" style={{ margin: 0 }}>Un e-mail vient de partir vers <b>{sent}</b>. Tape ici le code qu&apos;il contient.</p>
                <div className="field"><label htmlFor="code">Code reçu</label>
                  <input className="input mono" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={12} required placeholder="123456" style={{ fontSize: 22, letterSpacing: '.2em' }} autoFocus />
                </div>
                <div className="row">
                  <button className="btn primary" disabled={busy}>Entrer dans la brocante</button>
                  <button type="button" className="btn ghost small" onClick={() => { setSent(null); setErr(null); }}>Changer d&apos;adresse</button>
                </div>
                {err && <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{err}</p>}
                <p className="muted small" style={{ margin: 0 }}>Rien au bout de 5 minutes ? Regarde dans les indésirables.</p>
              </form>
            ) : (
              <form className="stack" style={{ maxWidth: 420 }} onSubmit={login}>
                <div className="field"><label htmlFor="email">Ton e-mail</label><input className="input" id="email" name="email" type="email" required autoComplete="email" placeholder="toi@exemple.fr" /></div>
                <div className="row"><button className="btn primary" disabled={busy}>Recevoir mon code</button></div>
                {err && <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{err}</p>}
                <p className="muted small" style={{ margin: 0 }}>Pas de mot de passe : un code par e-mail suffit.</p>
              </form>
            )}
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

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useGame } from './Game';
import { Pips } from './ui';
import { boxState, errorText } from '@/lib/game';

const TABS: [string, string][] = [
  ['/cartons', 'Cartons'], ['/collection', 'Ma collection'], ['/amis', 'Amis'],
  ['/echanges', 'Échanges'], ['/ville', 'Ma ville'], ['/catalogue', 'Catalogue'],
];

export function Footer() {
  return (
    <footer className="foot wrap">
      <p>Données et pochettes fournies par <a href="https://www.discogs.com" target="_blank" rel="noopener noreferrer">Discogs</a>, affichées directement depuis leurs serveurs et mises à jour toutes les 6 heures. Chaque disque renvoie vers sa fiche Discogs.</p>
      <p>Carton Plein n&apos;est ni affilié, ni sponsorisé, ni approuvé par Discogs. « Discogs » est une marque de Zink Media, LLC. Les pochettes restent la propriété de leurs ayants droit.</p>
    </footer>
  );
}

function Onboarding() {
  const { sb, refreshProfile, toast } = useGame();
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await sb.rpc('create_profile', { p_pseudo: String(f.get('pseudo')).trim(), p_city: String(f.get('city')).trim() });
    setBusy(false);
    if (error) return toast(errorText(error));
    await refreshProfile();
  }
  return (
    <div className="hero">
      <div className="stack">
        <div className="eyebrow">Bienvenue au marché aux puces</div>
        <h1>Trois cartons t&apos;attendent</h1>
        <p className="lede">Choisis ton nom de digger et ta ville. La ville sert seulement à voir ce que collectionnent les joueurs près de chez toi.</p>
        <form className="stack" style={{ maxWidth: 420 }} onSubmit={submit}>
          <div className="field"><label htmlFor="pseudo">Pseudo</label><input className="input" id="pseudo" name="pseudo" required minLength={2} maxLength={24} placeholder="ex. Ari du 11e" /></div>
          <div className="field"><label htmlFor="city">Ville</label><input className="input" id="city" name="city" required maxLength={60} placeholder="ex. Paris" /></div>
          <div><button className="btn primary" disabled={busy}>Recevoir mes 3 cartons</button></div>
        </form>
      </div>
      <CartonArt />
    </div>
  );
}

export function CartonArt({ open, shake, lot }: { open?: boolean; shake?: boolean; lot?: number }) {
  return (
    <div className={`carton ${open ? 'open' : ''} ${shake ? 'shake' : ''}`} aria-hidden="true">
      <div className="flap l" /><div className="flap r" />
      <div className="box">
        <div className="tape" />
        <div className="lot">LOT N° {String(lot ?? 1).padStart(4, '0')}</div>
        <div className="marker">VINYLES · K7<br />CD · 8-TRACK</div>
        <div className="stamp">FRAGILE</div>
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { ready, user, profile, trades, sb } = useGame();
  const path = usePathname();
  const router = useRouter();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (ready && !user) router.replace('/'); }, [ready, user, router]);

  const pending = profile ? trades.filter(t => t.status === 'pending' && t.to_user === profile.id).length : 0;
  const st = boxState(profile);

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="hrow">
            <Link href="/cartons" className="brand"><span className="dot" aria-hidden="true">33</span>Carton Plein</Link>
            {profile && (
              <div className="me-chip">
                <b>{profile.pseudo}</b><Pips n={st.stock} />
                <button type="button" className="btn small ghost" onClick={async () => { await sb.auth.signOut(); router.replace('/'); }}>Sortir</button>
              </div>
            )}
          </div>
          {profile && (
            <nav className="tabs" aria-label="Sections">
              {TABS.map(([href, label]) => (
                <Link key={href} href={href} aria-current={path.startsWith(href) ? 'page' : undefined}>
                  {label}{href === '/echanges' && pending > 0 && <span className="badge">{pending}</span>}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main className="wrap">
        {!ready || !user ? <div className="empty"><b>Ouverture de la boutique…</b></div> : !profile ? <Onboarding /> : children}
      </main>
      <Footer />
    </>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Shell from '@/components/Shell';
import { useGame } from '@/components/Game';
import { errorText, fmtNum } from '@/lib/game';

type Edge = { user_id: string; friend_id: string };

function Friends() {
  const { sb, profile, people, loadPeople, refreshProfile, toast } = useGame();
  const [edges, setEdges] = useState<Edge[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from('friendships').select('user_id, friend_id');
    const list = (data as Edge[]) ?? [];
    setEdges(list);
    await loadPeople(list.flatMap(e => [e.user_id, e.friend_id]));
  }, [sb, loadPeople]);
  useEffect(() => { load(); }, [load]);

  if (!profile) return null;
  const mine = edges.filter(e => e.user_id === profile.id).map(e => e.friend_id);
  const back = edges.filter(e => e.friend_id === profile.id && !mine.includes(e.user_id)).map(e => e.user_id);

  async function add(code: string) {
    setBusy(true);
    const { data, error } = await sb.rpc('add_friend', { p_code: code });
    setBusy(false);
    if (error) return toast(errorText(error));
    await load();
    await loadPeople([String(data)]);
    toast('Ajouté à ta bande.');
  }
  async function addBack(id: string) {
    const p = people.get(id); if (p) await add(p.friend_code);
  }
  async function rename(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pseudo = String(new FormData(e.currentTarget).get('pseudo')).trim();
    const { error } = await sb.from('profiles').update({ pseudo }).eq('id', profile!.id);
    if (error) return toast(error.code === '23505' ? 'Ce pseudo est déjà pris.' : errorText(error));
    await refreshProfile(); toast('Pseudo enregistré.');
  }

  const row = (id: string, isBack: boolean) => {
    const p = people.get(id);
    return (
      <div className="li" key={id}>
        <div className="grow"><b>{p?.pseudo ?? 'Collectionneur'}</b><span className="muted small">{p?.city} · {fmtNum(p?.opened ?? 0)} cartons ouverts</span></div>
        {isBack ? <button className="btn small primary" onClick={() => addBack(id)}>Ajouter en retour</button> : <Link className="btn small" href={`/amis/${id}`}>Comparer et échanger</Link>}
      </div>
    );
  };

  return (
    <div className="section">
      <div><div className="eyebrow">Amis</div><h1>Ta bande de diggers</h1></div>
      <div className="two">
        <div className="panel stack">
          <h3>Ton code ami</h3>
          <div className="row"><span className="code">{profile.friend_code}</span>
            <button className="btn small ghost" onClick={() => navigator.clipboard?.writeText(profile.friend_code).then(() => toast('Code copié.'), () => toast(`Ton code : ${profile.friend_code}`))}>Copier</button>
          </div>
          <p className="muted small" style={{ margin: 0 }}>Donne ce code à un ami qui joue : il t&apos;ajoute en le saisissant.</p>
        </div>
        <form className="panel stack" onSubmit={e => { e.preventDefault(); const c = String(new FormData(e.currentTarget).get('code')); add(c); e.currentTarget.reset(); }}>
          <h3>Ajouter un ami</h3>
          <div className="row"><input className="input" name="code" maxLength={6} required placeholder="Code à 6 caractères" style={{ flex: 1, textTransform: 'uppercase' }} aria-label="Code ami" /><button className="btn primary" disabled={busy}>Ajouter</button></div>
        </form>
      </div>
      {back.length > 0 && <div className="stack"><h3>Ils t&apos;ont ajouté</h3><div className="list">{back.map(id => row(id, true))}</div></div>}
      <div className="stack"><h3>Tes amis ({mine.length})</h3>{mine.length ? <div className="list">{mine.map(id => row(id, false))}</div> : <div className="empty">Pas encore d&apos;amis dans le jeu. Partage ton code.</div>}</div>
      <form className="panel stack" style={{ maxWidth: 520 }} onSubmit={rename}>
        <h3>Mon profil</h3>
        <div className="field"><label htmlFor="pseudo">Pseudo</label><input className="input" id="pseudo" name="pseudo" minLength={2} maxLength={24} defaultValue={profile.pseudo} /></div>
        <div><button className="btn small">Enregistrer</button></div>
      </form>
    </div>
  );
}

export default function Page() { return <Shell><Friends /></Shell>; }

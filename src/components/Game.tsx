'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Copy, Profile, Release, Trade } from '@/lib/types';

type GameCtx = {
  sb: ReturnType<typeof supabaseBrowser>;
  ready: boolean;
  user: User | null;
  profile: Profile | null;
  releases: Map<number, Release>;
  releaseList: Release[];
  copies: Copy[];
  trades: Trade[];
  people: Map<string, Profile>;
  loadPeople: (ids: string[]) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshCopies: () => Promise<void>;
  refreshTrades: () => Promise<void>;
  toast: (msg: string) => void;
};

const Ctx = createContext<GameCtx | null>(null);
export const useGame = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useGame hors de GameProvider');
  return c;
};

export function GameProvider({ children }: { children: ReactNode }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [releaseList, setReleaseList] = useState<Release[]>([]);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const peopleRef = useRef(people);
  peopleRef.current = people;

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3800);
  }, []);

  const releases = useMemo(() => new Map(releaseList.map(r => [Number(r.master_id), { ...r, master_id: Number(r.master_id) }])), [releaseList]);

  const loadPeople = useCallback(async (ids: string[]) => {
    const missing = [...new Set(ids)].filter(id => id && !peopleRef.current.has(id));
    if (!missing.length) return;
    const { data } = await sb.from('profiles').select('*').in('id', missing);
    if (data?.length) setPeople(prev => { const m = new Map(prev); (data as Profile[]).forEach(p => m.set(p.id, p)); return m; });
  }, [sb]);

  const refreshProfile = useCallback(async () => {
    const { data: { user: u } } = await sb.auth.getUser();
    if (!u) { setProfile(null); return; }
    const { data } = await sb.from('profiles').select('*').eq('id', u.id).maybeSingle();
    setProfile((data as Profile) ?? null);
    if (data) setPeople(prev => new Map(prev).set(u.id, data as Profile));
  }, [sb]);

  const refreshCopies = useCallback(async () => {
    const { data: { user: u } } = await sb.auth.getUser();
    if (!u) return;
    const { data } = await sb.from('copies').select('*').eq('owner', u.id).order('acquired_at', { ascending: false }).limit(5000);
    setCopies(((data as Copy[]) ?? []).map(c => ({ ...c, master_id: Number(c.master_id) })));
  }, [sb]);

  const refreshTrades = useCallback(async () => {
    const { data: { user: u } } = await sb.auth.getUser();
    if (!u) return;
    const { data } = await sb.from('trades').select('*').or(`from_user.eq.${u.id},to_user.eq.${u.id}`).order('created_at', { ascending: false }).limit(200);
    setTrades((data as Trade[]) ?? []);
  }, [sb]);

  // Session + catalogue
  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: { user: u } }, rel] = await Promise.all([
        sb.auth.getUser(),
        sb.from('releases').select('*').eq('active', true),
      ]);
      if (!alive) return;
      setReleaseList((rel.data as Release[]) ?? []);
      setUser(u);
      if (u) await Promise.all([refreshProfile(), refreshCopies(), refreshTrades()]);
      if (alive) setReady(true);
    })();
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) { setProfile(null); setCopies([]); setTrades([]); }
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [sb, refreshProfile, refreshCopies, refreshTrades]);

  // Mises à jour en direct : échanges reçus, disques qui entrent ou sortent du bac
  useEffect(() => {
    if (!user) return;
    const ch = sb.channel('live-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `to_user=eq.${user.id}` }, () => { refreshTrades(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `from_user=eq.${user.id}` }, () => { refreshTrades(); refreshCopies(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'copies', filter: `owner=eq.${user.id}` }, () => { refreshCopies(); })
      .subscribe();
    const onFocus = () => { refreshProfile(); refreshCopies(); refreshTrades(); };
    window.addEventListener('focus', onFocus);
    return () => { sb.removeChannel(ch); window.removeEventListener('focus', onFocus); };
  }, [sb, user, refreshCopies, refreshTrades, refreshProfile]);

  const value: GameCtx = { sb, ready, user, profile, releases, releaseList, copies, trades, people, loadPeople, refreshProfile, refreshCopies, refreshTrades, toast };
  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}

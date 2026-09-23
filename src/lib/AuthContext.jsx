import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isLocal } from './supabase.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(isLocal ? { id: 'local', local: true } : undefined); // undefined = loading
  const [error, setError] = useState('');

  useEffect(() => {
    if (isLocal) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    return !error;
  }
  async function signUp(email, password) {
    setError('');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setError(error.message); return false; }
    // With "Confirm email" turned off in Supabase, signUp already returns a live session.
    // With it left on, there's no session yet — the person needs to confirm by email once.
    if (!data.session) setError('Check your email to confirm your account, then sign in.');
    return true;
  }
  async function signOut() {
    if (!isLocal) await supabase.auth.signOut();
  }

  return <Ctx.Provider value={{ user, isLocal, error, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
}

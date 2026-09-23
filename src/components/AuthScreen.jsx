import { useState } from 'react';
import { useAuth } from '../lib/AuthContext.jsx';

export default function AuthScreen() {
  const { signIn, signUp, error } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!email || !password || busy) return;
    setBusy(true);
    setNotice('');
    const ok = mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (ok && mode === 'signup') setNotice('Account created. If you\u2019re not signed in yet, check your email to confirm, then sign in below.');
  }

  return (
    <div className="auth">
      <h1>Quire</h1>
      <p>A quiet place to write your novel. Sign in to sync across your devices.</p>
      <form onSubmit={submit}>
        <input
          type="email" inputMode="email" autoComplete="email" placeholder="you@email.com"
          value={email} onChange={(e) => setEmail(e.target.value)} required
        />
        <input
          type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          required minLength={6}
        />
        <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="small" style={{ marginTop: 14 }}>
        {mode === 'signin' ? (
          <>New here? <button className="link" type="button" onClick={() => { setMode('signup'); setNotice(''); }}>Create an account</button></>
        ) : (
          <>Already have one? <button className="link" type="button" onClick={() => { setMode('signin'); setNotice(''); }}>Sign in</button></>
        )}
      </p>
      {notice && <p className="small">{notice}</p>}
      {error && <p className="err">{error}</p>}
    </div>
  );
}

'use client'
import { useEffect, useState } from 'react'

const card = { background: '#fff', border: '1px solid #e5e9e4', borderRadius: 16, padding: 20 }
export default function CustomerPortal() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/portal/me', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok && json.authenticated) setProfile(json)
      else setProfile(null)
    } catch { setProfile(null) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    const finishMagicLink = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const access_token = hash.get('access_token')
      const refresh_token = hash.get('refresh_token')
      const expires_in = hash.get('expires_in')
      if (access_token && refresh_token) {
        setLoading(true); setError('')
        try {
          const res = await fetch('/api/portal/session', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token, refresh_token, expires_in }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || 'Could not verify the sign-in link.')
          window.history.replaceState({}, '', window.location.pathname)
        } catch (e) { setError(e.message) }
      }
      await loadProfile()
    }
    finishMagicLink()
  }, [])

  const sendLink = async e => {
    e.preventDefault(); setSending(true); setMessage(''); setError('')
    try {
      const res = await fetch('/api/portal/send-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Unable to send sign-in link.')
      setMessage(json.message || 'Check your email for a sign-in link.')
    } catch (e) { setError(e.message) }
    finally { setSending(false) }
  }

  const logout = async () => {
    await fetch('/api/portal/logout', { method: 'POST' })
    setProfile(null); setMessage('You have signed out.')
  }

  if (loading) return <main style={{ minHeight: '100vh', background: '#f6f8f5', display: 'grid', placeItems: 'center', padding: 20, color: '#617064', fontFamily: 'Inter, sans-serif' }}>Loading customer portal…</main>

  return <main style={{ minHeight: '100vh', background: '#f6f8f5', padding: 'clamp(16px,4vw,48px)', color: '#1b2a20', fontFamily: 'Inter, sans-serif' }}>
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.04em', marginBottom: 5 }}><span style={{ color: '#7DC242' }}>meraki</span><span style={{ color: '#29ABE2' }}>ads</span> <span style={{ fontSize: 12, color: '#7a867c', fontWeight: 600 }}>CUSTOMER PORTAL</span></div>
      {!profile ? <section style={{ ...card, maxWidth: 440, margin: '9vh auto 0' }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Sign in to your reports</div>
        <div style={{ color: '#6b776d', fontSize: 12, lineHeight: 1.6, marginBottom: 22 }}>Enter the email address invited by your agency. We'll send you a secure, one-time sign-in link.</div>
        <form onSubmit={sendLink}>
          <label htmlFor="portal-email" style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 7, color: '#536056' }}>EMAIL ADDRESS</label>
          <input id="portal-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d7ddd5', borderRadius: 9, padding: 12, fontSize: 14, marginBottom: 12 }}/>
          <button disabled={sending} style={{ width: '100%', border: 0, borderRadius: 9, padding: 12, background: '#233b2c', color: '#fff', fontWeight: 800, cursor: 'pointer', opacity: sending ? .6 : 1 }}>{sending ? 'Sending…' : 'Email me a sign-in link'}</button>
        </form>
        {message && <div role="status" style={{ marginTop: 14, padding: 11, background: '#eef9f1', color: '#166534', borderRadius: 8, fontSize: 12 }}>{message}</div>}
        {error && <div role="alert" style={{ marginTop: 14, padding: 11, background: '#fff3f1', color: '#a22a20', borderRadius: 8, fontSize: 12 }}>{error}</div>}
      </section> : <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '26px 0 18px' }}>
          <div><div style={{ fontSize: 24, fontWeight: 800 }}>Your reporting workspaces</div><div style={{ color: '#6b776d', fontSize: 12, marginTop: 4 }}>{profile.email}</div></div>
          <button onClick={logout} style={{ border: '1px solid #d7ddd5', borderRadius: 9, background: '#fff', padding: '9px 12px', fontWeight: 700, cursor: 'pointer' }}>Sign out</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 14 }}>
          {profile.workspaces.map(w => <section key={w.id} style={card}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{w.client_name}</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', margin: '12px 0' }}>
              <span style={{ fontSize: 10, borderRadius: 99, background: '#eef5ec', color: '#38623a', padding: '5px 8px', fontWeight: 800 }}>{w.role === 'client_admin' ? 'CUSTOMER ADMIN' : 'READ ONLY'}</span>
              <span style={{ fontSize: 10, borderRadius: 99, background: '#f2f4f1', color: '#5c685e', padding: '5px 8px', fontWeight: 800 }}>{w.accounts.length} ACCOUNT(S)</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#68746a', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Assigned advertising accounts</div>
            {w.accounts.length ? w.accounts.map(a => <div key={a.platform + ':' + a.account_id} style={{ borderTop: '1px solid #edf0eb', padding: '10px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{a.name || a.account_id}</div>
              <div style={{ fontSize: 10, color: '#7b857c', marginTop: 3 }}>{a.platform === 'meta' ? 'Meta Ads' : 'Google Ads'} · {a.account_id}{a.currency ? ' · ' + a.currency : ''}</div>
            </div>) : <div style={{ fontSize: 12, color: '#7b857c', padding: '10px 0' }}>No advertising accounts have been assigned yet. Contact your account manager.</div>}
            <div style={{ borderTop: '1px solid #edf0eb', paddingTop: 12, marginTop: 4, fontSize: 11, color: w.crm_access ? '#166534' : '#778177' }}>CRM-qualified lead reports: {w.crm_access ? 'Enabled' : 'Not enabled'}</div>
          </section>)}
        </div>
        <div style={{ marginTop: 18, color: '#7b857c', fontSize: 11 }}>Your login only displays workspaces and ad accounts assigned to your email by the agency.</div>
      </>}
    </div>
  </main>
}

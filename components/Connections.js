import { useEffect, useState } from 'react'

function fmtExpiry(iso) {
  if (!iso) return 'Never expires'
  const days = Math.ceil((new Date(iso) - new Date()) / 86400000)
  if (days < 0) return 'Expired'
  if (days === 0) return 'Expires today'
  return `Expires in ${days}d`
}

export default function ConnectionsPanel({ onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [syncing, setSyncing] = useState({})
  const [togglingId, setTogglingId] = useState(null)
  const [budgetDrafts, setBudgetDrafts] = useState({})
  const [savingBudget, setSavingBudget] = useState(null)

  const saveBudget = async (platform, accountId) => {
    const raw = budgetDrafts[accountId]
    const value = raw === '' || raw === undefined ? null : Number(raw)
    if (value !== null && (isNaN(value) || value < 0)) { alert('Enter a valid budget number'); return }
    setSavingBudget(accountId)
    try {
      await fetch('/api/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, accountId, monthlyBudget: value })
      })
      load()
    } finally {
      setSavingBudget(null)
    }
  }

  const load = () => {
    setLoading(true)
    fetch('/api/connections', { cache: 'no-store' })
      .then(async r => {
        const text = await r.text()
        let d
        try {
          d = JSON.parse(text)
        } catch {
          // Server returned HTML or an empty body — usually a crashed route,
          // most often missing SUPABASE_* env vars on this deployment.
          throw new Error(
            `Server error (HTTP ${r.status}). The /api/connections route didn't return JSON — check that SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in Vercel and that you've redeployed since adding them.`
          )
        }
        setData(d.connections || [])
        setError(d.error || null)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(load, [])

  const disconnect = async (id) => {
    if (!confirm('Disconnect this login? Any accounts it was serving stop refreshing until reconnected.')) return
    await fetch(`/api/connections?id=${id}`, { method: 'DELETE' })
    load()
  }

  const toggleTracked = async (platform, accountId, nextTracked) => {
    setTogglingId(accountId)
    // optimistic update so the checkbox feels instant
    setData(prev => prev.map(conn => ({
      ...conn,
      accounts: conn.accounts.map(a => a.account_id === accountId ? { ...a, is_tracked: nextTracked } : a)
    })))
    try {
      await fetch('/api/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, accountId, tracked: nextTracked })
      })
    } finally {
      setTogglingId(null)
    }
  }

  const syncGoogleAccounts = async (connId) => {
    setSyncing(s => ({ ...s, [connId]: true }))
    try {
      const res = await fetch('/api/connections/sync-google-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connId })
      })
      const d = await res.json()
      if (d.error) alert(d.error)
    } finally {
      setSyncing(s => ({ ...s, [connId]: false }))
      load()
    }
  }

  const resyncMeta = async (connId) => {
    setSyncing(s => ({ ...s, [connId]: true }))
    try {
      const res = await fetch('/api/connections/resync-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connId })
      })
      const d = await res.json()
      if (d.error) alert(d.error)
      else {
        let msg = `Found ${d.synced} ad accounts across ${d.portfolios} business portfolio(s).`
        if (d.warnings?.length) msg += `\n\nSome portfolios returned errors:\n` + d.warnings.join('\n')
        alert(msg)
      }
    } finally {
      setSyncing(s => ({ ...s, [connId]: false }))
      load()
    }
  }

  const connect = (platform) => {
    const returnTo = window.location.pathname
    window.location.href = `/api/auth/${platform}/login?return_to=${encodeURIComponent(returnTo)}`
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(20,20,20,.45)', zIndex: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div
        style={{
          background: '#fff', borderRadius: 14, width: 600, maxWidth: '92vw',
          maxHeight: '82vh', overflowY: 'auto', padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,.25)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#222' }}>Connections &amp; Accounts</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#999' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 18 }}>
          Connect a Meta or Google Ads login to see every account it manages, then check the ones you want to show in the dashboard. Connecting doesn't turn anything on by itself — you pick what's tracked, here, any time.
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => connect('meta')} style={btnPrimary}>+ Connect Meta</button>
          <button onClick={() => connect('google-ads')} style={btnSecondary}>+ Connect Google Ads</button>
        </div>

        {loading && <div style={{ fontSize: 13, color: '#999' }}>Loading connections…</div>}
        {error && <div style={{ fontSize: 12, color: '#e05252', marginBottom: 10 }}>Error: {error}</div>}

        {!loading && data && data.length === 0 && (
          <div style={{ fontSize: 13, color: '#999', padding: '20px 0', textAlign: 'center' }}>
            Nothing connected yet — click "Connect Meta" or "Connect Google Ads" above to get started.
          </div>
        )}

        {!loading && data && ['meta','google_ads'].map(platform => {
          const conns = data.filter(c => c.platform === platform)
          const label = platform === 'meta' ? '📘 Meta' : '🔍 Google Ads'
          return (
            <div key={platform} style={{ marginBottom: 18 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#666', textTransform: 'uppercase',
                letterSpacing: '.06em', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #eee'
              }}>
                {label} — {conns.length} login{conns.length === 1 ? '' : 's'}
              </div>
              {conns.length === 0 && (
                <div style={{ fontSize: 12, color: '#aaa', padding: '8px 0' }}>
                  No {platform === 'meta' ? 'Meta' : 'Google Ads'} login connected yet.
                </div>
              )}
              {conns.map(conn => {
          const trackedCount = (conn.accounts || []).filter(a => a.is_tracked).length
          return (
          <div key={conn.id} style={{
            border: '1px solid #eee', borderRadius: 10, padding: 14, marginBottom: 10,
            opacity: conn.is_active ? 1 : 0.5
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#222' }}>
                  {conn.platform === 'meta' ? '📘 Meta' : '🔍 Google Ads'} · {conn.provider_user_name || 'Unknown'}
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                  Connected {conn.connected_by ? `by ${conn.connected_by} ` : ''}
                  {new Date(conn.connected_at).toLocaleDateString('en-IN')} · {fmtExpiry(conn.token_expires_at)}
                  {conn.accounts?.length > 0 && ` · ${trackedCount}/${conn.accounts.length} tracked`}
                </div>
              </div>
              {conn.is_active && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {conn.platform === 'meta' && (
                    <button
                      onClick={() => resyncMeta(conn.id)}
                      disabled={syncing[conn.id]}
                      style={{ ...btnSecondary, flex: 'none', padding: '5px 10px', fontSize: 11 }}
                      title="Re-scan this login's business portfolios for newly added ad accounts"
                    >
                      {syncing[conn.id] ? 'Scanning…' : '↻ Re-sync'}
                    </button>
                  )}
                  <button onClick={() => disconnect(conn.id)} style={btnDanger}>Disconnect</button>
                </div>
              )}
            </div>

            {conn.accounts?.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {conn.accounts.map(a => (
                  <div key={a.account_id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px',
                    borderRadius: 6, opacity: togglingId === a.account_id ? 0.6 : 1
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, cursor: conn.is_active ? 'pointer' : 'not-allowed' }}>
                      <input
                        type="checkbox"
                        checked={!!a.is_tracked}
                        disabled={!conn.is_active}
                        onChange={e => toggleTracked(a.platform, a.account_id, e.target.checked)}
                      />
                      <span style={{ fontSize: 12, color: '#333' }}>{a.account_name || a.account_id}</span>
                      {a.currency && <span style={{ fontSize: 10, color: '#aaa' }}>({a.currency})</span>}
                      {a.business_name && (
                        <span style={{ fontSize: 10, color: '#bbb' }} title={`Business portfolio: ${a.business_name}`}>
                          · {a.business_name}
                        </span>
                      )}
                    </label>
                    {a.is_tracked && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: '#999' }}>Budget</span>
                        <input
                          type="number"
                          placeholder={a.monthly_budget != null ? String(a.monthly_budget) : 'not set'}
                          value={budgetDrafts[a.account_id] ?? ''}
                          onChange={e => setBudgetDrafts(d => ({ ...d, [a.account_id]: e.target.value }))}
                          onBlur={() => budgetDrafts[a.account_id] !== undefined && budgetDrafts[a.account_id] !== '' && saveBudget(a.platform, a.account_id)}
                          onKeyDown={e => e.key === 'Enter' && saveBudget(a.platform, a.account_id)}
                          style={{ width: 90, fontSize: 11, padding: '3px 6px', borderRadius: 5, border: '1px solid #ddd' }}
                        />
                        {savingBudget === a.account_id && <span style={{ fontSize: 10, color: '#999' }}>saving…</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {conn.accounts?.length === 0 && conn.platform === 'google_ads' && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => syncGoogleAccounts(conn.id)}
                  disabled={syncing[conn.id]}
                  style={{ ...btnSecondary, flex: 'none', padding: '5px 10px', fontSize: 11 }}
                >
                  {syncing[conn.id] ? 'Syncing…' : '↻ Sync accounts'}
                </button>
                <span style={{ fontSize: 11, color: '#c67139' }}>
                  Requires GOOGLE_ADS_DEVELOPER_TOKEN to be set
                </span>
              </div>
            )}
          </div>
        )})}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const btnPrimary = {
  flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none',
  background: '#1877F2', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer'
}
const btnSecondary = {
  flex: 1, padding: '9px 14px', borderRadius: 8, border: '1px solid #ddd',
  background: '#fff', color: '#333', fontSize: 12, fontWeight: 600, cursor: 'pointer'
}
const btnDanger = {
  padding: '5px 10px', borderRadius: 6, border: '1px solid #f0d0d0',
  background: '#fff', color: '#e05252', fontSize: 11, fontWeight: 600, cursor: 'pointer'
}

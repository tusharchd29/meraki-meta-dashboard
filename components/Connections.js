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

  const load = () => {
    setLoading(true)
    fetch('/api/connections')
      .then(r => r.json())
      .then(d => { setData(d.connections || []); setError(d.error || null); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(load, [])

  const disconnect = async (id) => {
    if (!confirm('Disconnect this login? Reports using its accounts will stop refreshing until reconnected.')) return
    await fetch(`/api/connections?id=${id}`, { method: 'DELETE' })
    load()
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
          background: '#fff', borderRadius: 14, width: 560, maxWidth: '92vw',
          maxHeight: '82vh', overflowY: 'auto', padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,.25)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#222' }}>Connected Ad Accounts</div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#999' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 18 }}>
          Connect a Meta or Google Ads login once — the dashboard keeps every ad account it can see, and refreshes tokens automatically instead of expiring.
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => connect('meta')} style={btnPrimary}>+ Connect Meta</button>
          <button onClick={() => connect('google-ads')} style={btnSecondary}>+ Connect Google Ads</button>
        </div>

        {loading && <div style={{ fontSize: 13, color: '#999' }}>Loading connections…</div>}
        {error && <div style={{ fontSize: 12, color: '#e05252', marginBottom: 10 }}>Error: {error}</div>}

        {!loading && data && data.length === 0 && (
          <div style={{ fontSize: 13, color: '#999', padding: '20px 0', textAlign: 'center' }}>
            No accounts connected yet.
          </div>
        )}

        {!loading && data && data.map(conn => (
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
                </div>
              </div>
              {conn.is_active && (
                <button onClick={() => disconnect(conn.id)} style={btnDanger}>Disconnect</button>
              )}
            </div>
            {conn.accounts?.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {conn.accounts.map(a => (
                  <span key={a.account_id} style={{
                    fontSize: 11, background: '#f5f5f5', borderRadius: 6, padding: '3px 8px', color: '#555'
                  }}>
                    {a.account_name || a.account_id}
                  </span>
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
        ))}
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

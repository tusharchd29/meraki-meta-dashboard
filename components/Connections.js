import { useEffect, useState } from 'react'

function fmtExpiry(iso) {
  // token_expires_at tracks the short-lived ACCESS token (Google issues
  // these valid ~1hr), not the connection itself. The refresh token that
  // actually keeps this connection alive is stored separately and never
  // expires — it silently mints a new access token (and bumps this
  // timestamp) every time a sync runs. Showing a "days left" countdown on
  // the access token's expiry reads as an imminent disconnection warning
  // when it isn't one, so this just reflects when it was last refreshed.
  // Rendered after "Connected ..." in the parent, so no "Connected" prefix here.
  if (!iso) return 'auto-refreshing'
  const hours = Math.round((new Date() - new Date(iso)) / 3600000)
  if (hours < 1) return 'access refreshed moments ago'
  if (hours < 48) return `access refreshed ${hours}h ago`
  const days = Math.round(hours / 24)
  return `access refreshed ${days}d ago`
}

// Groups an already-visible (non-hidden) account list by the Business
// Manager it came from, so 30+ accounts from several unrelated portfolios
// don't read as one undifferentiated wall of names. Accounts with no
// business_name (directly-assigned) land in a final "Direct access" bucket.
function groupByBusiness(accounts) {
  const groups = new Map()
  for (const a of accounts) {
    const key = a.business_name || 'Direct access'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(a)
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
}

export default function ConnectionsPanel({ onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [syncing, setSyncing] = useState({})
  const [togglingId, setTogglingId] = useState(null)
  const [budgetDrafts, setBudgetDrafts] = useState({})
  const [savingBudget, setSavingBudget] = useState(null)
  // Nothing renders until you deliberately open a connection's list — the
  // list itself, and the "show removed" sub-list, both start collapsed.
  const [expandedConn, setExpandedConn] = useState({})
  const [showHidden, setShowHidden] = useState({})

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

  // Removing isn't the same as unchecking — it drops the account off this
  // list entirely (it won't reappear on the next Re-sync either) until
  // deliberately restored. The confirm text spells out exactly what
  // restoring will and won't do, since that was the whole point of asking.
  const hideAccount = async (a) => {
    const ok = confirm(
      `Remove "${a.account_name || a.account_id}" from this list?\n\n` +
      `It disappears from Connections & Accounts immediately and won't come back on Re-sync.\n\n` +
      `To bring it back later: open "Show removed" at the bottom of this Business Manager's ` +
      `group, click Restore — then re-check "Track" and re-enter its budget, since neither ` +
      `carries over automatically.`
    )
    if (!ok) return
    setTogglingId(a.account_id)
    try {
      await fetch('/api/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: a.platform, accountId: a.account_id, hidden: true })
      })
      load()
    } finally {
      setTogglingId(null)
    }
  }

  const restoreAccount = async (a) => {
    setTogglingId(a.account_id)
    try {
      await fetch('/api/connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: a.platform, accountId: a.account_id, hidden: false })
      })
      load()
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
      // Don't assume the body is JSON — a non-JSON response (platform error
      // page, timeout, etc.) previously threw a cryptic "Unexpected token"
      // parse error instead of a readable message.
      const raw = await res.text()
      let d
      try {
        d = JSON.parse(raw)
      } catch {
        alert(`Sync failed with an unexpected server response (status ${res.status}). Check Vercel logs for details.`)
        return
      }
      if (d.error) alert(d.error)
      else {
        let msg = `Found ${d.synced} client ad account(s).`
        // Surfaces when the MCC has sub-manager accounts nested under it —
        // those are walked automatically now, just not tracked themselves
        // since they don't run campaigns directly.
        if (d.managerAccountsSkipped > 0) {
          msg += ` (Also found ${d.managerAccountsSkipped} sub-manager account(s) under your MCC — their client accounts underneath were included automatically.)`
        }
        alert(msg)
      }
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
          Connect a Meta or Google Ads login to see every account it manages, then check the ones you
          want to show in the dashboard. Connecting doesn't turn anything on by itself — you pick what's
          tracked, here, any time. The account list for a login stays collapsed until you open it.
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <button onClick={() => connect('meta')} style={btnPrimary}>+ Connect Meta</button>
          <button onClick={() => connect('google-ads')} style={btnSecondary}>+ Connect Google Ads</button>
        </div>
        <div style={{ fontSize: 11, color: '#c67139', marginBottom: 18 }}>
          Google spend is currently imported manually on the Clients (Blended) tab.
          Connecting here won't pull any data yet — that needs GOOGLE_ADS_DEVELOPER_TOKEN,
          which Google approves separately. Safe to connect early, it just won't do anything until then.
          Once it's set, "Sync accounts" walks your entire Manager (MCC) account tree automatically —
          including any nested sub-manager accounts — so every client account underneath gets found,
          not just the ones visible one login at a time in the Google Ads website.
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
          const visible = (conn.accounts || []).filter(a => !a.is_hidden)
          const hiddenAccounts = (conn.accounts || []).filter(a => a.is_hidden)
          const trackedCount = visible.filter(a => a.is_tracked).length
          const isOpen = !!expandedConn[conn.id]
          const isHiddenOpen = !!showHidden[conn.id]
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
                  {visible.length > 0 && ` · ${trackedCount}/${visible.length} tracked`}
                  {hiddenAccounts.length > 0 && ` · ${hiddenAccounts.length} removed`}
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

            {visible.length > 0 && (
              <button
                onClick={() => setExpandedConn(s => ({ ...s, [conn.id]: !s[conn.id] }))}
                style={{ ...btnSecondary, flex: 'none', width: '100%', marginTop: 10, padding: '7px 10px', fontSize: 11.5 }}
              >
                {isOpen ? '▲ Hide account list' : `▼ View accounts (${visible.length})`}
              </button>
            )}

            {isOpen && visible.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {groupByBusiness(visible).map(([businessName, group]) => (
                  <div key={businessName}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                      {businessName} · {group.length}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {group.map(a => (
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
                          <button
                            onClick={() => hideAccount(a)}
                            title="Remove from this list permanently (until restored)"
                            style={{ border: 'none', background: 'none', color: '#c9a', fontSize: 10.5, cursor: 'pointer', padding: '2px 4px', flex: 'none' }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {hiddenAccounts.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowHidden(s => ({ ...s, [conn.id]: !s[conn.id] }))}
                      style={{ border: 'none', background: 'none', color: '#999', fontSize: 11, cursor: 'pointer', padding: '2px 0', textDecoration: 'underline' }}
                    >
                      {isHiddenOpen ? '▲ Hide removed accounts' : `${hiddenAccounts.length} removed — show`}
                    </button>
                    {isHiddenOpen && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                        {hiddenAccounts.map(a => (
                          <div key={a.account_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', opacity: togglingId === a.account_id ? 0.6 : 1 }}>
                            <span style={{ fontSize: 12, color: '#aaa', flex: 1 }}>{a.account_name || a.account_id}</span>
                            <button
                              onClick={() => restoreAccount(a)}
                              style={{ border: '1px solid #ddd', background: '#fff', color: '#333', fontSize: 10.5, cursor: 'pointer', padding: '3px 8px', borderRadius: 5, flex: 'none' }}
                            >
                              Restore
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {visible.length === 0 && conn.platform === 'google_ads' && (
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

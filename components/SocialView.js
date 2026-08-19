'use client'
import { useEffect, useState } from 'react'

function lastMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 0)
  const iso = (d) => d.toISOString().split('T')[0]
  return { start: iso(start), end: iso(end) }
}

export default function SocialView() {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(lastMonthRange())
  const [busy, setBusy] = useState({})

  const load = () => {
    setLoading(true)
    fetch('/api/social/pages')
      .then((r) => r.json())
      .then((d) => setPages(d.pages || []))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const setClientName = async (page_id, client_name) => {
    await fetch('/api/social/pages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_id, client_name }),
    })
    load()
  }

  const fetchData = async (page_id) => {
    setBusy((b) => ({ ...b, [page_id]: 'fetching' }))
    try {
      const res = await fetch('/api/social/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id, period_start: range.start, period_end: range.end }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setBusy((b) => ({ ...b, [page_id]: 'ready' }))
    } catch (e) {
      setBusy((b) => ({ ...b, [page_id]: 'error' }))
      alert(e.message)
    }
  }

  const downloadReport = (page_id) => {
    window.open(`/api/social/report?page_id=${page_id}&start=${range.start}&end=${range.end}`, '_blank')
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Instagram &amp; Facebook organic performance reports — separate, read-only Meta connection from the ads accounts above.
      </p>

      <a
        href="/api/auth/meta-social/login?return_to=/"
        style={{
          display: 'inline-block', padding: '8px 14px', background: 'var(--green-dk)', color: '#fff',
          borderRadius: 6, textDecoration: 'none', fontSize: 13, marginBottom: 20,
        }}
      >
        Connect Facebook Page / Instagram
      </a>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, fontSize: 13 }}>
        <label style={{ color: 'var(--text3)' }}>
          Window:&nbsp;
          <input type="date" value={range.start} onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))} />
        </label>
        <span>–</span>
        <input type="date" value={range.end} onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))} />
      </div>

      {loading ? (
        <div style={{ color: 'var(--text3)' }}>Loading connected pages…</div>
      ) : pages.length === 0 ? (
        <div style={{ color: 'var(--text3)' }}>No Pages connected yet. Click "Connect Facebook Page / Instagram" above.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text3)' }}>
                <th style={{ padding: 8 }}>Page</th>
                <th style={{ padding: 8 }}>Instagram</th>
                <th style={{ padding: 8 }}>Client name</th>
                <th style={{ padding: 8 }}>Last synced</th>
                <th style={{ padding: 8 }}></th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.page_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 8 }}>{p.page_name}</td>
                  <td style={{ padding: 8 }}>
                    {p.ig_username ? `@${p.ig_username}` : <span style={{ color: 'var(--text3)' }}>not linked</span>}
                  </td>
                  <td style={{ padding: 8 }}>
                    <input
                      defaultValue={p.client_name || ''}
                      placeholder="e.g. Pratha Pre-School"
                      onBlur={(e) => e.target.value !== (p.client_name || '') && setClientName(p.page_id, e.target.value)}
                      style={{ fontSize: 12, padding: '4px 6px', width: 150 }}
                    />
                  </td>
                  <td style={{ padding: 8, color: 'var(--text3)' }}>
                    {p.synced_at ? new Date(p.synced_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: 8, display: 'flex', gap: 6 }}>
                    <button className="ar-btn" onClick={() => fetchData(p.page_id)} disabled={busy[p.page_id] === 'fetching'}>
                      {busy[p.page_id] === 'fetching' ? 'Fetching…' : 'Fetch data'}
                    </button>
                    <button className="ar-btn" onClick={() => downloadReport(p.page_id)}>Download report</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

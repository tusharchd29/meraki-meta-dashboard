'use client'
import { useEffect, useState } from 'react'

export default function ReportRecipients() {
  const [recipients, setRecipients] = useState(null)
  const [error, setError] = useState(null)
  const [newEmail, setNewEmail] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const load = () => {
    fetch('/api/report-recipients', { cache: 'no-store' })
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
        setRecipients(d.recipients || [])
        setError(null)
      })
      .catch(e => setError(e.message))
  }
  useEffect(load, [])

  const add = async () => {
    if (!newEmail.trim()) return
    setAdding(true)
    try {
      const res = await fetch('/api/report-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim(), label: newLabel.trim() || null, weekly: true, monthly: true }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to add')
      setNewEmail(''); setNewLabel('')
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setAdding(false)
    }
  }

  const toggle = async (id, field, value) => {
    setBusyId(id)
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r)) // optimistic
    try {
      await fetch('/api/report-recipients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value }),
      })
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id) => {
    if (!confirm('Remove this recipient? They will stop receiving weekly and monthly reports.')) return
    setBusyId(id)
    try {
      await fetch(`/api/report-recipients?id=${id}`, { method: 'DELETE' })
      load()
    } finally {
      setBusyId(null)
    }
  }

  const tableMissing = error && /does not exist|42P01|could not find the table|schema cache/i.test(error)
  if (tableMissing) {
    return (
      <div style={{ fontSize: 11.5, color: 'var(--amber)', padding: '10px 14px', background: 'var(--amber-lt)', border: '1.5px solid var(--amber-bd)', borderRadius: 8 }}>
        Recipients table not set up yet — run <code>supabase/migrations/20260727_report_recipients.sql</code> against
        the project's Supabase database once, then reload this tab.
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14,
      padding: '18px 20px', maxWidth: 560, marginTop: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
        Report Recipients
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.5 }}>
        Who gets emailed. Toggle Weekly / Monthly per person — someone can be on one list and not the other.
      </div>

      {error && !error.includes('does not exist') && (
        <div style={{ fontSize: 11.5, color: 'var(--red)', marginBottom: 10 }}>{error}</div>
      )}

      {recipients === null && !error ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
          {(recipients || []).length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>No recipients yet — reports won't be emailed until you add one.</div>
          )}
          {(recipients || []).map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px',
              borderRadius: 8, background: 'var(--bg)', opacity: busyId === r.id ? 0.6 : 1,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.email}
                </div>
                {r.label && <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{r.label}</div>}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={!!r.weekly} onChange={e => toggle(r.id, 'weekly', e.target.checked)} disabled={busyId === r.id} />
                Weekly
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={!!r.monthly} onChange={e => toggle(r.id, 'monthly', e.target.checked)} disabled={busyId === r.id} />
                Monthly
              </label>
              <button
                onClick={() => remove(r.id)}
                disabled={busyId === r.id}
                style={{ border: 'none', background: 'none', color: 'var(--red)', fontSize: 11, cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input
          type="email" placeholder="email@example.com" value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          style={{ flex: '1 1 180px', padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border-md)', background: 'var(--bg)', fontSize: 12.5 }}
        />
        <input
          type="text" placeholder="Name (optional)" value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          style={{ flex: '1 1 120px', padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border-md)', background: 'var(--bg)', fontSize: 12.5 }}
        />
        <button
          onClick={add}
          disabled={adding || !newEmail.trim()}
          className="refresh-btn"
          style={{ opacity: (adding || !newEmail.trim()) ? 0.5 : 1 }}
        >
          {adding ? 'Adding…' : '+ Add'}
        </button>
      </div>
    </div>
  )
}

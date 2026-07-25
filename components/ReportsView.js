'use client'
import { useState } from 'react'

function defaultMonthValue() {
  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
}

function monthLabelFromValue(v) {
  if (!v) return ''
  const [y, m] = v.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

export default function ReportsView() {
  const [month, setMonth] = useState(defaultMonthValue())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const generate = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/monthly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Report generation failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const openPdf = () => {
    if (!result?.pdfBase64) return
    const byteChars = atob(result.pdfBase64)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    window.open(URL.createObjectURL(blob), '_blank', 'noopener')
  }

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">
          <span style={{ fontFamily: 'Dancing Script, cursive', fontWeight: 700, fontSize: 20, marginRight: 8 }}>
            <span style={{ color: 'var(--green)' }}>meraki</span><span style={{ color: 'var(--blue)' }}>ads</span>
          </span>
          Monthly Campaign Report
        </div>
      </div>

      <div style={{
        background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14,
        padding: '20px 22px', maxWidth: 520, position: 'relative', overflow: 'hidden',
      }}>
        <svg viewBox="0 0 200 300" style={{ position: 'absolute', top: -30, right: -40, width: 160, opacity: 0.05, fill: 'var(--green)', transform: 'rotate(12deg)' }}>
          <path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z" />
        </svg>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>
            Generates a per-client PDF — allocated budget vs. spent vs. pacing, plus Meta and
            Google campaign detail — and emails it to the usual recipients. Pick any completed month.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Month</label>
            <input
              type="month"
              value={month}
              max={defaultMonthValue()}
              onChange={e => setMonth(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border-md)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', color: 'var(--text)' }}
            />
          </div>

          <button
            onClick={generate}
            disabled={loading}
            style={{
              padding: '10px 22px', borderRadius: 9, border: 'none',
              background: loading ? 'var(--border-md)' : 'var(--green)',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {loading && <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />}
            {loading ? 'Generating…' : `Generate & Email — ${monthLabelFromValue(month)}`}
          </button>

          {error && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'var(--red-lt)', border: '1.5px solid var(--red-bd)', fontSize: 12.5, color: 'var(--red)' }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 8, background: 'var(--green-lt)', border: '1.5px solid var(--green-bd)' }}>
              <div style={{ fontSize: 12.5, color: 'var(--green-dk)', fontWeight: 600, marginBottom: 6 }}>
                ✓ Report ready for {result.label} — {result.clients} clients
                {result.overBudgetCount > 0 && `, ${result.overBudgetCount} over budget`}
              </div>
              <div style={{ fontSize: 11.5, color: result.emailed ? 'var(--text3)' : 'var(--amber)', marginBottom: 10 }}>
                {result.emailed ? 'Emailed to tusharchd29@gmail.com and heena@merakiads.in.' : `Not emailed${result.emailError ? `: ${result.emailError}` : ' (mail not configured).'}`}
              </div>
              <button
                onClick={openPdf}
                style={{ padding: '6px 16px', borderRadius: 7, border: '1.5px solid var(--green-bd)', background: '#fff', color: 'var(--green-dk)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Open PDF →
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

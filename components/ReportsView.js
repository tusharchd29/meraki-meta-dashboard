'use client'
import { useState } from 'react'
import ReportRecipients from './ReportRecipients'

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

const SHORT_DATE = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''

// Mirrors lib/monthlyReport.js's lastWeekBounds() — display only, the
// server recomputes this itself rather than trusting a client-sent range.
function lastWeekLabel() {
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const dayOfWeek = (ist.getDay() + 6) % 7
  const thisMonday = new Date(ist.getFullYear(), ist.getMonth(), ist.getDate() - dayOfWeek)
  const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7)
  const lastSunday = new Date(thisMonday); lastSunday.setDate(lastSunday.getDate() - 1)
  return `${lastMonday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${lastSunday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export default function ReportsView() {
  const [mode, setMode] = useState('month') // 'month' | 'week' | 'range'
  const [month, setMonth] = useState(defaultMonthValue())
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [generating, setGenerating] = useState(false)
  const [emailing, setEmailing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [emailStatus, setEmailStatus] = useState(null) // { emailed, emailError, recipients } | null

  const todayStr = new Date().toISOString().split('T')[0]

  const requestBody = () => {
    if (mode === 'week') return { mode: 'week' }
    if (mode === 'range') return { mode: 'range', start: rangeFrom, end: rangeTo }
    return { mode: 'month', month }
  }

  const generateLabel = () => {
    if (generating) return 'Generating…'
    if (mode === 'week') return `Generate — Last Week (${lastWeekLabel()})`
    if (mode === 'range') return rangeFrom && rangeTo ? `Generate — ${SHORT_DATE(rangeFrom)} – ${SHORT_DATE(rangeTo)}` : 'Generate — pick a range'
    return `Generate — ${monthLabelFromValue(month)}`
  }

  const canGenerate = mode !== 'range' || (rangeFrom && rangeTo && rangeFrom <= rangeTo)

  const generate = async () => {
    if (!canGenerate) return
    setGenerating(true); setError(null); setResult(null); setEmailStatus(null)
    try {
      const res = await fetch('/api/monthly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody()),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Report generation failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const emailReport = async () => {
    if (!result?.pdfBase64) return
    setEmailing(true); setEmailStatus(null)
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: result.start,
          end: result.end,
          label: result.label,
          pdfBase64: result.pdfBase64,
          clients: result.clients,
          overBudgetCount: result.overBudgetCount,
          kind: mode === 'week' ? 'weekly' : 'monthly',
        }),
      })
      const data = await res.json()
      setEmailStatus({ emailed: !!data.emailed, emailError: data.ok ? null : data.error, recipients: data.recipients || [] })
    } catch (e) {
      setEmailStatus({ emailed: false, emailError: e.message })
    } finally {
      setEmailing(false)
    }
  }

  const openPdf = () => {
    if (!result?.pdfBase64) return
    const byteChars = atob(result.pdfBase64)
    const bytes = new Uint8Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    // A blob: URL has no real filename, so window.open() would save as a
    // generic "download.pdf". Route it through a hidden <a download> instead
    // so the file gets the correct name however it's saved.
    const a = document.createElement('a')
    a.href = url
    a.download = result.fileName || 'Meraki PPC Report.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const modeBtn = (key, label) => (
    <button
      onClick={() => { setMode(key); setResult(null); setError(null); setEmailStatus(null) }}
      style={{
        padding: '6px 14px', borderRadius: 8, border: '1.5px solid ' + (mode === key ? 'var(--green)' : 'var(--border-md)'),
        background: mode === key ? 'var(--green)' : 'transparent',
        color: mode === key ? '#fff' : 'var(--text2)',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="sec-hdr">
        <div className="sec-ttl">
          <span style={{ fontFamily: 'Dancing Script, cursive', fontWeight: 700, fontSize: 20, marginRight: 8 }}>
            <span style={{ color: 'var(--green)' }}>meraki</span><span style={{ color: 'var(--blue)' }}>ads</span>
          </span>
          Campaign Report
        </div>
      </div>

      <div style={{
        background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 14,
        padding: '20px 22px', maxWidth: 560, position: 'relative', overflow: 'hidden',
      }}>
        <svg viewBox="0 0 200 300" style={{ position: 'absolute', top: -30, right: -40, width: 160, opacity: 0.05, fill: 'var(--green)', transform: 'rotate(12deg)' }}>
          <path d="M100 0C60 20 10 60 5 120S40 240 100 280c60-40 100-100 95-160S140 20 100 0zm0 30c-30 20-70 60-72 110l27-30c-5 30-3 60 10 85l15-35c-2 25 8 50 20 65 12-15 22-40 20-65l15 35c13-25 15-55 10-85l27 30C173 90 130 50 100 30z" />
        </svg>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 14, lineHeight: 1.6 }}>
            Generates a per-client PDF — allocated budget vs. spent vs. pacing, plus Meta and
            Google campaign detail. Includes every account checked "Track" in Connections
            automatically, using the budget set there — no separate mapping needed. Map an
            account in Clients (Blended) only if you want a custom name, a different budget
            for the report, or to blend its Meta + Google spend into one client.
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {modeBtn('month', 'Month')}
            {modeBtn('week', 'Last Week')}
            {modeBtn('range', 'Custom Range')}
          </div>

          {mode === 'month' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Month</label>
              <input
                type="month"
                value={month}
                max={defaultMonthValue()}
                onChange={e => { setMonth(e.target.value); setResult(null); setEmailStatus(null) }}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border-md)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', color: 'var(--text)' }}
              />
            </div>
          )}

          {mode === 'week' && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>
              Always the most recently completed Monday–Sunday: <b style={{ color: 'var(--text2)' }}>{lastWeekLabel()}</b>.
              This is also what the automatic Monday email sends.
            </div>
          )}

          {mode === 'range' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>From</label>
              <input
                type="date" value={rangeFrom} max={rangeTo || todayStr}
                onChange={e => { setRangeFrom(e.target.value); setResult(null); setEmailStatus(null) }}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border-md)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', color: 'var(--text)' }}
              />
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>To</label>
              <input
                type="date" value={rangeTo} min={rangeFrom} max={todayStr}
                onChange={e => { setRangeTo(e.target.value); setResult(null); setEmailStatus(null) }}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border-md)', background: 'var(--bg)', fontSize: 13, fontFamily: 'inherit', color: 'var(--text)' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={generate}
              disabled={generating || !canGenerate}
              style={{
                padding: '10px 22px', borderRadius: 9, border: 'none',
                background: (generating || !canGenerate) ? 'var(--border-md)' : 'var(--green)',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: (generating || !canGenerate) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {generating && <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />}
              {generateLabel()}
            </button>

            <button
              onClick={emailReport}
              disabled={!result?.pdfBase64 || emailing}
              title={!result?.pdfBase64 ? 'Generate a report first' : undefined}
              style={{
                padding: '10px 22px', borderRadius: 9, border: '1.5px solid var(--blue)',
                background: !result?.pdfBase64 ? 'var(--border-md)' : (emailing ? 'var(--border-md)' : '#fff'),
                color: !result?.pdfBase64 ? 'var(--text3)' : 'var(--blue)',
                fontSize: 13, fontWeight: 700,
                cursor: (!result?.pdfBase64 || emailing) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {emailing && <span style={{ width: 13, height: 13, border: '2px solid rgba(41,171,226,.4)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />}
              {emailing ? 'Emailing…' : 'Email Report'}
            </button>
          </div>

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

              {emailStatus && (
                <div style={{ fontSize: 11.5, color: emailStatus.emailed ? 'var(--text3)' : 'var(--amber)', marginBottom: 10 }}>
                  {emailStatus.emailed
                    ? `Emailed to ${emailStatus.recipients?.join(', ') || 'configured recipients'}.`
                    : `Not emailed${emailStatus.emailError ? `: ${emailStatus.emailError}` : '.'}`}
                </div>
              )}

              <button
                onClick={openPdf}
                style={{ padding: '6px 16px', borderRadius: 7, border: '1.5px solid var(--green-bd)', background: '#fff', color: 'var(--green-dk)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Download PDF →
              </button>
            </div>
          )}
        </div>
      </div>

      <ReportRecipients />

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

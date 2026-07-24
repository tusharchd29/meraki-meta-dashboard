import { useState, useEffect } from 'react'

export default function GoogleImport({ onImported }) {
  const [file, setFile] = useState(null)
  const [fileText, setFileText] = useState('')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [fallbackDate, setFallbackDate] = useState('')
  const [history, setHistory] = useState([])

  const loadHistory = () => {
    fetch('/api/google-import', { cache:'no-store' })
      .then(r=>r.json()).then(d=>setHistory(d.imports||[])).catch(()=>{})
  }
  useEffect(loadHistory, [])

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setPreview(null); setError(null)
    const text = await f.text()
    setFileText(text)
    runPreview(text, f.name)
  }

  const runPreview = async (text, name, dateOverride) => {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/google-import', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ fileText: text, filename: name, preview: true, fallbackDate: dateOverride || fallbackDate || null })
      })
      const d = await res.json()
      if (d.error && !d.rows_parsed) setError(d.error + (d.warnings?.length ? ' — ' + d.warnings.join(' ') : ''))
      setPreview(d)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const commit = async () => {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/google-import', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ fileText, filename: file?.name, preview: false, fallbackDate: fallbackDate || null })
      })
      const d = await res.json()
      if (d.error) setError(d.error)
      else {
        setPreview(null); setFile(null); setFileText('')
        loadHistory()
        onImported && onImported()
        alert(`Imported ${d.rows_written} rows covering ${d.date_from} to ${d.date_to} across ${d.accounts_seen} account(s).`)
      }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div style={{border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:16}}>
      <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>Import Google Ads export</div>
      <div style={{fontSize:11, color:'var(--text3)', marginBottom:10}}>
        Export from Google Ads Manager as CSV, then upload here. Re-importing overlapping dates corrects
        existing figures rather than double-counting, so it's safe to upload ranges that overlap a previous file.
      </div>

      <input type="file" accept=".csv,.tsv,.txt" onChange={onFile} style={{fontSize:12}}/>

      {busy && <div style={{fontSize:11, color:'var(--text3)', marginTop:8}}>Working…</div>}
      {error && <div style={{fontSize:11, color:'var(--red)', marginTop:8}}>{error}</div>}

      {preview && preview.rows_parsed > 0 && (
        <div style={{marginTop:12, background:'rgba(0,0,0,.03)', borderRadius:8, padding:12}}>
          <div style={{fontSize:12, fontWeight:600, marginBottom:6}}>Preview — nothing saved yet</div>
          <div style={{fontSize:11, lineHeight:1.7}}>
            Rows parsed: <b>{preview.rows_parsed}</b> · importable: <b>{preview.rows_importable}</b>
            {preview.rows_unusable > 0 && <> · unusable: <b style={{color:'var(--amber)'}}>{preview.rows_unusable}</b></>}<br/>
            Date range: <b>{preview.date_from || '—'}</b> to <b>{preview.date_to || '—'}</b> · accounts: <b>{preview.accounts_seen}</b>
          </div>

          {preview.rows_unusable > 0 && (
            <div style={{marginTop:8}}>
              <div style={{fontSize:11, marginBottom:4}}>
                Some rows have no date. If this export covers a single day, set it here:
              </div>
              <input
                type="date"
                value={fallbackDate}
                onChange={e=>{ setFallbackDate(e.target.value); runPreview(fileText, file?.name, e.target.value) }}
                style={{fontSize:11, padding:'3px 6px'}}
              />
            </div>
          )}

          {preview.warnings?.length > 0 && (
            <ul style={{fontSize:11, color:'var(--amber)', marginTop:8, paddingLeft:16}}>
              {preview.warnings.map((w,i)=><li key={i}>{w}</li>)}
            </ul>
          )}

          {preview.sample?.length > 0 && (
            <div style={{marginTop:8, overflowX:'auto'}}>
              <table style={{fontSize:10, borderCollapse:'collapse', width:'100%'}}>
                <thead><tr>{['Customer','Account','Date','Cost'].map(h=>(
                  <th key={h} style={{textAlign:'left', padding:'3px 6px', color:'var(--text3)'}}>{h}</th>
                ))}</tr></thead>
                <tbody>
                  {preview.sample.map((r,i)=>(
                    <tr key={i}>
                      <td style={{padding:'3px 6px'}}>{r.customer_id}</td>
                      <td style={{padding:'3px 6px'}}>{r.account_name}</td>
                      <td style={{padding:'3px 6px'}}>{r.spend_date}</td>
                      <td style={{padding:'3px 6px'}}>{r.cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={commit}
            disabled={busy || preview.rows_importable === 0}
            className="refresh-btn"
            style={{marginTop:10, opacity: preview.rows_importable === 0 ? .5 : 1}}
          >
            Import {preview.rows_importable} rows
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div style={{marginTop:12}}>
          <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:4}}>Recent imports</div>
          {history.slice(0,5).map(h=>(
            <div key={h.id} style={{fontSize:10, color:'var(--text3)'}}>
              {new Date(h.imported_at).toLocaleString('en-IN')} · {h.filename || 'file'} · {h.rows_written} rows · {h.date_from} → {h.date_to}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

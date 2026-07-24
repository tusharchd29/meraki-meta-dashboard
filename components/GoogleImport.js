import { useState } from 'react'
import { decodeExport } from '@/lib/parseGoogleAdsExport'

export default function GoogleImport({ clients = [], onImported }) {
  const [fileText, setFileText] = useState('')
  const [filename, setFilename] = useState('')
  const [preview, setPreview] = useState(null)
  const [clientId, setClientId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setError(null); setPreview(null); setFilename(f.name)
    // Google exports are UTF-16LE — reading as plain text would give garbage
    const text = decodeExport(await f.arrayBuffer())
    setFileText(text)
    setBusy(true)
    try {
      const res = await fetch('/api/google-import', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ fileText: text, filename: f.name, preview: true })
      })
      const d = await res.json()
      if (d.error) setError(d.error); else setPreview(d)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const commit = async () => {
    if (!clientId) { setError('Choose which client this export is for.'); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/google-import', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ fileText, filename, clientId, preview: false,
          periodStart: preview?.period_start, periodEnd: preview?.period_end })
      })
      const d = await res.json()
      if (d.error) setError(d.error)
      else {
        setPreview(null); setFileText(''); setFilename(''); setClientId('')
        onImported && onImported()
        alert(`Imported ${d.period_start} → ${d.period_end}: ${d.currency||''} ${d.account_cost} across ${d.total_campaigns} campaigns.`)
      }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div style={{border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:16}}>
      <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>Import Google Ads export</div>
      <div style={{fontSize:11, color:'var(--text3)', marginBottom:10}}>
        Export a Campaign report from Google Ads (one account at a time), then upload it here.
        The file doesn't say which account it came from, so pick the client below.
        Re-importing the same client and period overwrites, so corrections are safe.
      </div>

      <input type="file" accept=".csv,.tsv,.txt" onChange={onFile} style={{fontSize:12}}/>
      {busy && <div style={{fontSize:11, color:'var(--text3)', marginTop:8}}>Working…</div>}
      {error && <div style={{fontSize:11, color:'var(--red)', marginTop:8}}>{error}</div>}

      {preview && (
        <div style={{marginTop:12, background:'rgba(0,0,0,.03)', borderRadius:8, padding:12}}>
          <div style={{fontSize:12, fontWeight:600, marginBottom:6}}>Preview — nothing saved yet</div>
          <div style={{fontSize:11, lineHeight:1.8}}>
            Period: <b>{preview.period_start} → {preview.period_end}</b><br/>
            Account total: <b>{preview.currency} {preview.account_cost?.toLocaleString('en-IN')}</b>
            {preview.campaigns_cost != null && preview.campaigns_cost !== preview.account_cost && (
              <span style={{color:'var(--text3)'}}> (listed campaigns: {preview.campaigns_cost?.toLocaleString('en-IN')})</span>
            )}<br/>
            Campaigns: <b>{preview.active_campaigns} enabled</b> of {preview.total_campaigns} ·
            Impr: {preview.impressions?.toLocaleString('en-IN')} · Clicks: {preview.clicks?.toLocaleString('en-IN')}
          </div>

          {preview.warnings?.length > 0 && (
            <ul style={{fontSize:11, color:'var(--amber)', marginTop:8, paddingLeft:16}}>
              {preview.warnings.map((w,i)=><li key={i}>{w}</li>)}
            </ul>
          )}

          {preview.campaigns?.length > 0 && (
            <table style={{fontSize:10, borderCollapse:'collapse', width:'100%', marginTop:8}}>
              <thead><tr>{['Status','Campaign','Type','Cost'].map(h=>(
                <th key={h} style={{textAlign:'left', padding:'3px 6px', color:'var(--text3)'}}>{h}</th>))}</tr></thead>
              <tbody>
                {preview.campaigns.map((c,i)=>(
                  <tr key={i}>
                    <td style={{padding:'3px 6px'}}>
                      <span className={`pill pill-${(c.campaign_status||'').toLowerCase()==='enabled'?'g':'b'}`} style={{fontSize:9}}>
                        {c.campaign_status}
                      </span>
                    </td>
                    <td style={{padding:'3px 6px'}}>{c.campaign_name}</td>
                    <td style={{padding:'3px 6px'}}>{c.campaign_type}</td>
                    <td style={{padding:'3px 6px'}}>{c.cost?.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{marginTop:10, display:'flex', gap:8, alignItems:'center'}}>
            <select value={clientId} onChange={e=>setClientId(e.target.value)} style={{fontSize:11, padding:'4px 6px'}}>
              <option value="">— which client is this? —</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={commit} disabled={busy || !clientId} className="refresh-btn"
              style={{opacity: clientId ? 1 : .5}}>Import</button>
          </div>
        </div>
      )}
    </div>
  )
}

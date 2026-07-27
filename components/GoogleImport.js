import { useState } from 'react'
import { decodeExport } from '@/lib/parseGoogleAdsExport'

export default function GoogleImport({ clients = [], onImported }) {
  const [items, setItems] = useState([]) // {id, filename, fileText, preview, clientId, busy, error, imported, result}
  const [error, setError] = useState(null)

  const onFiles = async (e) => {
    const fileList = Array.from(e.target.files || [])
    if (!fileList.length) return
    setError(null)
    e.target.value = '' // allow re-selecting the same files again later

    const newItems = fileList.map((f, i) => ({
      id: `${Date.now()}-${i}-${f.name}`,
      filename: f.name,
      fileText: '',
      preview: null,
      clientId: '',
      busy: true,
      error: null,
      imported: false,
      result: null,
    }))
    setItems(prev => [...prev, ...newItems])

    // Fetch a preview for every file in parallel
    await Promise.all(fileList.map(async (f, i) => {
      const id = newItems[i].id
      try {
        // Google exports are UTF-16LE — reading as plain text would give garbage
        const text = decodeExport(await f.arrayBuffer())
        const res = await fetch('/api/google-import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileText: text, filename: f.name, preview: true })
        })
        const d = await res.json()
        setItems(prev => prev.map(it => it.id === id
          ? { ...it, fileText: text, busy: false, error: d.error || null, preview: d.error ? null : d }
          : it))
      } catch (err) {
        setItems(prev => prev.map(it => it.id === id ? { ...it, busy: false, error: err.message } : it))
      }
    }))
  }

  const setClientFor = (id, clientId) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, clientId, error: null } : it))
  }

  const commitOne = async (id) => {
    const item = items.find(it => it.id === id)
    if (!item) return
    if (!item.clientId) {
      setItems(prev => prev.map(it => it.id === id ? { ...it, error: 'Choose which client this export is for.' } : it))
      return
    }
    setItems(prev => prev.map(it => it.id === id ? { ...it, busy: true, error: null } : it))
    try {
      const res = await fetch('/api/google-import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileText: item.fileText, filename: item.filename, clientId: item.clientId, preview: false,
          periodStart: item.preview?.period_start, periodEnd: item.preview?.period_end
        })
      })
      const d = await res.json()
      if (d.error) {
        setItems(prev => prev.map(it => it.id === id ? { ...it, busy: false, error: d.error } : it))
      } else {
        setItems(prev => prev.map(it => it.id === id ? { ...it, busy: false, imported: true, result: d } : it))
        onImported && onImported()
      }
    } catch (err) {
      setItems(prev => prev.map(it => it.id === id ? { ...it, busy: false, error: err.message } : it))
    }
  }

  const commitAllReady = async () => {
    // Sequential on purpose — each import can trigger a re-fetch of budgets/clients downstream,
    // and running them one at a time keeps the per-row status accurate as it goes.
    const ready = items.filter(it => it.clientId && !it.imported && it.preview && !it.busy)
    for (const it of ready) {
      // eslint-disable-next-line no-await-in-loop
      await commitOne(it.id)
    }
  }

  const clearImported = () => {
    setItems(prev => prev.filter(it => !it.imported))
  }

  const readyCount = items.filter(it => it.clientId && !it.imported && it.preview && !it.busy).length

  return (
    <div style={{border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:16}}>
      <div style={{fontSize:13, fontWeight:600, marginBottom:4}}>Import Google Ads export</div>
      <div style={{fontSize:11, color:'var(--text3)', marginBottom:10}}>
        Export a Campaign report from Google Ads (one account at a time). You can select multiple files
        at once below — each file doesn&apos;t say which account it came from, so pick the client for each one.
        Re-importing the same client and period overwrites, so corrections are safe.
      </div>

      <input type="file" accept=".csv,.tsv,.txt" multiple onChange={onFiles} style={{fontSize:12}}/>
      {error && <div style={{fontSize:11, color:'var(--red)', marginTop:8}}>{error}</div>}

      {items.length > 0 && (
        <div style={{marginTop:12, display:'flex', flexDirection:'column', gap:10}}>
          {items.map(item => (
            <div key={item.id} style={{
              background: item.imported ? 'rgba(0,150,0,.06)' : 'rgba(0,0,0,.03)',
              borderRadius:8, padding:12, opacity: item.imported ? 0.75 : 1
            }}>
              <div style={{fontSize:12, fontWeight:600, marginBottom:6, display:'flex', justifyContent:'space-between', gap:8}}>
                <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{item.filename}</span>
                {item.imported && <span style={{color:'#2a2', whiteSpace:'nowrap'}}>✓ Imported</span>}
              </div>

              {item.busy && <div style={{fontSize:11, color:'var(--text3)'}}>Working…</div>}
              {item.error && <div style={{fontSize:11, color:'var(--red)'}}>{item.error}</div>}

              {item.preview && !item.imported && (
                <>
                  <div style={{fontSize:11, lineHeight:1.8}}>
                    Period: <b>{item.preview.period_start} → {item.preview.period_end}</b><br/>
                    Account total: <b>{item.preview.currency} {item.preview.account_cost?.toLocaleString('en-IN')}</b>
                    {item.preview.campaigns_cost != null && item.preview.campaigns_cost !== item.preview.account_cost && (
                      <span style={{color:'var(--text3)'}}> (listed campaigns: {item.preview.campaigns_cost?.toLocaleString('en-IN')})</span>
                    )}<br/>
                    Campaigns: <b>{item.preview.active_campaigns} enabled</b> of {item.preview.total_campaigns} ·
                    Impr: {item.preview.impressions?.toLocaleString('en-IN')} · Clicks: {item.preview.clicks?.toLocaleString('en-IN')}
                  </div>

                  {item.preview.warnings?.length > 0 && (
                    <ul style={{fontSize:11, color:'var(--amber)', marginTop:8, paddingLeft:16}}>
                      {item.preview.warnings.map((w,i)=><li key={i}>{w}</li>)}
                    </ul>
                  )}

                  {item.preview.campaigns?.length > 0 && (
                    <table style={{fontSize:10, borderCollapse:'collapse', width:'100%', marginTop:8}}>
                      <thead><tr>{['Status','Campaign','Type','Cost'].map(h=>(
                        <th key={h} style={{textAlign:'left', padding:'3px 6px', color:'var(--text3)'}}>{h}</th>))}</tr></thead>
                      <tbody>
                        {item.preview.campaigns.map((c,i)=>(
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
                    <select value={item.clientId} onChange={e=>setClientFor(item.id, e.target.value)} style={{fontSize:11, padding:'4px 6px'}}>
                      <option value="">— which client is this? —</option>
                      {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={()=>commitOne(item.id)} disabled={item.busy || !item.clientId} className="refresh-btn"
                      style={{opacity: item.clientId ? 1 : .5}}>Import</button>
                  </div>
                </>
              )}

              {item.imported && item.result && (
                <div style={{fontSize:11, color:'var(--text3)'}}>
                  {item.result.period_start} → {item.result.period_end}: {item.result.currency||''} {item.result.account_cost} across {item.result.total_campaigns} campaigns.
                </div>
              )}
            </div>
          ))}

          <div style={{display:'flex', gap:8}}>
            {readyCount > 0 && (
              <button onClick={commitAllReady} className="refresh-btn">Import all ready ({readyCount})</button>
            )}
            {items.some(it => it.imported) && (
              <button onClick={clearImported} className="refresh-btn" style={{opacity:.7}}>Clear imported</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

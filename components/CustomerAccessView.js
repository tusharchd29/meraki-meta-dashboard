'use client'
import { useEffect, useMemo, useState } from 'react'

const platformLabel = p => p === 'meta' ? 'Meta Ads' : 'Google Ads'
const statusTone = s => s === 'active' ? '#16835b' : s === 'suspended' ? '#b42318' : '#a15c00'
const card = { background: '#fff', border: '1px solid #e5e9e4', borderRadius: 14, padding: 16 }
const input = { width: '100%', boxSizing: 'border-box', border: '1px solid #d7ddd5', borderRadius: 9, padding: '10px 12px', fontSize: 13, background: '#fff', color: '#18211b' }
const label = { display: 'block', fontSize: 11, fontWeight: 700, color: '#59645b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }

export default function CustomerAccessView() {
  const [data, setData] = useState(null)
  const [selectedClient, setSelectedClient] = useState('')
  const [email, setEmail] = useState('marketing@example.com')
  const [role, setRole] = useState('viewer')
  const [crmAccess, setCrmAccess] = useState(false)
  const [selectedAccounts, setSelectedAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/customer-access', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Unable to load customer access.')
      setData(json)
      setSelectedClient(current => current || json.clients?.[0]?.id || '')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const memberships = data?.memberships || []
  const clients = data?.clients || []
  const accounts = data?.accounts || []
  const selectedMembership = memberships.find(m => m.client_id === selectedClient && m.email?.toLowerCase() === email.trim().toLowerCase())
  const clientMemberships = memberships.filter(m => m.client_id === selectedClient)
  const selectedClientName = clients.find(c => c.id === selectedClient)?.name || ''
  const selectedAccountKeys = useMemo(() => new Set(selectedAccounts.map(a => a.platform + ':' + a.account_id)), [selectedAccounts])

  useEffect(() => {
    if (!data || !selectedClient) return
    const assigned = (data.assignments || []).filter(a => a.client_id === selectedClient).map(a => ({ platform: a.platform, account_id: a.account_id }))
    setSelectedAccounts(assigned)
    const existing = (data.memberships || []).find(m => m.client_id === selectedClient)
    setEmail(existing?.email || 'marketing@example.com')
    setRole(existing?.role || 'viewer')
    setCrmAccess(existing?.crm_access || false)
    setDirty(false); setNotice('')
  }, [selectedClient, data])

  const toggleAccount = (account, checked) => {
    const key = account.platform + ':' + account.account_id
    setSelectedAccounts(current => checked
      ? [...current.filter(a => a.platform + ':' + a.account_id !== key), { platform: account.platform, account_id: account.account_id }]
      : current.filter(a => a.platform + ':' + a.account_id !== key))
    setDirty(true)
  }

  const cancel = () => {
    const assigned = (data?.assignments || []).filter(a => a.client_id === selectedClient).map(a => ({ platform: a.platform, account_id: a.account_id }))
    const existing = (data?.memberships || []).find(m => m.client_id === selectedClient)
    setSelectedAccounts(assigned); setEmail(existing?.email || 'marketing@example.com')
    setRole(existing?.role || 'viewer'); setCrmAccess(existing?.crm_access || false)
    setDirty(false); setError(''); setNotice('')
  }

  const save = async () => {
    setError(''); setNotice('')
    if (!selectedClient) return setError('Choose a customer workspace first.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid customer email address.')
    setSaving(true)
    try {
      const res = await fetch('/api/admin/customer-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClient, email: email.trim(), role, crmAccess, accounts: selectedAccounts }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Unable to save access.')
      setNotice(json.invited ? 'Access saved. An invitation email has been requested through Supabase Auth.' : 'Customer access and account assignments saved.')
      setDirty(false)
      await load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const updateMembership = async (membershipId, patch) => {
    setError(''); setNotice('')
    try {
      const res = await fetch('/api/admin/customer-access', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ membershipId, ...patch }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Unable to update member.')
      setNotice('Membership updated and audit event recorded.')
      await load()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div style={{ padding: 24, color: '#68746b' }}>Loading customer access…</div>

  return (
    <div style={{ padding: 'clamp(12px,2vw,24px)', color: '#18211b', maxWidth: 1320, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.04em' }}>Customer Access</div>
          <div style={{ color: '#68746b', fontSize: 12, marginTop: 5 }}>Master Admin · Assign ad accounts and manage individual customer logins</div>
        </div>
        <a href="/portal" target="_blank" rel="noreferrer" style={{ border: '1px solid #d7ddd5', borderRadius: 9, padding: '9px 12px', color: '#344238', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>Preview customer portal ↗</a>
      </div>

      {error && <div role="alert" style={{ background: '#fff3f1', color: '#a22a20', border: '1px solid #ffd5cf', borderRadius: 10, padding: 12, fontSize: 12, marginBottom: 14 }}>{error}</div>}
      {notice && <div role="status" style={{ background: '#eef9f1', color: '#166534', border: '1px solid #c9ebd2', borderRadius: 10, padding: 12, fontSize: 12, marginBottom: 14 }}>{notice}</div>}
      {!data && <div style={card}>No customer access data could be loaded.</div>}
      {data && clients.length === 0 && <div style={card}>No customer workspaces exist yet. Add a client in the Clients (Blended) tab first.</div>}

      {data && clients.length > 0 && <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 16, alignItems: 'start' }}>
          <section style={card}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Customer workspace</div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Customer</label>
              <select style={input} value={selectedClient} onChange={e => { setSelectedClient(e.target.value); setDirty(false) }}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.status ? ' · ' + c.status : ''}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Customer login email</label>
              <input type="email" autoComplete="off" style={input} value={email} onChange={e => { setEmail(e.target.value); setDirty(true) }} placeholder="customer@company.com"/>
              <div style={{ color: '#7b857c', fontSize: 10, marginTop: 5 }}>Sign-in links are sent by Supabase Auth. Passwords are never visible to the agency.</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Portal role</label>
              <select style={input} value={role} onChange={e => { setRole(e.target.value); setDirty(true) }}>
                <option value="viewer">Customer viewer · read-only</option>
                <option value="client_admin">Customer admin · manage their portal users (future-ready)</option>
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 10, background: '#f7f9f6', cursor: 'pointer', marginBottom: 16 }}>
              <input type="checkbox" checked={crmAccess} onChange={e => { setCrmAccess(e.target.checked); setDirty(true) }} style={{ marginTop: 2 }}/>
              <span><span style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>Allow CRM-qualified lead reports</span><span style={{ display: 'block', color: '#778177', fontSize: 10, marginTop: 3 }}>Off by default. The portal will not expose CRM details unless explicitly enabled.</span></span>
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={save} disabled={saving} style={{ border: 0, borderRadius: 9, padding: '10px 14px', background: '#233b2c', color: '#fff', fontWeight: 800, fontSize: 12, cursor: saving ? 'wait' : 'pointer', opacity: saving ? .65 : 1 }}>{saving ? 'Saving…' : selectedMembership ? 'Save access changes' : 'Save & send invitation'}</button>
              <button onClick={cancel} disabled={saving || !dirty} style={{ border: '1px solid #d7ddd5', borderRadius: 9, padding: '10px 14px', background: '#fff', color: '#465348', fontWeight: 700, fontSize: 12, cursor: dirty ? 'pointer' : 'default', opacity: dirty ? 1 : .5 }}>Cancel changes</button>
            </div>
          </section>

          <section style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginBottom: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Visible ad accounts</div>
              <span style={{ fontSize: 11, color: '#647065' }}>{selectedAccounts.length} selected</span>
            </div>
            <div style={{ fontSize: 11, color: '#778177', marginBottom: 14 }}>Only tracked accounts can be assigned. These selections define what this customer workspace can see.</div>
            {['meta', 'google_ads'].map(platform => {
              const platformAccounts = accounts.filter(a => a.platform === platform)
              return <div key={platform} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#4e5a50', marginBottom: 7 }}>{platformLabel(platform)} <span style={{ fontWeight: 500, color: '#8b958b' }}>({platformAccounts.length})</span></div>
                {platformAccounts.length === 0 ? <div style={{ fontSize: 11, color: '#909990', padding: '8px 0' }}>No tracked accounts available.</div> : platformAccounts.map(a => {
                  const key = a.platform + ':' + a.account_id
                  return <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 0', borderTop: '1px solid #edf0eb', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedAccountKeys.has(key)} onChange={e => toggleAccount(a, e.target.checked)} style={{ marginTop: 2 }}/>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 700, overflowWrap: 'anywhere' }}>{a.account_name || a.account_id}</span>
                      <span style={{ display: 'block', fontSize: 10, color: '#849084', marginTop: 3 }}>{a.account_id}{a.currency ? ' · ' + a.currency : ''}{a.business_name ? ' · ' + a.business_name : ''}</span>
                    </span>
                  </label>
                })}
              </div>
            })}
            <div style={{ fontSize: 10, color: '#8b958b', borderTop: '1px solid #edf0eb', paddingTop: 10 }}>Customer: {selectedClientName || '—'} · changes are not applied until saved.</div>
          </section>
        </div>

        <section style={{ ...card, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Customer logins</div>
            <div style={{ fontSize: 11, color: '#778177' }}>{memberships.length} membership(s) across all workspaces</div>
          </div>
          {memberships.length === 0 ? <div style={{ color: '#7b857c', fontSize: 12 }}>No customer invitations have been created yet.</div> :
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 650 }}>
                <thead><tr style={{ textAlign: 'left', color: '#778177', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  {['Email','Customer','Role','CRM reports','Status','Actions'].map(h => <th key={h} style={{ padding: '9px 8px', borderBottom: '1px solid #e8ece6' }}>{h}</th>)}
                </tr></thead>
                <tbody>{memberships.map(m => <tr key={m.id}>
                  <td style={{ padding: '11px 8px', borderBottom: '1px solid #f0f2ee', fontWeight: 700 }}>{m.email}</td>
                  <td style={{ padding: '11px 8px', borderBottom: '1px solid #f0f2ee' }}>{clients.find(c => c.id === m.client_id)?.name || '—'}</td>
                  <td style={{ padding: '11px 8px', borderBottom: '1px solid #f0f2ee' }}>{m.role === 'client_admin' ? 'Customer admin' : 'Viewer'}</td>
                  <td style={{ padding: '11px 8px', borderBottom: '1px solid #f0f2ee' }}>{m.crm_access ? 'Enabled' : 'Disabled'}</td>
                  <td style={{ padding: '11px 8px', borderBottom: '1px solid #f0f2ee' }}><span style={{ color: statusTone(m.status), fontWeight: 800 }}>{m.status}</span></td>
                  <td style={{ padding: '11px 8px', borderBottom: '1px solid #f0f2ee' }}>
                    <button onClick={() => updateMembership(m.id, { status: m.status === 'suspended' ? 'active' : 'suspended' })} style={{ border: '1px solid #d7ddd5', borderRadius: 7, padding: '6px 8px', background: '#fff', fontSize: 10, fontWeight: 700, color: m.status === 'suspended' ? '#16835b' : '#a22a20', cursor: 'pointer' }}>{m.status === 'suspended' ? 'Restore access' : 'Suspend'}</button>
                  </td>
                </tr>)}</tbody>
              </table>
            </div>
          }
        </section>

        <section style={{ ...card, marginTop: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Recent access audit</div>
          {(data.auditLogs || []).length === 0 ? <div style={{ color: '#7b857c', fontSize: 12 }}>No access changes recorded yet.</div> :
            <div style={{ display: 'grid', gap: 0 }}>
              {data.auditLogs.slice(0, 8).map(log => <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '9px 0', borderTop: '1px solid #edf0eb', flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: 11, fontWeight: 700 }}>{log.action.replaceAll('_', ' ')}</div><div style={{ fontSize: 10, color: '#778177', marginTop: 3 }}>{log.target_email || '—'} · {clients.find(c => c.id === log.client_id)?.name || 'System'}</div></div>
                <div style={{ fontSize: 10, color: '#778177' }}>{new Date(log.created_at).toLocaleString()}</div>
              </div>)}
            </div>
          }
        </section>
      </>}
    </div>
  )
}

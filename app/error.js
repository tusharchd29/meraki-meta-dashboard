'use client'

export default function Error({ error, reset }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      fontFamily: 'sans-serif', textAlign: 'center', gap: 12
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#333' }}>Something broke in the dashboard</div>
      <div style={{ fontSize: 13, color: '#888', maxWidth: 500 }}>
        This is the actual error, so it can be reported precisely instead of guessed at:
      </div>
      <pre style={{
        fontSize: 12, background: '#f5f5f5', padding: 12, borderRadius: 8,
        maxWidth: 600, overflowX: 'auto', textAlign: 'left', color: '#c0392b'
      }}>
        {error?.message || 'Unknown error'}
      </pre>
      <button
        onClick={reset}
        style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7dc242', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  )
}

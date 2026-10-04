import { useState, useRef, useEffect } from 'react'

export default function SearchBar({ satellites, onSelect, selectedId }) {
  const [query,  setQuery]  = useState('')
  const [open,   setOpen]   = useState(false)
  const ref = useRef(null)

  const selected = satellites.find(s => s.id === selectedId)

  const filtered = satellites.filter(s =>
    s.name?.toLowerCase().includes(query.toLowerCase()) ||
    s.id?.includes(query)
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', width: 280 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: 6, padding: '6px 10px',
      }}>
        {/* Color dot for selected */}
        {selected && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: selected.color, flexShrink: 0,
            boxShadow: `0 0 5px ${selected.color}`,
          }} />
        )}
        <input
          value={open ? query : (selected?.name?.trim() || '')}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          placeholder="Search satellite or NORAD ID..."
          style={{
            background: 'none', border: 'none', outline: 'none',
            color: '#e2e8f0', fontSize: 12, flex: 1,
          }}
        />
        <span style={{ color: '#475569', fontSize: 10 }}>▾</span>
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#1e293b', border: '1px solid #334155',
          borderRadius: 6, zIndex: 100, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', color: '#475569', fontSize: 12 }}>
              No satellites found
            </div>
          ) : filtered.map(s => (
            <div
              key={s.id}
              onClick={() => {
                onSelect(s.id)
                setOpen(false)
                setQuery('')
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                background: s.id === selectedId ? '#1e3a5f' : 'transparent',
                borderBottom: '1px solid #0f1525',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#263548'}
              onMouseLeave={e => e.currentTarget.style.background =
                s.id === selectedId ? '#1e3a5f' : 'transparent'}
            >
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: s.color, flexShrink: 0,
                boxShadow: `0 0 4px ${s.color}`,
              }} />
              <span style={{ color: '#e2e8f0', flex: 1 }}>{s.name?.trim()}</span>
              <span style={{ color: '#475569', fontSize: 10 }}>#{s.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
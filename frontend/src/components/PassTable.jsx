import { useEffect, useState } from 'react'
import { passTime } from './passStatus.js'
import './PassTable.css'

export default function PassTable({ passes, loading }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  if (!passes?.length && !loading) return null

  return (
    <div style={{
      flexShrink: 0, maxHeight: 180, overflowY: 'auto',
      borderTop: '1px solid #1e293b', background: '#080c18',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ background: '#0f1525', position: 'sticky', top: 0 }}>
            {['#', 'Status', 'Date & Time UTC', 'Rise', 'Max El', 'Set', 'Duration'].map(h => (
              <th key={h} style={{
                padding: '8px 12px', textAlign: 'left',
                color: '#64748b', fontWeight: 600, fontSize: 10,
                letterSpacing: '0.05em', borderBottom: '1px solid #1e293b',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={7} style={{ padding: 12, color: '#475569' }}>Loading...</td></tr>
          ) : passes.map((p, i) => {
            const state = now >= passTime(p.los) ? 'completed'
              : now >= passTime(p.aos) ? 'active' : 'upcoming'
            const qColor = p.quality?.includes('EXCELLENT') ? '#4ade80'
              : p.quality?.includes('GOOD') ? '#38bdf8' : '#94a3b8'
            const riseDir = azToCompass(p.rise_az)
            const setDir  = azToCompass(p.set_az)
            return (
              <tr key={`${p.aos}:${p.los}`} className={`pass-row pass-row--${state}`}
                style={{ borderBottom: '1px solid #0f1525' }}>
                <td style={{ padding: '7px 12px', color: '#475569' }}>{i + 1}</td>
                <td style={{ padding: '7px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {state === 'active' ? '● Now passing' : state === 'completed' ? '✓ Completed' : 'Upcoming'}
                </td>
                <td style={{ padding: '7px 12px', color: '#e2e8f0', fontFamily: 'monospace' }}>
                  {p.aos}
                </td>
                <td style={{ padding: '7px 12px', color: '#94a3b8' }}>
                  {riseDir} {p.rise_az?.toFixed(0)}°
                </td>
                <td style={{ padding: '7px 12px', color: qColor, fontWeight: 700 }}>
                  {p.max_elevation.toFixed(1)}°
                </td>
                <td style={{ padding: '7px 12px', color: '#94a3b8' }}>
                  {setDir} {p.set_az?.toFixed(0)}°
                </td>
                <td style={{ padding: '7px 12px', color: '#64748b' }}>
                  {p.duration}s
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function azToCompass(deg) {
  if (deg == null) return ''
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg / 45) % 8]
}

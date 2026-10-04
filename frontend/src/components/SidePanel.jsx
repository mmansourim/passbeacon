import { useEffect, useState } from 'react'
import { passStatus, passTime, countdown } from './passStatus.js'

export default function SidePanel({ satellite, passes, loading, gsKey, hours = 24, passError }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const {active, next, remaining} = passStatus(passes, now)
  if (!satellite) {
    return (
      <div style={{
        width: 340, background: '#080c18',
        borderLeft: '1px solid #1e293b',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#1e293b', fontSize: 13,
      }}>
        No satellite selected
      </div>
    )
  }

  const hex = satellite.color || '#38bdf8'

  return (
    <div style={{
      width: 340, background: '#080c18',
      borderLeft: '1px solid #1e293b',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto', flexShrink: 0,
    }}>
      {/* ── Header ───────────────────────────────── */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #1e293b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: hex, boxShadow: `0 0 8px ${hex}`,
          }} />
          <span style={{ color: '#ffffff', fontWeight: 700, fontSize: 15 }}>
            {satellite.name?.trim()}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Tag>NORAD {satellite.id}</Tag>
        </div>
      </div>

      {/* ── Current Status ────────────────────────── */}
      <Section title="Current Status">
        <Row label="Altitude"  value={`${satellite.alt?.toFixed(1)} km`} />
        <Row label="Velocity"  value={`${satellite.velocity?.toFixed(2)} km/s`} />
        <Row label="Latitude"  value={`${Math.abs(satellite.lat).toFixed(4)}° ${satellite.lat >= 0 ? 'N' : 'S'}`} />
        <Row label="Longitude" value={`${Math.abs(satellite.lon).toFixed(4)}° ${satellite.lon >= 0 ? 'E' : 'W'}`} />
      </Section>

      {/* ── TLE ──────────────────────────────────── */}
      <Section title="Two-Line Element Set">
        <div style={{
          background: '#0a0e1a', borderRadius: 6, padding: 10,
          fontFamily: 'monospace', fontSize: 10, color: '#4ade80',
          wordBreak: 'break-all', lineHeight: 1.8,
          border: '1px solid #1e293b',
        }}>
          <div style={{ color: '#94a3b8', marginBottom: 4 }}>
            {satellite.name?.trim()}
          </div>
          <div>{satellite.tle_line1}</div>
          <div>{satellite.tle_line2}</div>
        </div>
      </Section>

      {!loading && !passError && (active || next) && (() => {
        const pass = active || next
        return (
          <div style={{margin: '0 16px', padding: '12px 16px',
            background: active ? '#102b23' : '#0f1e35', borderRadius: 8,
            border: `1px solid ${active ? '#4ade80' : '#1e3a5f'}`}}>
            <div style={{fontSize: 11, color: active ? '#4ade80' : '#94a3b8'}}>
              {active ? 'NOW PASSING' : 'NEXT PASS IN'}
            </div>
            <div style={{fontSize: 22, fontWeight: 700, color: active ? '#4ade80' : '#38bdf8'}}>
              {countdown(passTime(active ? pass.los : pass.aos) - now)}{active ? ' remaining' : ''}
            </div>
            {active && <div style={{fontSize: 12, marginTop: 6}}>
              {satellite.name} · {gsKey}
            </div>}
            <div style={{fontSize: 11, color: '#94a3b8', marginTop: 6}}>
              {active ? `Started ${pass.aos} UTC` : `${pass.aos} UTC`}
              <br />Peak {pass.max_elevation.toFixed(1)}° at {pass.tca} UTC
              {active && <><br />Ends {pass.los} UTC
                <br />Rise {azToCompass(pass.rise_az)} {pass.rise_az?.toFixed(0)}°
                {' · '}Set {azToCompass(pass.set_az)} {pass.set_az?.toFixed(0)}°
                <br />Total duration {pass.duration}s</>}
            </div>
          </div>
        )
      })()}

      {/* ── Passes ───────────────────────────────── */}
      <Section title={`Current & Upcoming Passes — ${gsKey.charAt(0).toUpperCase() + gsKey.slice(1)}`}>
        {loading && <div style={{ color: '#475569', fontSize: 12 }}>Loading...</div>}
        {!loading && !passError && remaining.length === 0 && (
          <div style={{ color: '#475569', fontSize: 12, fontStyle: 'italic' }}>
            No remaining passes in the {hours}h prediction window
          </div>
        )}
        {remaining.map(p => {
          const i = passes.indexOf(p)
          const qColor = p.quality?.includes('EXCELLENT') ? '#4ade80'
            : p.quality?.includes('GOOD') ? '#38bdf8' : '#64748b'
          const riseDir = azToCompass(p.rise_az)
          const setDir  = azToCompass(p.set_az)
          return (
            <div key={i} style={{
              marginBottom: 8, padding: '10px 12px',
              background: '#0a0e1a', borderRadius: 6,
              borderLeft: `3px solid ${qColor}`,
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginBottom: 5,
              }}>
                <span style={{ fontSize: 12, color: qColor, fontWeight: 700 }}>
                  {p === active ? 'Now passing' : `Pass ${i + 1}`}
                </span>
                <span style={{
                  fontSize: 12, color: qColor, fontWeight: 700,
                }}>
                  {p.max_elevation.toFixed(0)}°
                </span>
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: 4, fontSize: 11, color: '#94a3b8',
              }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: 10 }}>RISE</div>
                  <div>{riseDir} {p.rise_az?.toFixed(0)}°</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#64748b', fontSize: 10 }}>MAX</div>
                  <div style={{ color: qColor }}>{p.max_elevation.toFixed(1)}°</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#64748b', fontSize: 10 }}>SET</div>
                  <div>{setDir} {p.set_az?.toFixed(0)}°</div>
                </div>
              </div>
              <div style={{
                marginTop: 5, fontSize: 11, color: '#475569',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span>{p.aos?.slice(11, 16)} UTC</span>
                <span>{p.duration}s</span>
                <span>{p.los?.slice(11, 16)} UTC</span>
              </div>
            </div>
          )
        })}
      </Section>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────
function azToCompass(deg) {
  if (deg == null) return ''
  const dirs = ['N','NE','E','SE','S','SW','W','NW']
  return dirs[Math.round(deg / 45) % 8]
}

function Tag({ children }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 10,
      background: '#1e293b', color: '#64748b', border: '1px solid #334155',
    }}>
      {children}
    </span>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e293b' }}>
      <div style={{
        fontSize: 10, color: '#64748b', fontWeight: 600,
        letterSpacing: '0.1em', marginBottom: 10,
      }}>
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '5px 0', borderBottom: '1px solid #0f1525',
      fontSize: 13,
    }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{value}</span>
    </div>
  )
}
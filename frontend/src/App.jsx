import { useState, useEffect } from 'react'
import { useSatellites }  from './hooks/useSatellites'
import { useStations } from './hooks/useStations'
import { usePasses }      from './hooks/usePasses'
import GlobeView   from './components/GlobeView'
import SidePanel   from './components/SidePanel'
import PassTable   from './components/PassTable'
import SearchBar   from './components/SearchBar'

export default function App() {
  const { satellites, connected, lastUpdate, fetchDetail, error, status, generation } = useSatellites()

  const [selectedId, setSelectedId] = useState(null)
  const [gsKey,      setGsKey]      = useState('oran')
  const [showTrack,  setShowTrack]  = useState(true)
  const [showPasses, setShowPasses] = useState(true)   
  const [fullTrack,  setFullTrack]  = useState(false)

  const {stations, error: stationError} = useStations(generation)
  const activeGs = stations.some(s => s.id === gsKey) ? gsKey : stations[0]?.id
  const selectedStation = stations.find(station => station.id === activeGs)
  const activeId = selectedId || (satellites['25544'] ? '25544' : Object.keys(satellites)[0])
  const selected = activeId ? satellites[activeId] : null
  const { passes, loading, error: passError } = usePasses(activeId, activeGs, generation)

  function selectSatellite(id) { setSelectedId(id) }
  useEffect(() => {
    if (activeId) return fetchDetail(activeId)
  }, [activeId, fetchDetail])

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#0a0e1a', color: '#e2e8f0',
    }}>

      {/* ── Top bar ─────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '10px 20px', background: '#080c18',
        borderBottom: '1px solid #1e293b', flexShrink: 0,
      }}>
        <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: 16 }}>
          ◈ PassBeacon
        </span>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
          color: connected ? '#4ade80' : '#ef4444',
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: connected ? '#4ade80' : '#ef4444',
            boxShadow: connected ? '0 0 6px #4ade80' : 'none',
          }} />
          {connected ? 'LIVE' : 'OFFLINE'}
        </div>

        <SearchBar
          satellites={Object.values(satellites)}
          onSelect={selectSatellite}
          selectedId={activeId}
        />

        <select
          value={activeGs || ''}
          disabled={!stations.length}
          onChange={e => setGsKey(e.target.value)}
          style={{
            background: '#1e293b', color: '#e2e8f0',
            border: '1px solid #334155', borderRadius: 6,
            padding: '6px 10px', fontSize: 12,
          }}
        >
          {!stations.length && <option value="">Loading stations…</option>}
          {stations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
        </select>

        {/* Track toggle — one orbit vs full 24h */}
        <button
          onClick={() => setShowTrack(v => !v)}
          style={{
            padding: '6px 12px', fontSize: 12, borderRadius: 6,
            border: '1px solid #334155', cursor: 'pointer',
            background: showTrack ? '#1e3a5f' : '#1e293b',
            color: showTrack ? '#38bdf8' : '#64748b',
          }}
        >
          {showTrack ? '◉' : '○'} Track
        </button>

        {/* Full track toggle — only visible when track is on */}
        {showTrack && (
          <button
            onClick={() => setFullTrack(v => !v)}
            style={{
              padding: '6px 12px', borderRadius: 6,
              border: '1px solid #334155', cursor: 'pointer',
              background: fullTrack ? '#2d1b69' : '#1e293b',
              color: fullTrack ? '#a78bfa' : '#64748b',
              fontSize: 11,
            }}
          >
            {fullTrack ? `${status?.hours || 24}h` : '1 orbit'}
          </button>
        )}

        {/* Passes toggle */}
        <button
          onClick={() => setShowPasses(v => !v)}
          style={{
            padding: '6px 12px', fontSize: 12, borderRadius: 6,
            border: '1px solid #334155', cursor: 'pointer',
            background: showPasses ? '#1e3a5f' : '#1e293b',
            color: showPasses ? '#4ade80' : '#64748b',
          }}
        >
          {showPasses ? '◉' : '○'} Passes
        </button>

        {lastUpdate && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: '#475569' }}>
            {new Date(lastUpdate).toLocaleTimeString('en-GB', {timeZone: 'UTC'})} UTC
          </span>
        )}
      </div>

      {(error || passError || stationError || selected?.detailError) && <div role="alert" style={{padding: 10, color: '#fca5a5'}}>{error || passError || stationError || selected?.detailError}</div>}

      {status && <div style={{padding: '5px 20px', fontSize: 11, color: '#94a3b8'}}>
        Predictions: {status.generated_at ? new Date(status.generated_at).toLocaleTimeString('en-GB', {timeZone: 'UTC'}) : 'pending'} UTC
        {' · '}{status.hours}h window · above {status.min_elevation}°
        {status.refresh_error && <span style={{color: '#fbbf24'}}> · Refresh failed; using previous data</span>}
        {Object.keys(status.errors || {}).length > 0 && <span style={{color: '#fbbf24'}}> · Some satellites failed to refresh</span>}
        {Object.keys(status.pass_errors || {}).length > 0 && <span style={{color: '#fbbf24'}}> · Some pass calculations failed</span>}
        {(status.warnings?.[activeId] || []).map((warning, i) => <div key={i} style={{color: '#fbbf24'}}>{warning}</div>)}
      </div>}

      {/* ── Main content ────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <GlobeView
            satellite={selected}
            loading={loading || selected?.detailGeneration !== generation}
            error={passError || selected?.detailError}
            selectionKey={`${generation}:${activeId}:${activeGs}`}
            showTrack={showTrack}
            fullTrack={fullTrack}
            showPasses={showPasses}
            passes={passes}
            groundStation={selectedStation}
          />
        </div>
        <SidePanel
          satellite={selected}
          passes={passes}
          loading={loading}
          gsKey={activeGs || ''}
          hours={status?.hours || 24}
          passError={passError}
        />
      </div>

      {selected && (
        <PassTable passes={passes} loading={loading} />
      )}
    </div>
  )
}

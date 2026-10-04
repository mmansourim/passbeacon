import Plot from 'react-plotly.js'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { trackCoordinates, shouldPublish } from './globeUpdates.js'

const EMPTY_PASSES = []

export default function GlobeView({
  satellite, groundStation, passes, loading, error,
  selectionKey, showTrack, fullTrack, showPasses
}) {
  const [snapshot, setSnapshot] = useState(null)
  const latest = useRef(null)
  const published = useRef(null)
  const dragging = useRef(false)
  const lastInteraction = useRef(0)
  const lastPublished = useRef(0)
  const selectionChangedAt = useRef(0)


  useEffect(() => {
    if (latest.current?.selectionKey !== selectionKey) {
      selectionChangedAt.current = Date.now()
    }

    latest.current = {
      satellite,
      groundStation,
      passes,
      loading: loading || Boolean(error),
      selectionKey,
      showTrack,
      fullTrack,
      showPasses,
    }
  }, [
    satellite, groundStation, passes, loading, error,
    selectionKey, showTrack, fullTrack, showPasses,
  ])

  useEffect(() => {
    const finish = () => {
      if (dragging.current) { dragging.current = false; lastInteraction.current = Date.now() }
    }
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    window.addEventListener('blur', finish)
    const timer = window.setInterval(() => {
      const next = latest.current
      const now = Date.now()
      if (!shouldPublish(next, published.current, {
        now, dragging: dragging.current, lastInteraction: lastInteraction.current,
        lastPublished: lastPublished.current, selectionChangedAt: selectionChangedAt.current,
      })) return
      published.current = next
      lastPublished.current = now
      setSnapshot(next)
    }, 100)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('blur', finish)
    }
  }, [])

  const pending = !error && (loading || snapshot?.selectionKey !== selectionKey || !satellite?.track)
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}
      onPointerDownCapture={() => { dragging.current = true }}
      onWheelCapture={() => { lastInteraction.current = Date.now() }}
      aria-busy={pending}>
      <GlobePlot snapshot={snapshot} />
      {error && <div role="alert" style={{position: 'absolute', top: 12, left: 12,
        padding: 8, background: '#0f1e35', color: '#fca5a5', pointerEvents: 'none'}}>
        Selection unavailable: {error}. Previous view retained.
      </div>}
      {pending && <div role="status" style={{position: 'absolute', top: 12, left: 12,
        padding: '8px 12px', borderRadius: 6, background: '#0f1e35', color: '#cbd5e1',
        fontSize: 12, pointerEvents: 'none'}}>
        {loading || !satellite?.track ? 'Loading selection…' : 'Updating globe when movement stops…'}
      </div>}
    </div>
  )
}

const GlobePlot = memo(function GlobePlot({ snapshot }) {
  const sat = snapshot?.satellite
  const station = snapshot?.groundStation
  const track = sat?.track
  const color = sat?.color
  const period = sat?.period_minutes
  const fullTrack = snapshot?.fullTrack
  const passes = snapshot?.passes || EMPTY_PASSES
  const [layout] = useState(() => ({
        paper_bgcolor: '#0a0e1a',
        plot_bgcolor:  '#0a0e1a',
        margin: { l: 0, r: 0, t: 0, b: 0 },
        showlegend: false,
        geo: {
          projection: { type: 'orthographic' },
          showland:       true,  landcolor:      '#1e293b',
          showocean:      true,  oceancolor:     '#0a0e1a',
          showlakes:      false,
          showcountries:  true,  countrycolor:   '#334155',
          showcoastlines: true,  coastlinecolor: '#334155',
          bgcolor: '#0a0e1a',
          lataxis: { showgrid: true, gridcolor: '#1e293b' },
          lonaxis: { showgrid: true, gridcolor: '#1e293b' },
          showframe: false,
        },
        uirevision: 'globe',
      
  }))
  const [config] = useState(() => ({ displayModeBar: false, scrollZoom: true }))
  const trackTrace = useMemo(() => ({
    uid: 'ground-track', type: 'scattergeo', mode: 'lines',
    ...trackCoordinates(track, fullTrack, period),
    connectgaps: false, line: {color: color || '#a78bfa', width: 1.5},
    opacity: 0.7, showlegend: false, hoverinfo: 'skip',
  }), [track, fullTrack, period, color])
  const passTrace = useMemo(() => makePassTrace(passes), [passes])
  const markerTrace = useMemo(() => sat ? makeMarker(sat) : {
    type: 'scattergeo', mode: 'markers', lat: [], lon: [], showlegend: false,
  }, [sat])
  const showTrack = snapshot?.showTrack
  const showPasses = snapshot?.showPasses
  const stationTrace = useMemo(() => ({
    uid: 'ground-station',
    type: 'scattergeo',
    mode: 'markers+text',

    lat: station ? [station.lat] : [],
    lon: station ? [station.lon] : [],
    text: station ? [station.name] : [],

    textposition: 'bottom center',
    textfont: {
      color: '#fbbf24',
      size: 9,
    },

    marker: {
      symbol: 'triangle-down',
      size: 10,
      color: '#f97316',
      line: {
        color: '#ffffff',
        width: 1,
      },
    },

    hovertemplate:
      '<b>%{text}</b><br>' +
      'Ground station<br>' +
      'Latitude: %{lat:.4f}°<br>' +
      'Longitude: %{lon:.4f}°' +
      '<extra></extra>',

    showlegend: false,
  }), [station])
  const data = useMemo(() => [
    {...trackTrace, visible: Boolean(showTrack)},
    {...passTrace, uid: 'passes', visible: Boolean(showPasses)},
    {...markerTrace, uid: 'satellite'},
    stationTrace,
  ], [
    trackTrace,
    passTrace,
    markerTrace,
    stationTrace,
    showTrack,
    showPasses,
  ])

  return (
    <Plot
      data={data}
      layout={layout}
      config={config}
      style={{
        width: '100%',
        height: '100%',
        clipPath: 'circle(closest-side at 50% 50%)',
      }}
      useResizeHandler
    />
  )
})

function makePassTrace(passes) {
  // ── Pass markers ──────────────────────────────────────
  if (passes?.length) {
    const tcaLats   = passes.map(p => p.tca_lat)
    const tcaLons   = passes.map(p => p.tca_lon)
    const tcaLabels = passes.map((p, i) =>
      `P${i + 1} ${p.max_elevation.toFixed(0)}°`
    )
    const tcaColors = passes.map(p =>
      p.quality?.includes('EXCELLENT') ? '#4ade80'
      : p.quality?.includes('GOOD')    ? '#38bdf8'
      : '#64748b'
    )

    return {
      type: 'scattergeo',
      mode: 'markers+text',
      lat: tcaLats,
      lon: tcaLons,
      text: tcaLabels,
      textposition: 'top right',
      textfont: { color: '#94a3b8', size: 9 },
      marker: {
        size: tcaColors.map(c =>
          c === '#4ade80' ? 10 : c === '#38bdf8' ? 8 : 6
        ),
        color: tcaColors,
        symbol: 'circle',
        line: { color: '#ffffff', width: 1 },
        opacity: 0.9,
      },
      showlegend: false,
      customdata: passes.map((p, i) => `Pass ${i+1}`),
      hovertemplate:
        '%{customdata}<br>' +
        'MaxEl: %{text}<br>' +
        'Lat: %{lat:.2f}° Lon: %{lon:.2f}°' +
        '<extra></extra>',
    }
  }


  return {type: 'scattergeo', mode: 'markers+text', lat: [], lon: [], showlegend: false}
}

function makeMarker(sat) {
  return {
    type: 'scattergeo',
    mode: 'markers+text',
    lat: [sat.lat],
    lon: [sat.lon],
    text: [sat.name?.trim().split(' ')[0]],
    textposition: 'top center',
    textfont: { color: '#ffffff', size: 11 },
    marker: {
      size: 10,
      color: '#ffffff',
      symbol: 'circle',
      line: { color: sat.color || '#a78bfa', width: 2 },
    },
    showlegend: false,
    hovertemplate:
      `<b>${sat.name?.trim()}</b><br>` +
      `Lat: ${sat.lat?.toFixed(3)}°<br>` +
      `Lon: ${sat.lon?.toFixed(3)}°<br>` +
      `Alt: ${sat.alt?.toFixed(1)} km<extra></extra>`,
  }

}

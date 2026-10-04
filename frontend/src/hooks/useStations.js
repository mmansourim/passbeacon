import { useState, useEffect } from 'react'
import { getJson } from '../api.js'

export function useStations(generation) {
  const [stations, setStations] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false, retry
    async function load() {
      try {
        const list = await getJson('/api/stations', {generation})
        if (!cancelled) { setStations(list); setError(list.length ? '' : 'No ground stations configured.') }
      } catch (err) {
        if (!cancelled) { setError(err.message); retry = setTimeout(load, 3000) }
      }
    }
    load()
    return () => { cancelled = true; clearTimeout(retry) }
  }, [generation])
  return {stations, error}
}

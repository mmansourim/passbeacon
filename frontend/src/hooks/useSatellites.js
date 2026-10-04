import { useState, useEffect, useCallback } from 'react'
import { getJson } from '../api.js'

export function useSatellites() {
  const [satellites, setSatellites] = useState({})
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const generation = status?.generation || ''
  useEffect(() => {
    let cancelled = false, ws, retry
    async function connect() {
      try {
        const list = await getJson('/api/satellites', {maxAge: 0})
        if (cancelled) return
        setSatellites(prev => Object.fromEntries(list.map(s => [s.id, {...prev[s.id], ...s}])))
        setError(list.length ? '' : 'No satellites loaded; waiting for data refresh.')
        const url = new URL('/ws/satellites', window.location.href)
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
        ws = new WebSocket(url)
        ws.onopen = () => { if (!cancelled) setConnected(true) }
        ws.onmessage = e => {
          if (cancelled) return
          const msg = JSON.parse(e.data)
          if (msg.type !== 'positions') return
          setLastUpdate(msg.timestamp)
          setStatus(msg.status)
          setError(msg.data.length ? '' : 'No current positions available; check data status.')
          setSatellites(prev => {
            const next = {...prev}
            msg.data.forEach(pos => { next[pos.id] = {...next[pos.id], ...pos} })
            return next
          })
        }
        ws.onerror = () => ws.close()
        ws.onclose = () => {
          if (!cancelled) { setConnected(false); retry = setTimeout(connect, 2000) }
        }
      } catch (err) {
        if (!cancelled) { setError(err.message); retry = setTimeout(connect, 2000) }
      }
    }
    connect()
    return () => { cancelled = true; clearTimeout(retry); ws?.close() }
  }, [])
  const fetchDetail = useCallback(id => {
    let cancelled = false
    getJson(`/api/satellites/${id}`, {generation})
      .then(data => {
        if (cancelled) return
        setSatellites(prev => {
          const live = prev[id] || {}
          const coordinates = Object.fromEntries(['lat','lon','alt','velocity']
            .filter(k => live[k] !== undefined).map(k => [k,live[k]]))
          return {...prev, [id]: {...live, ...data, ...coordinates, detailGeneration: generation, detailError: ''}}
        })
      })
      .catch(err => {
        if (!cancelled) setSatellites(prev => ({...prev, [id]: {...prev[id], detailError: err.message}}))
      })
    return () => { cancelled = true }
  }, [generation])
  return {satellites, connected, lastUpdate, fetchDetail, error, status, generation}
}

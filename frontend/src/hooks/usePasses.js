import { useState, useEffect } from 'react'
import { getJson } from '../api.js'
const EMPTY = []

export function usePasses(satId, gsKey, generation) {
  const [result, setResult] = useState({key: '', passes: EMPTY, error: ''})
  const key = `${generation}:${satId}:${gsKey}`
  useEffect(() => {
    if (!satId || !gsKey) return
    let cancelled = false
    getJson(`/api/passes/${satId}?gs=${encodeURIComponent(gsKey)}`, {generation})
      .then(data => { if (!cancelled) setResult({key, passes: data.passes || EMPTY, error: ''}) })
      .catch(err => { if (!cancelled) setResult({key, passes: EMPTY, error: err.message}) })
    return () => { cancelled = true }
  }, [satId, gsKey, generation, key])
  return {passes: result.key === key ? result.passes : EMPTY,
    loading: Boolean(satId) && (!gsKey || result.key !== key),
    error: result.key === key ? result.error : ''}
}

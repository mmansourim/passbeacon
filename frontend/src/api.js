const cache = new Map()
const inflight = new Map()
export async function getJson(url, {generation = '', maxAge = 60000} = {}) {
  const key = `${generation}:${url}`
  const entry = cache.get(key)
  if (entry && Date.now() - entry.time < maxAge) return entry.value
  if (inflight.has(key)) return inflight.get(key)
  const request = (async () => {
    const response = await fetch(url)
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${response.status})`)
    }
    const value = await response.json()
    cache.set(key, {value, time: Date.now()})
    if (cache.size > 128) cache.delete(cache.keys().next().value)
    return value
  })()
  inflight.set(key, request)
  try { return await request } finally { inflight.delete(key) }
}

export function passTime(value) {
  return Date.parse(value.replace(' ', 'T') + 'Z')
}

export function passStatus(passes, now) {
  const remaining = passes.filter(p => passTime(p.los) > now)
  const active = remaining.find(p => passTime(p.aos) <= now) || null
  const next = remaining.filter(p => passTime(p.aos) > now)
    .sort((a, b) => passTime(a.aos) - passTime(b.aos))[0] || null
  return {active, next, remaining}
}

export function countdown(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor(seconds % 3600 / 60)
  const s = seconds % 60
  return `${h ? `${h}h ` : ''}${m}m ${String(s).padStart(2, '0')}s`
}

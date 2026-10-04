export function trackCoordinates(track, fullTrack, periodMinutes) {
  const limit = fullTrack ? track?.lats?.length : Math.ceil(periodMinutes || 93)
  const sourceLats = track?.lats?.slice(0, limit) || []
  const sourceLons = track?.lons?.slice(0, limit) || []
  const lat = [], lon = []
  for (let i = 0; i < sourceLats.length; i++) {
    if (i && Math.abs(sourceLons[i] - sourceLons[i - 1]) > 180) {
      lat.push(null); lon.push(null)
    }
    lat.push(sourceLats[i]); lon.push(sourceLons[i])
  }
  return {lat, lon}
}

export function shouldPublish(next, previous, timing) {
  if (!next?.satellite?.track || next.loading) return false
  const {now, dragging, lastInteraction, lastPublished, selectionChangedAt} = timing
  if (dragging || now - lastInteraction < 800 || now - selectionChangedAt < 150) return false
  const structuralChange = !previous || next.selectionKey !== previous.selectionKey ||
    next.groundStation !== previous.groundStation ||
    next.satellite.track !== previous.satellite.track || next.passes !== previous.passes ||
    next.showTrack !== previous.showTrack || next.fullTrack !== previous.fullTrack ||
    next.showPasses !== previous.showPasses
  return structuralChange || (next.satellite !== previous.satellite && now - lastPublished >= 5000)
}

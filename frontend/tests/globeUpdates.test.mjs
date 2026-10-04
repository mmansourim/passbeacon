import test from 'node:test'
import assert from 'node:assert/strict'
import { trackCoordinates, shouldPublish } from '../src/components/globeUpdates.js'

const track = {lats: [1, 2, 3, 4], lons: [170, 179, -179, -170]}
const previous = {satellite: {id: 'iss', track}, passes: [], loading: false,
  selectionKey: 'iss:oran', showTrack: true, fullTrack: false, showPasses: true}
const timing = {now: 10000, lastInteraction: 0, lastPublished: 9000,
  selectionChangedAt: 9000, dragging: false}

test('track splits at the dateline without adding separate traces or mutating source', () => {
  assert.deepEqual(trackCoordinates(track, true, 93), {
    lat: [1, 2, null, 3, 4], lon: [170, 179, null, -179, -170],
  })
  assert.equal(track.lats.length, 4)
  assert.deepEqual(trackCoordinates(track, false, 2), {lat: [1, 2], lon: [170, 179]})
})
test('a satellite or station change waits for matching data and debounce', () => {
  const next = {...previous, selectionKey: 'hubble:london'}
  assert.equal(shouldPublish({...next, loading: true}, previous, timing), false)
  assert.equal(shouldPublish({...next, satellite: {id: 'hubble'}}, previous, timing), false)
  assert.equal(shouldPublish(next, previous, {...timing, selectionChangedAt: 9950}), false)
  assert.equal(shouldPublish(next, previous, timing), true)
})
test('selection redraws are deferred through drag and zoom settling', () => {
  const next = {...previous, selectionKey: 'iss:paris'}
  assert.equal(shouldPublish(next, previous, {...timing, dragging: true}), false)
  assert.equal(shouldPublish(next, previous, {...timing, lastInteraction: 9800}), false)
  assert.equal(shouldPublish(next, previous, {...timing, lastInteraction: 9000}), true)
})
test('telemetry is sampled while controls and same-length new passes still update', () => {
  const next = {...previous, satellite: {...previous.satellite, lat: 10}}
  assert.equal(shouldPublish(next, previous, timing), false)
  assert.equal(shouldPublish(next, previous, {...timing, now: 14000}), true)
  assert.equal(shouldPublish({...previous, showTrack: false}, previous, timing), true)
  assert.equal(shouldPublish({...previous, passes: []}, previous, timing), true)
  assert.equal(shouldPublish(previous, previous, {...timing, now: 14000}), false)
})

test('station edits publish without waiting for the telemetry interval', () => {
  const old = {...previous, groundStation: {id: 'oran', lat: 35.6, lon: -0.6}}
  const next = {...old, groundStation: {...old.groundStation, lat: 35.6987}}
  assert.equal(shouldPublish(next, old, timing), true)
  assert.equal(shouldPublish(next, old, {...timing, dragging: true}), false)
})

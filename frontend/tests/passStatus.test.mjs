import test from 'node:test'
import assert from 'node:assert/strict'
import { passStatus, passTime, countdown } from '../src/components/passStatus.js'

const first = {aos: '2026-10-03 10:00:00', los: '2026-10-03 10:08:00'}
const second = {aos: '2026-10-03 11:30:00', los: '2026-10-03 11:40:00'}
test('countdown switches at rise and returns to next pass exactly at set', () => {
  const start = passTime(first.aos), end = passTime(first.los)
  assert.equal(passStatus([first, second], start - 1).active, null)
  assert.equal(passStatus([first, second], start - 1).next, first)
  assert.equal(passStatus([first, second], start).active, first)
  assert.equal(passStatus([first, second], end - 1).active, first)
  const ended = passStatus([first, second], end)
  assert.equal(ended.active, null)
  assert.equal(ended.next, second)
  assert.deepEqual(ended.remaining, [second])
})
test('opening during a pass, changing station, and empty predictions', () => {
  const now = passTime('2026-10-03 10:05:00')
  assert.equal(passStatus([{...first}, second], now).active.aos, first.aos)
  assert.equal(passStatus([second], now).active, null)
  assert.deepEqual(passStatus([], now), {active: null, next: null, remaining: []})
  assert.equal(passStatus([first], passTime(first.los)).next, null)
})
test('UTC and second-precision countdown do not go negative', () => {
  assert.equal(passTime(first.aos), Date.UTC(2026, 9, 3, 10))
  assert.equal(countdown(61000), '1m 01s')
  assert.equal(countdown(3600000), '1h 0m 00s')
  assert.equal(countdown(-1000), '0m 00s')
})

import test from 'node:test'
import assert from 'node:assert/strict'
import {getJson} from '../src/api.js'

test('coalesces concurrent requests and reuses a fresh selection', async t => {
  let finish, calls = 0
  t.mock.method(globalThis, 'fetch', () => { calls++; return new Promise(resolve => { finish = resolve }) })
  const first = getJson('/test/satellite')
  const second = getJson('/test/satellite')
  finish({ok: true, json: async () => ({id: '25544'})})
  assert.deepEqual(await first, await second)
  await getJson('/test/satellite')
  assert.equal(calls, 1)
})
test('a new generation and expired entries fetch again', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => ({ok: true, json: async () => ({n: ++calls})}))
  assert.equal((await getJson('/test/pass', {generation: 'first'})).n, 1)
  assert.equal((await getJson('/test/pass', {generation: 'second'})).n, 2)
  assert.equal((await getJson('/test/pass', {generation: 'second', maxAge: 0})).n, 3)
})
test('failed responses are not cached and preserve API error explanations', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => {
    calls++
    return calls === 1 ? {ok: false, status: 503, json: async () => ({detail: 'Pass computation failed'})}
      : {ok: true, json: async () => ({passes: []})}
  })
  await assert.rejects(getJson('/test/failure'), /Pass computation failed/)
  assert.deepEqual(await getJson('/test/failure'), {passes: []})
  assert.equal(calls, 2)
})

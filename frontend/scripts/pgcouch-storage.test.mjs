import assert from 'node:assert/strict'
import test from 'node:test'
import { storageForRemote } from '../src/pgcouchStorage.mjs'

const names = ({ remote, ...storage }) => storage

test('equivalent remote database URLs share storage across reloads and credential changes', async () => {
   const origin = 'https://offline.example.com'
   const first = await storageForRemote('/couchdb/offline-v3', origin)
   const equivalent = await storageForRemote('https://reader:secret@offline.example.com:443/couchdb/offline-v3/?option=1#fragment', origin)
   assert.deepEqual(names(equivalent), names(first))
   assert.equal(JSON.stringify(names(equivalent)).includes('secret'), false)
})

test('different databases and hosts isolate both stores, the worker and its lock', async () => {
   const origin = 'https://offline.example.com'
   const first = await storageForRemote('/couchdb/offline-v2', origin)
   for (const remote of ['/couchdb/offline-v3', 'https://other.example.com/couchdb/offline-v2']) {
      const other = await storageForRemote(remote, origin)
      for (const key of ['relational', 'transactions', 'lock', 'worker']) assert.notEqual(first[key], other[key], key)
   }
})

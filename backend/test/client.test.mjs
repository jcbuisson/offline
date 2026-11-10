import assert from 'node:assert/strict'
import test from 'node:test'
import { once } from 'node:events'
import { expressX } from '@jcbuisson/express-x/server'
import { parseCommand, runCommand } from '../scripts/client.mjs'

test('Node client calls express-x services for users and groups over Socket.IO', async t => {
   const app = expressX({ WS_TRANSPORT: true, WS_PATH: '/offline-socket-io/' })
   t.after(() => new Promise(resolve => app.io.close(resolve)))
   const calls = []
   for (const name of ['user', 'group']) {
      app.createService(name, Object.fromEntries(['findMany', 'findUnique', 'create', 'update', 'delete'].map(method => [method,
         (...args) => { const call = { name, method, args }; calls.push(call); return call },
      ])))
   }
   app.httpServer.listen(0, '127.0.0.1')
   await once(app.httpServer, 'listening')
   const url = `http://127.0.0.1:${app.httpServer.address().port}`
   for (const [model, service] of [['users', 'user'], ['groups', 'group']]) {
      for (const [args, method, parameters] of [
         [['find', model], 'findMany', [{}]],
         [['find', model, 'some-uid'], 'findUnique', [{ uid: 'some-uid' }]],
         [['find', model, '{"uid":"filtered"}'], 'findMany', [{ uid: 'filtered' }]],
         [['create', model, '{"uid":"new","name":"A"}'], 'create', [{ uid: 'new', name: 'A' }]],
         [['update', model, 'some-uid', '{"name":"B"}'], 'update', ['some-uid', { name: 'B' }]],
         [['delete', model, 'some-uid'], 'delete', ['some-uid']],
      ]) {
         const result = await runCommand(parseCommand(['--url', url, ...args]))
         assert.deepEqual(result, { name: service, method, args: parameters })
      }
   }
   assert.equal(calls.length, 12)
   app.createService('failure', { findMany() { throw new Error('Rejected by backend') } })
   await assert.rejects(runCommand({ url, path: '/offline-socket-io/', timeout: 1000,
      model: 'failure', method: 'findMany', parameters: [{}] }), error => error.message === 'Rejected by backend')
})

test('invalid commands are rejected before connecting', () => {
   for (const args of [[], ['delete', 'user'], ['create', 'group', 'null'], ['create', 'user', '[]'],
      ['update', 'user', 'id', 'broken'], ['find', 'metadata'], ['--timeout', '0', 'find', 'group'],
      ['--url', 'ftp://localhost', 'find', 'group']]) assert.throws(() => parseCommand(args))
   assert.deepEqual(parseCommand(['--help']), { help: true })
})

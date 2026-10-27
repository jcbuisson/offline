import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { firstValueFrom, filter, timeout } from 'rxjs'
import { PGlite } from '@electric-sql/pglite'
import { electricClientPlugin } from '@jcbuisson/express-x-plugins/electric-client'
import { electricServerPlugin, prepareElectricSyncSchema } from '@jcbuisson/express-x-plugins/electric-server'
import syncModels from '../../backend/src/syncModels.js'

class Stream {
   constructor({ url }) { this.name = url.split('/').at(-1) }
   subscribe() {}
   isConnected() { return true }
   unsubscribeAll() {}
}
class Shape {
   static models = new Map()
   constructor(stream) { Shape.models.set(stream.name, this) }
   subscribe(callback) { this.emit = callback }
}

test('app memberships remain consistent through offline parent deletions and rejected writes', async t => {
   const server = new PGlite()
   const local = new PGlite()
   const vite = await createServer({
      configFile: false,
      root: fileURLToPath(new URL('..', import.meta.url)),
      server: { middlewareMode: true, hmr: false },
      optimizeDeps: { noDiscovery: true, include: [] },
   })
   const models = new Map()
   t.after(async () => {
      for (const model of models.values()) model.stop()
      await Promise.all([...models.values()].map(model => model.waitForIdle()))
      await vite.close()
      await local.close()
      await server.close()
   })
   await server.exec(`
      CREATE TABLE "user" (uid TEXT PRIMARY KEY, firstname TEXT, lastname TEXT, email TEXT UNIQUE);
      CREATE TABLE "group" (uid TEXT PRIMARY KEY, name TEXT UNIQUE);
      CREATE TABLE user_group_relation (
         uid TEXT PRIMARY KEY,
         user_uid TEXT REFERENCES "user"(uid) ON DELETE CASCADE,
         group_uid TEXT REFERENCES "group"(uid) ON DELETE CASCADE,
         UNIQUE (user_uid, group_uid)
      );
   `)
   await prepareElectricSyncSchema(server, syncModels)
   const services = new Map()
   // A real Pool serializes each transaction on its leased connection. Keep
   // complete transactions together on this single embedded test connection.
   let tail = Promise.resolve()
   const pool = {
      query: (...args) => server.query(...args),
      async connect() {
         let release
         const next = new Promise(resolve => { release = resolve })
         const previous = tail
         tail = next
         await previous
         return { query: (...args) => server.query(...args), release }
      },
   }
   electricServerPlugin({ createService(name, methods) { services.set(name, methods) }, get() {} }, pool, syncModels, { sync: true })
   const errors = []
   const network = { onLine: false }
   const client = { service: name => services.get(name) }
   electricClientPlugin(client, { ShapeStream: Stream, Shape })
   for (const { name } of syncModels) {
      const model = client.createElectricModel(name, {
         localDb: local, network, retryMs: 60_000, onError: error => errors.push(error),
      })
      models.set(name, model)
      await model.prepare()
      model.start()
   }
   const app = { createElectricModel: name => models.get(name) }
   const { default: useRelations } = await vite.ssrLoadModule('/src/use/useUserGroupRelation.ts')
   const { default: useUser } = await vite.ssrLoadModule('/src/use/useUser.ts')
   const { default: useGroup } = await vite.ssrLoadModule('/src/use/useGroup.ts')
   const relations = useRelations(app)
   const users = useUser(app)
   const groups = useGroup(app)
   const metadata = () => ({ clientId: crypto.randomUUID(), revision: '1' })
   const deliver = async () => {
      for (const { name } of syncModels) {
         Shape.models.get(name).emit({ rows: (await server.query(`SELECT * FROM "${name}"`)).rows })
         await models.get(name).waitForIdle()
      }
   }
   const visible = (where, count) => firstValueFrom(relations.getObservable(where).pipe(
      filter(rows => rows.length === count), timeout(3000),
   ))
   const user = crypto.randomUUID()
   const group = crypto.randomUUID()
   await services.get('user').create(user, { email: 'member@example.com' }, metadata())
   await services.get('group').create(group, { name: 'Team' }, metadata())
   await services.get('user_group_relation').create(crypto.randomUUID(), { user_uid: user, group_uid: group }, metadata())
   await deliver()

   await t.test('deleting a group hides memberships locally and removes concurrent unseen memberships on sync', async () => {
      await visible({ user_uid: user }, 1)
      await groups.remove(group)
      await visible({ user_uid: user }, 0)
      assert.equal((await models.get('user_group_relation').findMany()).length, 1, 'local child cleanup waits for the server')
      assert.deepEqual((await local.query('SELECT model_name FROM electric_mutation_queue')).rows, [{ model_name: 'group' }])
      const anotherUser = crypto.randomUUID()
      await services.get('user').create(anotherUser, { email: 'concurrent@example.com' }, metadata())
      await services.get('user_group_relation').create(crypto.randomUUID(), { user_uid: anotherUser, group_uid: group }, metadata())
      network.onLine = true
      await models.get('group').flushQueue()
      network.onLine = false
      const memberships = (await server.query('SELECT * FROM user_group_relation')).rows
      assert.equal(memberships.length, 2)
      assert.ok(memberships.every(row => row.deleted && row.user_uid === null && row.group_uid === null))
      await deliver()
      assert.equal((await models.get('user_group_relation').findMany()).length, 0)
      assert.equal((await models.get('group').getStatus()).pending, 0)
   })

   await t.test('an offline membership targeting a subsequently deleted group is discarded without retry', async () => {
      const group = crypto.randomUUID()
      await services.get('group').create(group, { name: 'Deleted remotely' }, metadata())
      await deliver()
      const membership = await relations.create({ user_uid: user, group_uid: group })
      assert.equal((await visible({ user_uid: user }, 1))[0].uid, membership.uid)
      await services.get('group').delete(group, metadata())
      network.onLine = true
      await models.get('user_group_relation').flushQueue()
      network.onLine = false
      await visible({ user_uid: user }, 0)
      assert.equal(errors.at(-1).code, 'sync-parent-deleted')
      assert.equal(errors.at(-1).rowId, membership.uid)
      await deliver()
      assert.equal((await models.get('user_group_relation').getStatus()).pending, 0)
      assert.equal((await models.get('user_group_relation').getStatus()).failed, 0)
   })

   await t.test('deleting a user hides memberships locally and cascades while preserving its group', async () => {
      const group = crypto.randomUUID()
      await services.get('group').create(group, { name: 'Keep this group' }, metadata())
      await services.get('user_group_relation').create(crypto.randomUUID(), { user_uid: user, group_uid: group }, metadata())
      await deliver()
      await visible({ group_uid: group }, 1)
      await users.remove(user)
      await visible({ group_uid: group }, 0)
      network.onLine = true
      await models.get('user').flushQueue()
      network.onLine = false
      await deliver()
      assert.equal((await models.get('user_group_relation').findMany({ user_uid: user })).length, 0)
      assert.ok(await groups.findUnique({ uid: group }))
   })
})

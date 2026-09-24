import { PGliteWorker } from '@electric-sql/pglite/worker'
import { app } from './client-app'

const models = new Map()
let initialization

export function initializeSync() {
   return initialization ??= prepare()
}

async function prepare() {
   const db = await PGliteWorker.create(
      new Worker(new URL('./pglite-worker.ts', import.meta.url), { type: 'module' }),
      { dataDir: 'idb://offline-sync', id: 'offline-sync' },
   )
   const channel = new BroadcastChannel('offline-sync')
   const ownerChannel = new BroadcastChannel('offline-sync')
   // PGliteWorker proxies one connection. Keep UI reads and all three models'
   // transactions from interleaving on this tab; transaction callbacks use tx.
   let operation = Promise.resolve()
   const ordered = task => {
      const result = operation.then(task)
      operation = result.catch(() => {})
      return result
   }
   const localDb = {
      exec: (...args) => ordered(() => db.exec(...args)),
      query: (...args) => ordered(() => db.query(...args)),
      transaction: (...args) => ordered(() => db.transaction(...args)),
   }
   const owners = []
   for (const name of ['user', 'group', 'user_group_relation']) {
      const options = { primaryKey: 'uid', localDb }
      const model = app.createElectricModel(name, { ...options, channel, ownsSync: false })
      // Prepare the shared schema sequentially before UI subscriptions.
      await model.prepare()
      model.start()
      models.set(name, model)
      owners.push(app.createElectricModel(name, { ...options, channel: ownerChannel, ownsSync: true }))
   }
   const updateLeader = () => {
      for (const model of owners) {
         if (db.isLeader) model.start()
         else model.stop()
      }
   }
   db.onLeaderChange(updateLeader)
   updateLeader()
}

export function getSyncModel(name) {
   const model = models.get(name)
   if (!model) throw new Error('Initialize sync before mounting the application')
   return model
}

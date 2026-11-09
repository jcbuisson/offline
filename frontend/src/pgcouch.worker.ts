import { PGlite } from '@electric-sql/pglite'
import PouchDB from 'pouchdb-browser'
import { pgcouchClientPlugin } from '@jcbuisson/express-x-plugins/pgcouch-client'
import schema from './local-schema.sql?raw'
import { pgcouchConfig } from './pgcouchConfig'

// One database, transaction queue and replication feed for every tab.
const ports = new Set<MessagePort>()
const errors = new Map<string, unknown>()
const app: any = {}
let syncEnabled = true
let localDb: PGlite
const runtime = { ready: false, syncing: false }
function updateRuntime(value: Partial<typeof runtime>) {
   Object.assign(runtime, value)
   for (const port of ports) port.postMessage({ type: 'sync-state', ...runtime })
}
function errorData(error: any) {
   return { message: error?.message ?? String(error), status: error?.status,
      code: error?.code, transactionId: error?.transactionId }
}
function report(error: unknown) {
   const value = errorData(error)
   errors.set(value.message, value)
   for (const port of ports) port.postMessage({ type: 'sync-error', error: value })
}

// Only workers for the same remote database compete for database ownership.
const ready = new Promise<void>((resolve, reject) => {
   void navigator.locks.request(pgcouchConfig.lock, async () => {
      try {
         localDb = new PGlite(pgcouchConfig.relational)
         await localDb.exec(schema)
         const couch = new PouchDB(pgcouchConfig.transactions)
         const replicate = couch.sync.bind(couch)
         couch.sync = (...args: any[]) => replicate(...args)
            .on('active', () => updateRuntime({ syncing: true }))
            .on('paused', (error: unknown) => { updateRuntime({ syncing: false }); if (error) report(error) })
            .on('error', () => updateRuntime({ syncing: false }))
            .on('complete', () => updateRuntime({ syncing: false }))
         pgcouchClientPlugin(app, {
            models: ['user', 'group', 'user_group_relation'], localDb, couch,
            remote: pgcouchConfig.remote,
            network: { get onLine() { return syncEnabled && navigator.onLine } },
            onError: report,
         })
         await app.pgcouchReady
         updateRuntime({ ready: true })
         resolve()
         await new Promise(() => {})
      } catch (error) { updateRuntime({ ready: true, syncing: false }); reject(error) }
   }).catch(reject)
})
void ready.catch(report)

const methods = new Set(['findMany', 'findUnique', 'create', 'update', 'remove', 'delete',
   'prepare', 'getStatus', 'flushQueue', 'waitForIdle'])

;(self as any).onconnect = ({ ports: [port] }: MessageEvent) => {
   ports.add(port)
   let active = true
   const cancelled = new Set<string>()
   const subscriptions = new Map<string, { unsubscribe(): void }>()
   port.postMessage({ type: 'sync-state', ...runtime })
   for (const error of errors.values()) port.postMessage({ type: 'sync-error', error })
   port.onmessage = async ({ data }) => {
      const { id, type, model, method, args = [] } = data
      try {
         if (type === 'dispose') {
            active = false
            for (const subscription of subscriptions.values()) subscription.unsubscribe()
            subscriptions.clear(); ports.delete(port); port.close()
            return
         }
         if (type === 'unsubscribe') {
            const subscription = subscriptions.get(id)
            if (subscription) { subscription.unsubscribe(); subscriptions.delete(id) }
            else cancelled.add(id)
            return
         }
         await ready
         if (!active) return
         if (type === 'subscribe') {
            if (cancelled.delete(id)) return
            subscriptions.set(id, app.createPGCouchModel(model).getObservable(...args).subscribe({
               next: (value: unknown) => port.postMessage({ type: 'value', id, value }),
               error: (error: unknown) => port.postMessage({ type: 'subscription-error', id, error: errorData(error) }),
            }))
            return
         }
         let value
         if (type === 'network') {
            syncEnabled = args[0]
            const sync = app.createPGCouchModel('user')
            if (syncEnabled) await sync.start()
            else sync.stop()
         } else if (type === 'transaction') value = await app.pgcouchTransaction(...args)
         else if (type === 'call' && methods.has(method)) {
            value = await app.createPGCouchModel(model)[method](...args)
            if (method === 'getStatus') {
               const { rows } = await localDb.query('SELECT initialized FROM pgcouch_local_state WHERE id = 1')
               value = { ...value, initialized: rows[0]?.initialized === true }
            }
         }
         else throw new Error('Unknown sync request')
         port.postMessage({ type: 'result', id, value })
      } catch (error) { port.postMessage({ type: type === 'subscribe' ? 'subscription-error' : 'result', id, error: errorData(error) }) }
   }
   port.start()
}

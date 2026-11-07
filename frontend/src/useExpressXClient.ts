import { io } from 'socket.io-client'
import { createClient } from '@jcbuisson/express-x/client'
import { pgcouchClientPlugin } from '@jcbuisson/express-x-plugins/pgcouch-client'
import { PGlite } from '@electric-sql/pglite'
import PouchDB from 'pouchdb-browser'
import schema from './local-schema.sql?raw'
import { reactive, readonly } from 'vue'
import { reloadPlugin } from '@jcbuisson/express-x-plugins/reload-client'
import { displaySnackbar } from './use/useSnackbar'


// Hold ownership until disposal; another tab waits before opening IndexedDB.
let releaseOwnership: () => void
let acquired!: () => void
const ownership = new Promise<void>(resolve => { acquired = resolve })
const lock = navigator.locks.request('offline-pgcouch-owner', async () => {
   acquired()
   await new Promise<void>(resolve => { releaseOwnership = resolve })
})
await ownership
const localDb = new PGlite('idb://offline-pgcouch-relational')
await localDb.exec(schema)
const couch = new PouchDB('offline-pgcouch-transactions')

function createExpressXClient() {
   const state = reactive({
      socketConnected: false,
      socketError: null as Error | null,
      // Last reported error per model; current queue status is model.getStatus().
      syncErrors: {} as Record<string, Error>,
   })
   const socket = io({
      path: '/offline-socket-io/',
      transports: ['websocket'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      autoConnect: false,
   })
   const app = createClient(socket, { debug: import.meta.env.DEV })

   function reportSyncError(cause: unknown) {
      const modelName = 'pgcouch'
      const error = cause instanceof Error ? cause : Object.assign(
         new Error(typeof cause === 'object' && cause !== null && 'message' in cause ? String(cause.message) : String(cause)),
         typeof cause === 'object' && cause !== null ? cause : {},
      )
      const previous = state.syncErrors[modelName]
      state.syncErrors[modelName] = error
      if (previous?.message !== error.message) {
         console.error('PGCouch sync failed', error)
         if ((error as Error & { transactionId?: string }).transactionId) {
            displaySnackbar({ text: 'Modification refusée par le serveur et annulée localement.', color: 'warning', timeout: 8000 })
         }
      }
   }

   app.configure(reloadPlugin)

   let syncEnabled = true
   const network = {
      get onLine() { return syncEnabled && navigator.onLine },
   }

   app.configure(pgcouchClientPlugin, {
      models: ['user', 'group', 'user_group_relation'],
      localDb,
      couch,
      remote: new URL(import.meta.env.VITE_COUCH_DATABASE_URL || '/couchdb/offline', window.location.origin).href,
      network,
      onError: reportSyncError,
   })

   // Older immutable snapshots include soft-deleted rows. Keep them out of reads.
   const createModel = app.createPGCouchModel.bind(app)
   app.createPGCouchModel = (name, options) => {
      const model = createModel(name, options)
      return {
         ...model,
         findMany: (where = {}, queryOptions = {}) => model.findMany({ ...where, deleted: false }, queryOptions),
         findUnique: async (where) => (await model.findMany({ ...where, deleted: false }, { limit: 1 }))[0] ?? null,
         getObservable: (where = {}, queryOptions = {}) => model.getObservable({ ...where, deleted: false }, queryOptions),
      }
   }

   socket.on('connect', () => {
      state.socketConnected = true
      state.socketError = null
   })
   socket.on('disconnect', () => { state.socketConnected = false })
   socket.on('connect_error', (error: Error) => {
      state.socketConnected = false
      state.socketError = error
   })

   // Prepare every dataset so queued writes synchronize even before its screen opens.
   const models = ['user', 'group', 'user_group_relation'].map(name => app.createPGCouchModel(name))

   const connectSocket = () => {
      syncEnabled = true
      socket.connect()
      for (const model of models) {
         void model.start().catch(error => console.error('Failed to resume PGCouch sync', error))
      }
   }
   const disconnectSocket = () => {
      syncEnabled = false
      for (const model of models) model.stop()
      socket.disconnect()
   }

   let disposal: Promise<void> | undefined
   function dispose() {
      if (disposal) return disposal
      socket.disconnect()
      socket.removeAllListeners()
      disposal = Promise.resolve().then(async () => {
         await app.disposePGCouchSync()
         await couch.close()
         await localDb.close()
         releaseOwnership()
         await lock
      })
      return disposal
   }

   socket.connect()
   return { app, socket, state: readonly(state), connectSocket, disconnectSocket, dispose }
}

let client: ReturnType<typeof createExpressXClient> | undefined

export default function useExpressXClient() {
   return client ??= createExpressXClient()
}

if (import.meta.hot) {
   import.meta.hot.dispose(() => {
      void client?.dispose().catch(error => console.error('Client cleanup failed', error))
   })
}

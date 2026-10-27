import { io } from 'socket.io-client'
import { createClient } from '@jcbuisson/express-x/client'
import { electricClientPlugin } from '@jcbuisson/express-x-plugins/electric-client'
import { reactive, readonly } from 'vue'
import { reloadPlugin } from '@jcbuisson/express-x-plugins/reload-client'
import { displaySnackbar } from './use/useSnackbar'

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

   function reportSyncError(cause: unknown, { modelName }: { modelName: string }) {
      const error = cause instanceof Error ? cause : new Error(String(cause))
      const previous = state.syncErrors[modelName]
      state.syncErrors[modelName] = error
      // Keep storage and initialization failures visible, including while offline.
      const conflict = error as Error & { code?: string; rowId?: string }
      const previousConflict = previous as typeof conflict | undefined
      if (previous?.message !== error.message || previousConflict?.rowId !== conflict.rowId) {
         console.error(`Electric sync failed for ${modelName}`, error)
         if (conflict.code === 'sync-parent-deleted' || conflict.code === 'sync-row-deleted') {
            displaySnackbar({
               text: modelName === 'user_group_relation'
                  ? 'Modification annulée : cet utilisateur, ce groupe ou cette appartenance a été supprimé.'
                  : 'Modification annulée : cet élément a été supprimé.',
               color: 'warning',
               timeout: 8000,
            })
         }
      }
   }

   app.configure(reloadPlugin)
   app.configure(electricClientPlugin, {
      sync: true,
      databaseName: 'offline-sync',
      shapePath: new URL(
         import.meta.env.VITE_ELECTRIC_URL || '/electric/v1/shape',
         window.location.origin,
      ).href,
      onError: reportSyncError,
   })

   socket.on('connect', () => {
      state.socketConnected = true
      state.socketError = null
   })
   socket.on('disconnect', () => { state.socketConnected = false })
   socket.on('connect_error', (error: Error) => {
      state.socketConnected = false
      state.socketError = error
   })

   // These controls affect RPC transport; Electric sync has its own connection.
   const connectSocket = () => socket.connect()
   const disconnectSocket = () => socket.disconnect()

   // Prepare every dataset so queued writes synchronize even before its screen opens.
   for (const name of ['user', 'group', 'user_group_relation']) {
      app.createElectricModel(name)
   }

   let disposal: Promise<void> | undefined
   function dispose() {
      if (disposal) return disposal
      socket.disconnect()
      socket.removeAllListeners()
      disposal = Promise.resolve().then(() => app.disposeElectricSync())
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

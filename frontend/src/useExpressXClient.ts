import { io } from 'socket.io-client'
import { createClient } from '@jcbuisson/express-x/client'
import { electricSqlClientPlugin } from '@jcbuisson/express-x-plugins/electric-sql-client'
import { reactive, readonly } from 'vue'
import { reloadPlugin } from '@jcbuisson/express-x-plugins/reload-client'

function createExpressXClient() {
   const state = reactive({
      socketConnected: false,
      socketError: null as Error | null,
   })
   const socket = io({
      path: '/offline-socket-io/',
      transports: ['websocket'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      autoConnect: false,
   })
   const app = createClient(socket, { debug: import.meta.env.DEV })

   app.configure(reloadPlugin)
   app.configure(electricSqlClientPlugin, {
      shapePath: new URL(
         import.meta.env.VITE_ELECTRIC_SQL_URL || '/electric-sql/v1/shape',
         window.location.origin,
      ).href,
      onError: (error: Error) => {
         console.error('SQL live read failed', error)
      },
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

   let disposal: Promise<void> | undefined
   function dispose() {
      if (disposal) return disposal
      socket.disconnect()
      socket.removeAllListeners()
      disposal = Promise.resolve().then(() => app.sql.dispose())
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

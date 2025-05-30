import { ref, computed } from 'vue'
import { io } from "socket.io-client"
import { useSessionStorage } from '@vueuse/core'

import expressXClient from '@jcbuisson/express-x-client'
// import expressXClient from './client.mjs'


const socketOptions = {
   path: '/offline-socket-io/',
   transports: ["websocket"],
   reconnectionDelay: 1000,
   reconnectionDelayMax: 10000,
   extraHeaders: {
      "bearer-token": "mytoken"
   },
}
const socket = io(socketOptions)

export const app = expressXClient(socket, { debug: true })

export const cnxid = useSessionStorage('cnxid', '')

app.addErrorListener((socket, err) => {
   console.log('CNX ERROR!!!', socket.id, err)
})

app.addConnectListener(async (socket) => {
   const socketId = socket.id
   console.log('connect', socketId)
   // handle reconnections & reloads
   // look for a previously stored connection id
   const prevSocketId = cnxid.value
   if (prevSocketId) {
      // it's a connection after a reload/refresh
      // ask server to transfer all data from connection `prevSocketId` to connection `socketId`
      console.log('cnx-transfer', prevSocketId, 'to', socketId)
      await socket.emit('cnx-transfer', prevSocketId, socketId)
      // update connection id
      cnxid.value = socketId

   } else {
      // set connection id
      cnxid.value = socketId
   }

   socket.on('cnx-transfer-ack', async (fromSocketId, toSocketId) => {
      console.log('ACK ACK!!!', fromSocketId, toSocketId)
   })

   socket.on('cnx-transfer-error', async (fromSocketId, toSocketId) => {
      console.log('ERR ERR!!!', fromSocketId, toSocketId)
      // appState.value.unrecoverableError = true
   })
})

export const connectedDate = ref()
export const disconnectedDate = ref()

app.addConnectListener(async (socket) => {
   console.log('onConnect')
   connectedDate.value = new Date()
   disconnectedDate.value = null
})

app.addDisconnectListener(async (socket) => {
   connectedDate.value = null
   disconnectedDate.value = new Date()
})

export const isConnected = computed(() => !!connectedDate.value)

export function connect() {
   console.log('connecting...')
   socket.connect()
}

export function disconnect() {
   console.log('disconnecting...')
   socket.disconnect()
}

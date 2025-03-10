
import { io } from "socket.io-client"
import { ref } from 'vue'

// import expressXClient from '@jcbuisson/express-x-client'
import expressXClient from './client.mjs'


const socketOptions = {
   path: '/offline-socket-io/',
   transports: ["websocket"],
   reconnectionDelay: 1000,
   reconnectionDelayMax: 10000,
}

export const socket = io(socketOptions)

export const app = expressXClient(socket, { debug: true })

export const onlineDate = ref()
export const offlineDate = ref()

app.addConnectListener(async (socket) => {
   console.log('onConnect')
   onlineDate.value = new Date()
   offlineDate.value = null
})

app.addDisconnectListener(async (socket) => {
   onlineDate.value = null
   offlineDate.value = new Date()
})

import 'dotenv/config'
// import { expressX, reloadPlugin, offlinePlugin } from '@jcbuisson/express-x'
import { expressX, reloadPlugin, offlinePlugin } from '#root/src/server.mjs'

import channels from './channels.js'

import prisma from './prisma.js'


const app = expressX({
   WS_TRANSPORT: true,
   WS_PATH: '/offline-socket-io/',
})

app.set('prisma', prisma)

// allows socket data & room transfer on page reload
app.configure(reloadPlugin)

// add offline synchronization service and add database services for business models
app.configure(offlinePlugin, ['user', 'group', 'user_group_relation'])

// publish
app.configure(channels)
// subscribe
app.on('connection', (socket) => {
   app.joinChannel('anonymous', socket)
})

const PORT = process.env.PORT || 3000
app.httpServer.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}`))

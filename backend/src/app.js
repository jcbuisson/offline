import 'dotenv/config'

// import { expressX } from '@jcbuisson/express-x'
import { expressX } from './server.mjs'
import { PrismaClient } from '@prisma/client'
import services from './services/index.js'
import channels from './channels.js'

const app = expressX({
   WS_TRANSPORT: true,
   WS_PATH: '/offline-socket-io/',
})

const prisma = new PrismaClient()
app.set('prisma', prisma)

app.configure(services)
app.configure(channels)

app.on('connection', (socket) => {
   app.joinChannel('anonymous', socket)
})

const PORT = process.env.PORT || 3000
app.httpServer.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}`))
